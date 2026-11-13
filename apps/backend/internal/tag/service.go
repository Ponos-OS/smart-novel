// Package tag holds the rules for the tags writers put on novels.
package tag

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

const notFoundMessage = "Tag not found"

// RowEstimator tells how many rows a query would return, from the planner, without running it.
type RowEstimator interface {
	EstimateRows(ctx context.Context, query string, args ...any) (int, error)
}

// Service decides how a tag is requested, approved and renamed; the queries are in the repository.
type Service struct {
	repo      *repository
	estimator RowEstimator
}

func NewService(client *ent.Client, estimator RowEstimator) *Service {
	return &Service{repo: newRepository(client), estimator: estimator}
}

// Request files a tag a writer asks for; it is pending until an admin approves it. The input is already normalized.
func (s *Service) Request(ctx context.Context, requesterUserID string, input Input) (*ent.Tag, error) {
	created, err := s.repo.createPending(ctx, input, requesterUserID)

	return created, alreadyExists(err, input.Name)
}

// Create stores a tag that is approved right away.
func (s *Service) Create(ctx context.Context, input Input) (*ent.Tag, error) {
	created, err := s.repo.createApproved(ctx, input)

	return created, alreadyExists(err, input.Name)
}

// Approve makes a pending tag approved; approving an approved one changes nothing.
func (s *Service) Approve(ctx context.Context, id uuid.UUID) (*ent.Tag, error) {
	if err := s.repo.approve(ctx, id); err != nil {
		return nil, fmt.Errorf("approving tag %s: %w", id, err)
	}

	found, err := s.repo.tag(ctx, id)
	if ent.IsNotFound(err) {
		return nil, apperr.NotFound(notFoundMessage)
	}

	return found, err
}

// Update changes the name, the description or both; the novels that have the tag follow a rename. The changes are already normalized.
func (s *Service) Update(ctx context.Context, id uuid.UUID, changes Update) (*ent.Tag, error) {
	updated, err := s.repo.update(ctx, id, changes)
	if ent.IsNotFound(err) {
		return nil, apperr.NotFound(notFoundMessage)
	}
	if changes.Name != nil {
		return updated, alreadyExists(err, *changes.Name)
	}

	return updated, err
}

// Delete removes the tag of any status from every novel that has it; the novels stay.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	err := s.repo.delete(ctx, id)
	if ent.IsNotFound(err) {
		return apperr.NotFound(notFoundMessage)
	}

	return err
}

// EstimateNovelCount is the planner's estimate of how many novels have the tag, never an exact count.
func (s *Service) EstimateNovelCount(ctx context.Context, id uuid.UUID) (int, error) {
	return s.estimator.EstimateRows(ctx, "SELECT 1 FROM novel_tags WHERE tag_id = $1", id)
}

func alreadyExists(err error, name string) error {
	if !ent.IsConstraintError(err) {
		return err
	}

	return apperr.BadRequest(fmt.Sprintf(`The tag "%s" already exists or was already requested. Search for "%s" instead.`, name, name))
}
