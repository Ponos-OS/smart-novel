package license

import (
	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

// SystemOwner owns the canonical and default licenses; they are shared by everybody. Every other license belongs to the writer who made it.
const SystemOwner = "system"

// ScopeOf says which scope a stored license has.
func ScopeOf(found *ent.License) model.LicenseScope {
	if found.IsDraft {
		return model.LicenseScopeDraft
	}
	if found.OwnerID == SystemOwner {
		return model.LicenseScopeShared
	}

	return model.LicenseScopePersonal
}
