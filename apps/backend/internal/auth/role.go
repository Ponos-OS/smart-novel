package auth

import "slices"

// Role is an application role.
type Role string

const (
	RoleAdmin  Role = "admin"
	RoleWriter Role = "writer"
	RoleUser   Role = "user"
)

// rank is 0 for a name that is not a role. A higher role has every privilege of the lower ones.
func rank(role Role) int {
	ascending := []Role{RoleUser, RoleWriter, RoleAdmin}

	return slices.Index(ascending, role) + 1
}

// IsAdmin tells whether the viewer holds the admin role.
func (v Viewer) IsAdmin() bool {
	return slices.Contains(v.Roles, string(RoleAdmin))
}

// HasMinimumRole tells whether the viewer holds minimum or a higher role.
func (v Viewer) HasMinimumRole(minimum Role) bool {
	highest := 0
	for _, name := range v.Roles {
		highest = max(highest, rank(Role(name)))
	}

	return highest >= rank(minimum)
}

// IsWriterOrHigher tells whether the viewer may write.
func (v Viewer) IsWriterOrHigher() bool {
	return v.HasMinimumRole(RoleWriter)
}
