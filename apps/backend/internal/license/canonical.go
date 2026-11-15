package license

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

const (
	logKeyCanonicalID = "canonicalID"
	logKeyError       = "error"
	logKeyFitharaCode = "fitharaCode"
	logKeyRequestID   = "requestID"
)

var errUnexpectedStatus = errors.New("unexpected status")

// findCanonical returns nil when Fithara does not know the license or no longer offers it, and an unavailable error when it cannot be asked:
// a text must not be taken as canonical on a guess.
func (s *Service) findCanonical(ctx context.Context, canonicalID string) (*fithara.LicenseDetail, error) {
	canonical, status, err := s.readCanonical(ctx, canonicalID)
	if err != nil {
		return nil, s.fitharaUnavailable(ctx, canonicalID, err)
	}
	if canonical == nil && (status == http.StatusNotFound || status == http.StatusGone) {
		return nil, nil //nolint:nilnil // Fithara does not know it, or no longer offers it
	}
	if canonical == nil {
		return nil, s.fitharaUnavailable(ctx, canonicalID, fmt.Errorf("%w: %d", errUnexpectedStatus, status))
	}

	return canonical, nil
}

// readCanonical gives the license, or the status Fithara answered with when it has none to give.
func (s *Service) readCanonical(ctx context.Context, canonicalID string) (*fithara.LicenseDetail, int, error) {
	response, err := s.fitharaClient.GetLicenseV1LicensesLicenseIdGetWithResponse(ctx, canonicalID)
	if err != nil {
		return nil, 0, err
	}

	return response.JSON200, response.StatusCode(), nil
}

func (s *Service) fitharaUnavailable(ctx context.Context, canonicalID string, err error) error {
	s.logger.WarnContext(ctx, "reading a canonical license from Fithara", slog.String(logKeyCanonicalID, canonicalID), slog.Any(logKeyError, err))

	return apperr.Unavailable("The canonical license registry is not available right now. Try again later.")
}

func (s *Service) assistantUnavailable(ctx context.Context, err error) error {
	s.logger.WarnContext(ctx, "asking Fithara", slog.Any(logKeyError, err))

	return apperr.Unavailable("The license assistant is not available right now. Try again later.")
}
