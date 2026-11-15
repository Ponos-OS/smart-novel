package license

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

// A draft is a license row flagged as a draft and owned by its writer. It is mutable, has no hash and is invisible to every other path; every
// statement names the owner, and writes also name the flag, so a draft finalized a moment ago can never be changed by a late save.

// CreateDraft starts a draft from the text of a license the writer may use, of a canonical license, or from nothing.
func (s *Service) CreateDraft(ctx context.Context, ownerID string, start DraftStart) (*ent.License, error) {
	if start.LicenseID != nil && start.CanonicalID != nil {
		return nil, apperr.BadRequest("Pass either licenseID or canonicalID, not both")
	}
	drafts, err := s.repo.countDrafts(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if drafts >= DraftsPerWriterMax {
		return nil, apperr.BadRequest(fmt.Sprintf("You have %d unfinished license drafts. Finish or discard one first.", DraftsPerWriterMax))
	}
	base, err := s.draftBase(ctx, ownerID, start)
	if err != nil {
		return nil, err
	}

	return s.repo.insertDraft(ctx, ownerID, base)
}

func (s *Service) draftBase(ctx context.Context, ownerID string, start DraftStart) (DraftSave, error) {
	if start.LicenseID != nil {
		found, err := s.FindUsable(ctx, *start.LicenseID, ownerID)
		if err != nil {
			return DraftSave{}, err
		}

		return DraftSave{Name: found.Name, Text: found.Text, SourceType: found.SourceType, CanonicalID: found.CanonicalID}, nil
	}
	if start.CanonicalID != nil {
		canonical, err := s.findCanonical(ctx, *start.CanonicalID)
		if err != nil {
			return DraftSave{}, err
		}
		if canonical == nil {
			return DraftSave{}, apperr.BadRequest(fmt.Sprintf("%s is not a known canonical license", *start.CanonicalID))
		}

		return DraftSave{Name: canonical.ShortName, Text: canonical.Body, SourceType: entlicense.SourceTypeCANONICAL, CanonicalID: &canonical.Id}, nil
	}

	return DraftSave{SourceType: entlicense.SourceTypeCUSTOM}, nil
}

// SaveDraft stores the whole draft. Saving what is already saved writes nothing, and the last save wins.
func (s *Service) SaveDraft(ctx context.Context, ownerID string, save DraftSave) (*ent.License, error) {
	current, err := s.ownedDraft(ctx, ownerID, save.ID)
	if err != nil {
		return nil, err
	}
	if sameDraft(current, save) {
		return current, nil
	}
	changed, err := s.repo.updateDraft(ctx, ownerID, save)
	if err != nil {
		return nil, err
	}
	if changed == 0 {
		return nil, draftNotFound(save.ID)
	}

	return s.ownedDraft(ctx, ownerID, save.ID)
}

func sameDraft(current *ent.License, save DraftSave) bool {
	sameCanonical := (current.CanonicalID == nil && save.CanonicalID == nil) ||
		(current.CanonicalID != nil && save.CanonicalID != nil && *current.CanonicalID == *save.CanonicalID)

	return current.Name == save.Name && current.Text == save.Text && current.SourceType == save.SourceType && sameCanonical
}

// Draft returns a draft of the viewer; an admin can read anybody's. Another writer's draft is not found.
func (s *Service) Draft(ctx context.Context, viewer auth.Viewer, id uuid.UUID) (*ent.License, error) {
	owner := viewer.Subject
	if viewer.IsAdmin() {
		owner = ""
	}
	found, err := s.repo.draft(ctx, id, owner)
	if ent.IsNotFound(err) {
		return nil, draftNotFound(id)
	}

	return found, err
}

func (s *Service) ownedDraft(ctx context.Context, ownerID string, id uuid.UUID) (*ent.License, error) {
	found, err := s.repo.draft(ctx, id, ownerID)
	if ent.IsNotFound(err) {
		return nil, draftNotFound(id)
	}

	return found, err
}

// DiscardDraft throws a draft away.
func (s *Service) DiscardDraft(ctx context.Context, ownerID string, id uuid.UUID) error {
	deleted, err := s.repo.deleteDraft(ctx, ownerID, id)
	if err != nil {
		return err
	}
	if deleted == 0 {
		return draftNotFound(id)
	}

	return nil
}

// FinalizeDraft says the draft is finished: it becomes a license, or is replaced by the stored license with the same text, so the ID of the
// returned license can differ from the draft's. The draft is gone afterwards.
func (s *Service) FinalizeDraft(ctx context.Context, ownerID string, id uuid.UUID) (*ent.License, error) {
	draft, err := s.ownedDraft(ctx, ownerID, id)
	if err != nil {
		return nil, err
	}
	existing, data, err := s.prepare(ctx, Input{Name: draft.Name, Text: draft.Text, SourceType: draft.SourceType, CanonicalID: draft.CanonicalID}, ownerID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, s.DiscardDraft(ctx, ownerID, id)
	}
	changed, err := s.repo.promote(ctx, ownerID, id, data)
	if ent.IsConstraintError(err) {
		// The same text was stored between the check and the promotion.
		stored, byTextErr := s.repo.byText(ctx, data.OwnerID, data.TextHash)
		if byTextErr != nil {
			return nil, byTextErr
		}

		return stored, s.DiscardDraft(ctx, ownerID, id)
	}
	if err != nil {
		return nil, err
	}
	if changed == 0 {
		return nil, draftNotFound(id)
	}

	return s.repo.usable(ctx, id, []string{data.OwnerID})
}
