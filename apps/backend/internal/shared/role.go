package shared

import "slices"

// HasMinimumRole reports whether the highest role among userRoles is at least minimum.
func HasMinimumRole(userRoles []string, minimum Role) bool {
	highest := 0
	for _, name := range userRoles {
		highest = max(highest, RoleHierarchy[Role(name)])
	}

	return highest >= RoleHierarchy[minimum]
}

func IsAdmin(userRoles []string) bool {
	return slices.Contains(userRoles, string(RoleAdmin))
}

func IsWriterOrHigher(userRoles []string) bool {
	return HasMinimumRole(userRoles, RoleWriter)
}
