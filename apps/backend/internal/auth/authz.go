package auth

import "github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"

// Can holds the permission rules. Roles rank admin > writer > user (see shared.HasMinimumRole).
// A novel is owned by its writer's user ID, a chapter belongs to the owner of its novel, and the callers look that ID up.

type Action string

const (
	Create Action = "create"
	Update Action = "update"
	Delete Action = "delete"
)

// Resource is implemented only by the types below, so Can cannot be called with anything else.
type Resource interface{ resource() }

// Novel is the novel being acted on; leave OwnerUserID empty for Create.
type Novel struct{ OwnerUserID string }

// Chapter is a chapter, identified for the rules by the owner of the novel it belongs to (also for Create).
type Chapter struct{ NovelOwnerUserID string }

// License is a shared license.
type License struct{}

func (Novel) resource()   {}
func (Chapter) resource() {}
func (License) resource() {}

// Can reports whether viewer may perform action on resource. Admins may do anything; unknown combinations are denied.
func Can(viewer Viewer, action Action, resource Resource) bool {
	if shared.IsAdmin(viewer.Roles) {
		return true
	}

	switch resource := resource.(type) {
	case Novel:
		if action == Create {
			return shared.IsWriterOrHigher(viewer.Roles)
		}

		return isOwningWriter(viewer, resource.OwnerUserID)
	case Chapter:
		return isOwningWriter(viewer, resource.NovelOwnerUserID)
	}

	return false
}

func isOwningWriter(viewer Viewer, ownerUserID string) bool {
	return shared.IsWriterOrHigher(viewer.Roles) && viewer.Subject == ownerUserID
}
