package auth_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

func TestHasMinimumRole(t *testing.T) {
	cases := []struct {
		name    string
		roles   []string
		minimum auth.Role
		want    bool
	}{
		{
			"a writer is at least a user",
			[]string{"writer"},
			auth.RoleUser,
			true,
		},
		{"a user is not a writer", []string{"user"}, auth.RoleWriter, false},
		{
			"an admin is at least a writer",
			[]string{"admin"},
			auth.RoleWriter,
			true,
		},
		{
			"the highest of several roles counts",
			[]string{"user", "writer"},
			auth.RoleWriter,
			true,
		},
		{
			"a role nobody knows ranks nothing",
			[]string{"unknown-role"},
			auth.RoleUser,
			false,
		},
		{"no role is not a user", nil, auth.RoleUser, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			viewer := auth.Viewer{Roles: c.roles}

			if got := viewer.HasMinimumRole(c.minimum); got != c.want {
				t.Errorf(
					"HasMinimumRole(%s) with %v = %v, want %v",
					c.minimum,
					c.roles,
					got,
					c.want,
				)
			}
		})
	}
}

func TestIsAdmin(t *testing.T) {
	cases := []struct {
		name  string
		roles []string
		want  bool
	}{
		{"an admin", []string{"admin"}, true},
		{"a writer", []string{"writer"}, false},
		{"no role", nil, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			viewer := auth.Viewer{Roles: c.roles}

			if got := viewer.IsAdmin(); got != c.want {
				t.Errorf(
					"IsAdmin() with %v = %v, want %v",
					c.roles,
					got,
					c.want,
				)
			}
		})
	}
}

func TestIsWriterOrHigher(t *testing.T) {
	cases := []struct {
		name  string
		roles []string
		want  bool
	}{
		{"an admin", []string{"admin"}, true},
		{"a writer", []string{"writer"}, true},
		{"a user", []string{"user"}, false},
		{"no role", nil, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			viewer := auth.Viewer{Roles: c.roles}

			if got := viewer.IsWriterOrHigher(); got != c.want {
				t.Errorf(
					"IsWriterOrHigher() with %v = %v, want %v",
					c.roles,
					got,
					c.want,
				)
			}
		})
	}
}
