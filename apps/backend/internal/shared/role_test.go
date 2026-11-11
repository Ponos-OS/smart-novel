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

func loadRoleCases(t *testing.T) roleCases {
	t.Helper()
	raw, err := os.ReadFile("../../../../spec/cases/role.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases roleCases
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}

	return cases
}

func TestHasMinimumRole(t *testing.T) {
	for _, c := range loadRoleCases(t).HasMinimumRole {
		if got := shared.HasMinimumRole(c.Roles, shared.Role(c.Minimum)); got != c.Expected {
			t.Errorf("HasMinimumRole(%v, %s) = %v, want %v", c.Roles, c.Minimum, got, c.Expected)
		}
	}
}

func TestIsAdmin(t *testing.T) {
	for _, c := range loadRoleCases(t).IsAdmin {
		if got := shared.IsAdmin(c.Roles); got != c.Expected {
			t.Errorf("IsAdmin(%v) = %v, want %v", c.Roles, got, c.Expected)
		}
	}
}

func TestIsWriterOrHigher(t *testing.T) {
	for _, c := range loadRoleCases(t).IsWriterOrHigher {
		if got := shared.IsWriterOrHigher(c.Roles); got != c.Expected {
			t.Errorf("IsWriterOrHigher(%v) = %v, want %v", c.Roles, got, c.Expected)
		}
	}
}
