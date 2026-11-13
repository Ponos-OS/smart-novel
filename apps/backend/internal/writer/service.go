package writer

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/schema"
	entwriter "github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/entx"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
)

const (
	notFoundMessage        = "Writer request not found"
	alreadyWriterMessage   = "You already have writer access"
	alreadyPendingMessage  = "You already have a pending writer request"
	alreadyReviewedMessage = "This writer request was already reviewed"
	penNameTakenMessage    = "That pen name is already taken, please choose another one"
)

// RoleGranter gives a user a role of the project in the identity provider.
type RoleGranter interface {
	SetUserProjectRole(ctx context.Context, userID string, role shared.Role) error
}

// Identity is who asks to become a writer, as the identity provider says.
type Identity struct {
	UserID string
	Name   string
	Email  string
}

// Service decides who may become a writer and how a request is reviewed; the queries are in the repository.
type Service struct {
	client *ent.Client
	repo   *repository
	roles  RoleGranter
}

func NewService(client *ent.Client, roles RoleGranter) *Service {
	return &Service{client: client, repo: newRepository(client), roles: roles}
}

// Request files the application of the viewer. A user has one row for life: the first request creates it, and a rejected user who asks
// again gets a new entry in the history and the status back to PENDING. The note is already cleaned and checked, the pen name is checked by the schema.
func (s *Service) Request(ctx context.Context, viewer auth.Viewer, note, penName string) (*ent.Writer, error) {
	if viewer.HasMinimumRole(shared.RoleWriter) {
		return nil, apperr.BadRequest(alreadyWriterMessage)
	}
	if err := s.refusePenNameOfAnother(ctx, penName, viewer.Subject); err != nil {
		return nil, err
	}
	identity := Identity{UserID: viewer.Subject, Name: viewer.Name, Email: viewer.Email}
	if identity.Name == "" {
		identity.Name = viewer.PreferredUsername
	}
	var applied *ent.Writer
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		var err error
		applied, err = apply(ctx, newRepository(tx.Client()), identity, note, penName)

		return err
	})
	if ent.IsConstraintError(err) {
		// Either the pen name another request just took or this user's own pending row; asking again tells them apart.
		if refusal := s.refusePenNameOfAnother(ctx, penName, viewer.Subject); refusal != nil {
			return nil, refusal
		}

		return nil, apperr.BadRequest(alreadyPendingMessage)
	}

	return applied, err
}

func apply(ctx context.Context, repo *repository, identity Identity, note, penName string) (*ent.Writer, error) {
	application := schema.WriterApplication{Note: note, AppliedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	existing, err := repo.lockedByUserID(ctx, identity.UserID)
	if ent.IsNotFound(err) {
		return repo.create(ctx, identity, penName, []schema.WriterApplication{application})
	}
	if err != nil {
		return nil, err
	}
	switch existing.Status {
	case entwriter.StatusPENDING:
		return nil, apperr.BadRequest(alreadyPendingMessage)
	case entwriter.StatusAPPROVED:
		return nil, apperr.BadRequest(alreadyWriterMessage)
	case entwriter.StatusREJECTED:
	}

	return repo.reapply(ctx, existing.ID, identity, penName, append(existing.Applications[:len(existing.Applications):len(existing.Applications)], application))
}

func (s *Service) refusePenNameOfAnother(ctx context.Context, penName, userID string) error {
	owner, err := s.repo.ownerOfPenName(ctx, penName)
	if err != nil {
		return err
	}
	if owner != "" && owner != userID {
		return apperr.WithCode(shared.PenNameTaken, penNameTakenMessage)
	}

	return nil
}

// ForUser is the writer record of a user (their latest request); nil when they never asked.
func (s *Service) ForUser(ctx context.Context, userID string) (*ent.Writer, error) {
	found, err := s.repo.byUserID(ctx, userID)
	if ent.IsNotFound(err) {
		return nil, nil
	}

	return found, err
}

// Approve grants the writer role to the requester in the identity provider, then marks the request APPROVED. The identity provider is
// called first, so its failure leaves the request PENDING for a retry; setting the grant twice is harmless, so a failed write is safe to retry.
func (s *Service) Approve(ctx context.Context, id uuid.UUID, adminID string) (*ent.Writer, error) {
	pending, err := s.pending(ctx, id)
	if err != nil {
		return nil, err
	}
	if err = s.roles.SetUserProjectRole(ctx, pending.UserID, shared.RoleWriter); err != nil {
		return nil, fmt.Errorf("granting the writer role to %s: %w", pending.UserID, err)
	}

	return s.review(ctx, id, adminID, entwriter.StatusAPPROVED, nil)
}

// Reject marks a pending request REJECTED with a reason the requester sees; the reason is already cleaned and checked, and blank means none.
func (s *Service) Reject(ctx context.Context, id uuid.UUID, adminID string, reason *string) (*ent.Writer, error) {
	if _, err := s.pending(ctx, id); err != nil {
		return nil, err
	}
	var rejection *string
	if reason != nil && strings.TrimSpace(*reason) != "" {
		trimmed := strings.TrimSpace(*reason)
		rejection = &trimmed
	}

	return s.review(ctx, id, adminID, entwriter.StatusREJECTED, rejection)
}

func (s *Service) pending(ctx context.Context, id uuid.UUID) (*ent.Writer, error) {
	found, err := s.repo.byID(ctx, id)
	if ent.IsNotFound(err) {
		return nil, apperr.NotFound(notFoundMessage)
	}
	if err != nil {
		return nil, err
	}
	if found.Status != entwriter.StatusPENDING {
		return nil, apperr.BadRequest(alreadyReviewedMessage)
	}

	return found, nil
}

// review locks the row and reads its status again, so two admins reviewing the same request at once end with one winner and one bad request.
// Filling in the review fields of the last entry is the only time an entry of the history changes.
func (s *Service) review(ctx context.Context, id uuid.UUID, adminID string, status entwriter.Status, rejection *string) (*ent.Writer, error) {
	var reviewed *ent.Writer
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		locked, err := repo.lockedByID(ctx, id)
		if ent.IsNotFound(err) {
			return apperr.NotFound(notFoundMessage)
		}
		if err != nil {
			return err
		}
		if locked.Status != entwriter.StatusPENDING {
			return apperr.BadRequest(alreadyReviewedMessage)
		}
		if len(locked.Applications) == 0 {
			return fmt.Errorf("%w: writer %s", errNoApplication, id)
		}
		history := append([]schema.WriterApplication(nil), locked.Applications...)
		last := &history[len(history)-1]
		reviewedAt := time.Now().UTC().Format(time.RFC3339Nano)
		last.RejectionReason, last.ReviewedBy, last.ReviewedAt = rejection, &adminID, &reviewedAt
		reviewed, err = repo.review(ctx, id, status, history)

		return err
	})

	return reviewed, err
}

var errNoApplication = errors.New("a pending writer without an application")

// ListFilter narrows the list of requests: PENDING unless the filter names a status, and only the pen names that contain the search text.
func ListFilter(where *ent.WriterWhereInput, search *string) *ent.WriterWhereInput {
	conditions := make([]*ent.WriterWhereInput, 0, 3) //nolint:mnd // the filter, the status and the search
	named := false
	if where != nil && !isEmpty(where) {
		conditions = append(conditions, where)
		named = namesStatus(where)
	}
	if !named {
		pending := entwriter.StatusPENDING
		conditions = append(conditions, &ent.WriterWhereInput{Status: &pending})
	}
	if search != nil && strings.TrimSpace(*search) != "" {
		conditions = append(conditions, &ent.WriterWhereInput{PenNameContainsFold: search})
	}

	return &ent.WriterWhereInput{And: conditions}
}

// isEmpty is a filter that sets nothing (where: {}), which ent refuses inside an and.
func isEmpty(where *ent.WriterWhereInput) bool {
	_, err := where.P()

	return errors.Is(err, ent.ErrEmptyWriterWhereInput)
}

func namesStatus(where *ent.WriterWhereInput) bool {
	return where.Status != nil || where.StatusNEQ != nil || len(where.StatusIn) > 0 || len(where.StatusNotIn) > 0
}
