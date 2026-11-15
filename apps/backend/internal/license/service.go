// Package license holds the rules for the licenses a novel is published under: the stored texts, the default, and the drafts a writer works on.
package license

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/entx"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

// DraftsPerWriterMax is how many unfinished drafts a writer may have.
const DraftsPerWriterMax = 20

// Service decides which licenses a writer may use, how a text becomes a license and how a draft is finished; the queries are in the repository.
// A license is a row that never changes: the same text is stored once per owner, and a draft is the only mutable kind.
type Service struct {
	client        *ent.Client
	repo          *repository
	fitharaClient *fithara.ClientWithResponses
	logger        *slog.Logger

	mutex                sync.Mutex
	officialURLs         map[string]string
	officialURLsExpireAt time.Time
}

// NewService makes the service; fitharaClient may be nil in a program that never asks Fithara (devdata).
func NewService(client *ent.Client, fitharaClient *fithara.ClientWithResponses, logger *slog.Logger) *Service {
	return &Service{client: client, repo: newRepository(client), fitharaClient: fitharaClient, logger: logger}
}

func notFound(id uuid.UUID) error {
	return apperr.NotFound(fmt.Sprintf("License with id %s not found", id))
}

func draftNotFound(id uuid.UUID) error {
	return apperr.NotFound(fmt.Sprintf("License draft %s not found", id))
}

// Default is the license new novels get when none is chosen.
func (s *Service) Default(ctx context.Context) (*ent.License, error) {
	found, err := s.repo.defaultLicense(ctx)
	if err != nil {
		return nil, fmt.Errorf("finding the default license: %w", err)
	}

	return found, nil
}

// FindUsable is a shared license or one of the owner's; another writer's, a draft and an unknown ID are all not found.
func (s *Service) FindUsable(ctx context.Context, id uuid.UUID, ownerID string) (*ent.License, error) {
	found, err := s.repo.usable(ctx, id, []string{SystemOwner, ownerID})
	if ent.IsNotFound(err) {
		return nil, notFound(id)
	}

	return found, err
}

// Create stores a license every writer can use. An admin only; a text that is stored already is returned as it is, and the default does not change.
func (s *Service) Create(ctx context.Context, viewer auth.Viewer, input Input) (*ent.License, error) {
	if err := auth.DenyUnlessCan(viewer, auth.Create, auth.License{}); err != nil {
		return nil, err
	}

	return s.GetOrCreate(ctx, input, SystemOwner)
}

// GetOrCreate reuses the stored row when the normalized text is already known, so that row keeps its own name and source.
func (s *Service) GetOrCreate(ctx context.Context, input Input, ownerID string) (*ent.License, error) {
	existing, data, err := s.prepare(ctx, input, ownerID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	created, err := s.repo.insert(ctx, data)
	if ent.IsConstraintError(err) {
		// The same text was stored between the check and the insert.
		return s.repo.byText(ctx, data.OwnerID, data.TextHash)
	}

	return created, err
}

// prepare runs the checks every new license goes through, whether it comes from a novel's input or from finalizing a draft. It returns
// the license that already has the text, or what to store.
func (s *Service) prepare(ctx context.Context, input Input, ownerID string) (*ent.License, stored, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" || strings.TrimSpace(input.Text) == "" {
		return nil, stored{}, apperr.BadRequest("A license needs a name and a text")
	}
	hash := TextHash(input.Text)
	existing, err := s.findByText(ctx, hash, ownerID)
	if err != nil || existing != nil {
		return existing, stored{}, err
	}
	switch {
	case input.SourceType == entlicense.SourceTypeCANONICAL:
		data, err := s.verifyCanonical(ctx, input, hash)

		return nil, data, err
	case input.SourceType == entlicense.SourceTypeFORKED && input.CanonicalID == nil:
		return nil, stored{}, apperr.BadRequest("A FORKED license needs the canonicalId it was modified from")
	case input.SourceType == entlicense.SourceTypeCUSTOM && input.CanonicalID != nil:
		return nil, stored{}, apperr.BadRequest("A CUSTOM license has no canonicalId")
	}

	return nil, stored{
		Name:        name,
		Text:        NormalizeText(input.Text),
		TextHash:    hash,
		OwnerID:     ownerID,
		SourceType:  input.SourceType,
		CanonicalID: input.CanonicalID,
	}, nil
}

// findByText looks at the shared license with this text first, so an unmodified canonical text is always the canonical license, then at the
// owner's own, so they never get a second copy of what they have. Another writer's license is never a match.
func (s *Service) findByText(ctx context.Context, hash, ownerID string) (*ent.License, error) {
	owners := []string{SystemOwner}
	if ownerID != SystemOwner {
		owners = append(owners, ownerID)
	}
	for _, owner := range owners {
		found, err := s.repo.byText(ctx, owner, hash)
		if err == nil {
			return found, nil
		}
		if !ent.IsNotFound(err) {
			return nil, err
		}
	}

	return nil, nil //nolint:nilnil // no license has this text
}

// verifyCanonical lets a text claim to be canonical only when it is Fithara's, word for word (white space aside), so a client cannot
// dress its own text as a well-known license. The row takes its name from Fithara.
func (s *Service) verifyCanonical(ctx context.Context, input Input, hash string) (stored, error) {
	if input.CanonicalID == nil {
		return stored{}, apperr.BadRequest("A CANONICAL license needs its canonicalId")
	}
	canonical, err := s.findCanonical(ctx, *input.CanonicalID)
	if err != nil {
		return stored{}, err
	}
	if canonical == nil || TextHash(canonical.Body) != hash {
		return stored{}, apperr.BadRequest(fmt.Sprintf("This text is not the canonical license %s, send it as FORKED or CUSTOM", *input.CanonicalID))
	}

	return stored{
		Name:        canonical.ShortName,
		Text:        NormalizeText(input.Text),
		TextHash:    hash,
		OwnerID:     SystemOwner,
		SourceType:  entlicense.SourceTypeCANONICAL,
		CanonicalID: &canonical.Id,
	}, nil
}

// SetDefault changes the license new novels get; existing novels keep theirs. An admin only. The default belongs to everybody, so it is
// always a shared license.
func (s *Service) SetDefault(ctx context.Context, viewer auth.Viewer, id uuid.UUID) (*ent.License, error) {
	if err := auth.DenyUnlessCan(viewer, auth.Update, auth.License{}); err != nil {
		return nil, err
	}
	chosen, err := s.FindUsable(ctx, id, SystemOwner)
	if err != nil {
		return nil, err
	}

	return s.makeDefault(ctx, chosen.ID)
}

// makeDefault switches the default to the license, one switch at a time.
func (s *Service) makeDefault(ctx context.Context, id uuid.UUID) (*ent.License, error) {
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		if err := repo.lockDefault(ctx); err != nil {
			return err
		}

		return repo.makeDefault(ctx, id)
	})
	if err != nil {
		return nil, err
	}

	return s.repo.usable(ctx, id, []string{SystemOwner})
}
