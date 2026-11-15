package license

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

const (
	officialURLsTTL   = time.Hour
	logKeyCanonicalID = "canonicalID"
	logKeyError       = "error"
)

var errUnexpectedStatus = errors.New("unexpected status")

// findCanonical returns nil when Fithara does not know the license or no longer offers it, and an unavailable error when it cannot be asked:
// a text must not be taken as canonical on a guess.
func (s *Service) findCanonical(ctx context.Context, canonicalID string) (*fithara.LicenseDetail, error) {
	response, err := s.fitharaClient.GetLicenseV1LicensesLicenseIdGetWithResponse(ctx, canonicalID)
	if err != nil {
		return nil, s.fitharaUnavailable(ctx, canonicalID, err)
	}
	switch {
	case response.JSON200 != nil:
		return response.JSON200, nil
	case response.StatusCode() == http.StatusNotFound, response.StatusCode() == http.StatusGone:
		return nil, nil //nolint:nilnil // Fithara does not know it, or no longer offers it
	}

	return nil, s.fitharaUnavailable(ctx, canonicalID, fmt.Errorf("%w: %d", errUnexpectedStatus, response.StatusCode()))
}

func (s *Service) fitharaUnavailable(ctx context.Context, canonicalID string, err error) error {
	s.logger.WarnContext(ctx, "reading a canonical license from Fithara", slog.String(logKeyCanonicalID, canonicalID), slog.Any(logKeyError, err))

	return apperr.Unavailable("The canonical license registry is not available right now. Try again later.")
}

// OfficialURL is the link to the authoritative text of a canonical license; empty when Fithara cannot say. It is only a link on a page, so a
// Fithara that cannot be reached gives an empty link instead of an error. The list of links is kept for an hour.
func (s *Service) OfficialURL(ctx context.Context, canonicalID string) string {
	if s.fitharaClient == nil {
		return ""
	}
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if time.Now().After(s.officialURLsExpireAt) {
		urls, err := s.loadOfficialURLs(ctx)
		if err != nil {
			s.logger.WarnContext(ctx, "listing the canonical licenses of Fithara", slog.Any(logKeyError, err))

			return ""
		}
		s.officialURLs, s.officialURLsExpireAt = urls, time.Now().Add(officialURLsTTL)
	}

	return s.officialURLs[canonicalID]
}

func (s *Service) loadOfficialURLs(ctx context.Context) (map[string]string, error) {
	response, err := s.fitharaClient.ListLicensesV1LicensesGetWithResponse(ctx)
	if err != nil {
		return nil, err
	}
	if response.JSON200 == nil {
		return nil, fmt.Errorf("%w: %d", errUnexpectedStatus, response.StatusCode())
	}
	urls := make(map[string]string, len(response.JSON200.Licenses))
	for _, offered := range response.JSON200.Licenses {
		urls[offered.Id] = offered.OfficialUrl
	}

	return urls, nil
}
