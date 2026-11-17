package license

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

const (
	syncEvery      = time.Hour
	syncRetryAfter = 30 * time.Second
	syncTimeout    = time.Minute
)

// KeepCanonicalSynced stores the licenses Fithara offers as the shared canonical licenses, now and every hour, until ctx ends. A failed round is tried again soon: Fithara may still be starting. A license Fithara stops offering stays stored, novels use it.
func (s *Service) KeepCanonicalSynced(ctx context.Context) {
	wait := time.Duration(0)
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
		wait = syncEvery
		if err := s.syncCanonical(ctx); err != nil {
			s.logger.WarnContext(
				ctx,
				"storing the canonical licenses of Fithara",
				slog.Any(logKeyError, err),
			)
			wait = syncRetryAfter
		}
	}
}

// syncCanonical upserts every license of the registry; one that fails does not stop the others.
func (s *Service) syncCanonical(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, syncTimeout)
	defer cancel()
	listed, err := s.fitharaClient.ListLicensesV1LicensesGetWithResponse(ctx)
	if err != nil {
		return fmt.Errorf("listing the licenses: %w", err)
	}
	if listed.JSON200 == nil {
		return fmt.Errorf(
			"listing the licenses: %w: %d",
			errUnexpectedStatus,
			listed.StatusCode(),
		)
	}
	var failures []error
	for _, offered := range listed.JSON200.Licenses {
		canonical, status, err := s.readCanonical(ctx, offered.Id)
		if err == nil && canonical == nil {
			err = fmt.Errorf("%w: %d", errUnexpectedStatus, status)
		}
		if err == nil {
			err = s.repo.upsertCanonical(ctx, storedCanonical(canonical))
		}
		if err != nil {
			failures = append(failures, fmt.Errorf("%s: %w", offered.Id, err))
		}
	}

	return errors.Join(failures...)
}

func storedCanonical(canonical *fithara.LicenseDetail) stored {
	return stored{
		Name:        canonical.ShortName,
		Text:        NormalizeText(canonical.Body),
		TextHash:    TextHash(canonical.Body),
		OwnerID:     SystemOwner,
		SourceType:  entlicense.SourceTypeCANONICAL,
		CanonicalID: &canonical.Id,
		Metadata: &canonicalMetadata{
			Version:     canonical.Version,
			OfficialURL: canonical.OfficialUrl,
		},
	}
}
