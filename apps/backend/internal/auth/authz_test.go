package auth_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
)

const (
	ownerID    = "d4b0c2de-6c1a-4a53-8f0e-2b6d4a1d9a10"
	strangerID = "7f3e0a52-5b0f-4b1e-9d58-0c5a8a7f6b21"
)

func viewerWith(subject string, roles ...string) auth.Viewer {
	return auth.Viewer{Subject: subject, Roles: roles}
}

func TestCan(t *testing.T) {
	cases := []struct {
		name     string
		viewer   auth.Viewer
		action   auth.Action
		resource auth.Resource
		want     bool
	}{
		{"user creates a novel", viewerWith(ownerID, "user"), auth.Create, auth.Novel{}, false},
		{"no role creates a novel", viewerWith(ownerID), auth.Create, auth.Novel{}, false},
		{"writer creates a novel", viewerWith(ownerID, "writer"), auth.Create, auth.Novel{}, true},
		{"admin creates a novel", viewerWith(ownerID, "admin"), auth.Create, auth.Novel{}, true},

		{"user updates a novel they own", viewerWith(ownerID, "user"), auth.Update, auth.Novel{OwnerUserID: ownerID}, false},
		{"writer updates their novel", viewerWith(ownerID, "writer"), auth.Update, auth.Novel{OwnerUserID: ownerID}, true},
		{"writer updates another's novel", viewerWith(strangerID, "writer"), auth.Update, auth.Novel{OwnerUserID: ownerID}, false},
		{"writer deletes their novel", viewerWith(ownerID, "writer"), auth.Delete, auth.Novel{OwnerUserID: ownerID}, true},
		{"writer deletes another's novel", viewerWith(strangerID, "writer"), auth.Delete, auth.Novel{OwnerUserID: ownerID}, false},
		{"admin updates another's novel", viewerWith(strangerID, "admin"), auth.Update, auth.Novel{OwnerUserID: ownerID}, true},
		{"user and writer roles update their novel", viewerWith(ownerID, "user", "writer"), auth.Update, auth.Novel{OwnerUserID: ownerID}, true},
		{"no role updates a novel they own", viewerWith(ownerID), auth.Update, auth.Novel{OwnerUserID: ownerID}, false},

		{"writer creates a chapter in their novel", viewerWith(ownerID, "writer"), auth.Create, auth.Chapter{NovelOwnerUserID: ownerID}, true},
		{"writer creates a chapter in another's novel", viewerWith(strangerID, "writer"), auth.Create, auth.Chapter{NovelOwnerUserID: ownerID}, false},
		{"user creates a chapter in a novel they own", viewerWith(ownerID, "user"), auth.Create, auth.Chapter{NovelOwnerUserID: ownerID}, false},
		{"writer updates a chapter of another's novel", viewerWith(strangerID, "writer"), auth.Update, auth.Chapter{NovelOwnerUserID: ownerID}, false},
		{"writer deletes a chapter of their novel", viewerWith(ownerID, "writer"), auth.Delete, auth.Chapter{NovelOwnerUserID: ownerID}, true},
		{"admin deletes a chapter of another's novel", viewerWith(strangerID, "admin"), auth.Delete, auth.Chapter{NovelOwnerUserID: ownerID}, true},

		{"user creates a license", viewerWith(ownerID, "user"), auth.Create, auth.License{}, false},
		{"writer updates a license", viewerWith(ownerID, "writer"), auth.Update, auth.License{}, false},
		{"admin creates a license", viewerWith(ownerID, "admin"), auth.Create, auth.License{}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := auth.Can(c.viewer, c.action, c.resource)

			if got != c.want {
				t.Errorf("Can = %v, want %v", got, c.want)
			}
		})
	}
}

func TestDenyUnlessCan(t *testing.T) {
	writer := viewerWith(strangerID, "writer")

	allowed := auth.DenyUnlessCan(writer, auth.Create, auth.Novel{})
	denied := auth.DenyUnlessCan(writer, auth.Update, auth.Novel{OwnerUserID: ownerID})

	if allowed != nil {
		t.Errorf("allowed = %v, want nil", allowed)
	}
	var forbidden *auth.Error
	if !errors.As(denied, &forbidden) || forbidden.Code() != shared.Forbidden {
		t.Fatalf("denied = %v, want a forbidden error", denied)
	}
	if want := "You do not have permission to update this novel"; forbidden.Error() != want {
		t.Errorf("message = %q, want %q", forbidden.Error(), want)
	}
}
