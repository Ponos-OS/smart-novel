package shared_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
)

type roleCases struct {
	HasMinimumRole []struct {
		Roles    []string `json:"roles"`
		Minimum  string   `json:"minimum"`
		Expected bool     `json:"expected"`
	} `json:"hasMinimumRole"`
	IsAdmin          []rolesExpectation `json:"isAdmin"`
	IsWriterOrHigher []rolesExpectation `json:"isWriterOrHigher"`
}

type rolesExpectation struct {
	Roles    []string `json:"roles"`
	Expected bool     `json:"expected"`
}

func TestRoleHelpers(t *testing.T) {
	raw, err := os.ReadFile("../../../../spec/cases/role.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases roleCases
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}

	t.Run("HasMinimumRole", func(t *testing.T) {
		for _, c := range cases.HasMinimumRole {
			if got := shared.HasMinimumRole(c.Roles, shared.Role(c.Minimum)); got != c.Expected {
				t.Errorf("HasMinimumRole(%v, %s) = %v, want %v", c.Roles, c.Minimum, got, c.Expected)
			}
		}
	})

	t.Run("IsAdmin", func(t *testing.T) {
		for _, c := range cases.IsAdmin {
			if got := shared.IsAdmin(c.Roles); got != c.Expected {
				t.Errorf("IsAdmin(%v) = %v, want %v", c.Roles, got, c.Expected)
			}
		}
	})

	t.Run("IsWriterOrHigher", func(t *testing.T) {
		for _, c := range cases.IsWriterOrHigher {
			if got := shared.IsWriterOrHigher(c.Roles); got != c.Expected {
				t.Errorf("IsWriterOrHigher(%v) = %v, want %v", c.Roles, got, c.Expected)
			}
		}
	})
}
