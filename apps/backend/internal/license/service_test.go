package license_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
)

func codeOf(err error) string {
	var coded interface{ Code() string }
	if !errors.As(err, &coded) {
		return ""
	}

	return coded.Code()
}

func TestScopeOf(t *testing.T) {
	cases := []struct {
		name  string
		found *ent.License
		want  model.LicenseScope
	}{
		{"a draft of a writer", &ent.License{IsDraft: true, OwnerID: "310437862211387398"}, model.LicenseScopeDraft},
		{"a license of the platform", &ent.License{OwnerID: license.SystemOwner}, model.LicenseScopeShared},
		{"a license of a writer", &ent.License{OwnerID: "310437862211387398"}, model.LicenseScopePersonal},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := license.ScopeOf(c.found)

			if result != c.want {
				t.Errorf("scope = %s, want %s", result, c.want)
			}
		})
	}
}

// These rules decide before the database is asked, so the service needs neither a client nor Fithara.
func TestServiceRefusesBeforeAskingTheDatabase(t *testing.T) {
	ctx := context.Background()
	licenseID := uuid.MustParse("a8f0c7e2-5d3b-4f6a-9c1e-2b7d84e0f913")
	text := "You may read this novel. You may not copy it."
	writer := auth.Viewer{Subject: "310437862211387398", Roles: []string{"writer"}}
	custom := model.LicenseInput{Name: "Read it, do not copy it", Text: text, SourceType: entlicense.SourceTypeCUSTOM}
	canonicalID := "CC-BY-4.0"
	uut := license.NewService(nil, nil, slog.New(slog.DiscardHandler))

	cases := []struct {
		name     string
		act      func() error
		wantCode string
	}{
		{"a name that is blank", func() error {
			_, err := uut.GetOrCreate(ctx, model.LicenseInput{Name: "  ", Text: text, SourceType: entlicense.SourceTypeCUSTOM}, writer.Subject)

			return err
		}, apperr.CodeBadRequest},
		{"a text that is blank", func() error {
			_, err := uut.GetOrCreate(ctx, model.LicenseInput{Name: "Mine", Text: " \n ", SourceType: entlicense.SourceTypeCUSTOM}, writer.Subject)

			return err
		}, apperr.CodeBadRequest},
		{"a draft from a license and a canonical license", func() error {
			_, err := uut.CreateDraft(ctx, writer.Subject, model.CreateLicenseDraftInput{LicenseID: &licenseID, CanonicalID: &canonicalID})

			return err
		}, apperr.CodeBadRequest},
		{"a writer who stores a shared license", func() error {
			_, err := uut.Create(ctx, writer, custom)

			return err
		}, apperr.CodeForbidden},
		{"a writer who changes the default", func() error {
			_, err := uut.SetDefault(ctx, writer, licenseID)

			return err
		}, apperr.CodeForbidden},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.act()

			if got := codeOf(err); got != c.wantCode {
				t.Errorf("error = %v (code %q), want code %q", err, got, c.wantCode)
			}
		})
	}
}
