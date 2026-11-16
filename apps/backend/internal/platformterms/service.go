package platformterms

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
)

const (
	acceptedTTL = 24 * time.Hour
	logKeyKey   = "key"
	logKeyError = "error"
)

// Service knows the current terms and who accepted them. Only an acceptance is cached, so a lost or stale entry can never let anybody in.
type Service struct {
	terms  model.PlatformTerms
	repo   *repository
	cache  *redis.Client
	logger *slog.Logger
}

func NewService(client *ent.Client, terms model.PlatformTerms, cache *redis.Client, logger *slog.Logger) *Service {
	return &Service{terms: terms, repo: newRepository(client), cache: cache, logger: logger}
}

func (s *Service) Current() model.PlatformTerms {
	return s.terms
}

func (s *Service) Status(ctx context.Context, userID string) (model.PlatformTermsStatus, error) {
	acceptances, err := s.repo.acceptances(ctx, userID)
	if err != nil {
		return model.PlatformTermsStatus{}, err
	}
	status := model.PlatformTermsStatus{RequiredVersion: s.terms.Version}
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

// HasAcceptedCurrent is what the guard of the writer mutations asks. A Redis that fails is logged and the database answers.
func (s *Service) HasAcceptedCurrent(ctx context.Context, userID string) (bool, error) {
	key := s.cacheKey(userID)
	if _, found, err := s.cache.Get(ctx, key); err != nil {
		s.logger.WarnContext(ctx, "reading the acceptance of the platform terms from Redis", slog.String(logKeyKey, key), slog.Any(logKeyError, err))
	} else if found {
		return true, nil
	}
	accepted, err := s.repo.accepted(ctx, userID, s.terms.Version)
	if err != nil || !accepted {
		return accepted, err
	}
	s.remember(ctx, key)

	return true, nil
}

func (s *Service) cacheKey(userID string) string {
	return fmt.Sprintf("platform-terms:accepted:%s:%d", userID, s.terms.Version)
}

func (s *Service) remember(ctx context.Context, key string) {
	if err := s.cache.Set(ctx, key, "1", acceptedTTL); err != nil {
		s.logger.WarnContext(ctx, "caching the acceptance of the platform terms in Redis", slog.String(logKeyKey, key), slog.Any(logKeyError, err))
	}
}

// Accept records the acceptance of the current version; any other version is refused, and accepting twice changes nothing.
func (s *Service) Accept(ctx context.Context, userID string, version int) (model.PlatformTermsStatus, error) {
	if version != s.terms.Version {
		return model.PlatformTermsStatus{}, apperr.WithCode(apperr.CodePlatformTermsVersionMismatch,
			fmt.Sprintf("The platform terms are at version %d, not %d. Reload them before accepting.", s.terms.Version, version))
	}
	if err := s.repo.accept(ctx, userID, version); err != nil {
		return model.PlatformTermsStatus{}, err
	}
	s.remember(ctx, s.cacheKey(userID))

	return s.Status(ctx, userID)
}

// NotAccepted is the error for a writer who has not accepted the current terms.
func NotAccepted() error {
	return apperr.WithCode(apperr.CodePlatformTermsNotAccepted, "You must accept the current platform terms first")
}
