package license

import (
	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
)

// Scope narrows a list of licenses to who they belong to and whether they are finished.
type Scope string

const (
	// ScopeShared is a license of the platform, any writer may use it.
	ScopeShared Scope = "SHARED"
	// ScopePersonal was finalized by a writer and is private to them.
	ScopePersonal Scope = "PERSONAL"
	// ScopeDraft is still being worked on.
	ScopeDraft Scope = "DRAFT"
)

// SystemOwner owns the canonical and default licenses; they are shared by everybody. Every other license belongs to the writer who made it.
const SystemOwner = "system"

// ScopeOf says which scope a stored license has.
func ScopeOf(found *ent.License) Scope {
	if found.IsDraft {
		return ScopeDraft
	}
	if found.OwnerID == SystemOwner {
		return ScopeShared
	}

	return ScopePersonal
}
