package platformterms

import (
	"context"
	"fmt"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// Status says whether a user accepted the current terms.
type Status struct {
	RequiredVersion int
	AcceptedVersion *int
	Accepted        bool
	AcceptedAt      *time.Time
}

// Service knows the current terms and who accepted them.
type Service struct {
	terms Terms
	repo  *repository
}

func NewService(client *ent.Client, terms Terms) *Service {
	return &Service{terms: terms, repo: newRepository(client)}
}

func (s *Service) Current() Terms {
	return s.terms
}

func (s *Service) Status(ctx context.Context, userID string) (Status, error) {
	acceptances, err := s.repo.acceptances(ctx, userID)
	if err != nil {
		return Status{}, err
	}
	status := Status{RequiredVersion: s.terms.Version}
	for _, acceptance := range acceptances {
		if status.AcceptedVersion == nil || acceptance.TermsVersion > *status.AcceptedVersion {
			version := acceptance.TermsVersion
			status.AcceptedVersion = &version
		}
		if acceptance.TermsVersion == s.terms.Version {
			status.Accepted = true
			acceptedAt := acceptance.AcceptedAt
			status.AcceptedAt = &acceptedAt
		}
	}

	return status, nil
}

// HasAcceptedCurrent is what the guard of the writer mutations asks.
func (s *Service) HasAcceptedCurrent(ctx context.Context, userID string) (bool, error) {
	return s.repo.accepted(ctx, userID, s.terms.Version)
}

// Accept records the acceptance of the current version; any other version is refused, and accepting twice changes nothing.
func (s *Service) Accept(ctx context.Context, userID string, version int) (Status, error) {
	if version != s.terms.Version {
		return Status{}, apperr.WithCode(apperr.CodePlatformTermsVersionMismatch,
			fmt.Sprintf("The platform terms are at version %d, not %d. Reload them before accepting.", s.terms.Version, version))
	}
	if err := s.repo.accept(ctx, userID, version); err != nil {
		return Status{}, err
	}

	return s.Status(ctx, userID)
}

// NotAccepted is the error for a writer who has not accepted the current terms.
func NotAccepted() error {
	return apperr.WithCode(apperr.CodePlatformTermsNotAccepted, "You must accept the current platform terms first")
}
