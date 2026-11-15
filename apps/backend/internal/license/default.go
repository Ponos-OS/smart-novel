package license

import (
	"context"
	_ "embed" // the text of the default license
	"fmt"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
)

const (
	defaultName        = "CC BY 4.0"
	defaultCanonicalID = "CC-BY-4.0"
)

//go:embed CC-BY-4.0.txt
var defaultText string

// EnsureDefault makes sure the platform has a default license, and stores CC BY 4.0 as one when it has none; createNovel fails without it.
// It runs at startup and is safe to run again, also from two programs at once. An admin's choice of another default is left as it is.
func (s *Service) EnsureDefault(ctx context.Context) (*ent.License, error) {
	current, err := s.repo.defaultLicense(ctx)
	if err == nil {
		return current, nil
	}
	if !ent.IsNotFound(err) {
		return nil, fmt.Errorf("looking for the default license: %w", err)
	}
	canonicalID := defaultCanonicalID
	text := stored{
		Name:        defaultName,
		Text:        NormalizeText(defaultText),
		TextHash:    TextHash(defaultText),
		OwnerID:     SystemOwner,
		SourceType:  entlicense.SourceTypeCANONICAL,
		CanonicalID: &canonicalID,
	}
	found, err := s.repo.byText(ctx, text.OwnerID, text.TextHash)
	if ent.IsNotFound(err) {
		found, err = s.repo.insert(ctx, text)
		if ent.IsConstraintError(err) {
			found, err = s.repo.byText(ctx, text.OwnerID, text.TextHash)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("storing the default license: %w", err)
	}

	return s.makeDefault(ctx, found.ID)
}
