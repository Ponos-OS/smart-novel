package auth

import (
	"fmt"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// Can holds the permission rules. Roles rank admin > writer > user (see role.go).
// A novel is owned by its writer's user ID, a chapter belongs to the owner of its novel, and the callers look that ID up.

type Action string

const (
	Create Action = "create"
	Update Action = "update"
	Delete Action = "delete"
)

// Resource is implemented only by the types below, so Can cannot be called with anything else.
type Resource interface{ noun() string }

// Novel is the novel being acted on; leave OwnerUserID empty for Create.
type Novel struct{ OwnerUserID string }

// Chapter is a chapter, identified for the rules by the owner of the novel it belongs to (also for Create).
type Chapter struct{ NovelOwnerUserID string }

// License is a shared license.
type License struct{}

func (Novel) noun() string   { return "novel" }
func (Chapter) noun() string { return "chapter" }
func (License) noun() string { return "license" }

// DenyUnlessCan stops when the answer Can returns false.
// Returns the FORBIDDEN error, or nil.
// Call this one, so a refusal always reads the same.
func DenyUnlessCan(viewer Viewer, action Action, resource Resource) error {
	if Can(viewer, action, resource) {
		return nil
	}

	return &Error{
		code:    apperr.CodeForbidden,
		message: fmt.Sprintf("You do not have permission to %s this %s", action, resource.noun()),
	}
}

// Can reports whether viewer may perform action on resource. Admins may do anything; unknown combinations are denied.
func Can(viewer Viewer, action Action, resource Resource) bool {
	if viewer.IsAdmin() {
		return true
	}

	switch resource := resource.(type) {
	case Novel:
		if action == Create {
			return viewer.IsWriterOrHigher()
		}

		return isOwningWriter(viewer, resource.OwnerUserID)
	case Chapter:
		return isOwningWriter(viewer, resource.NovelOwnerUserID)
	}

	return false
}

func isOwningWriter(viewer Viewer, ownerUserID string) bool {
	return viewer.IsWriterOrHigher() && viewer.Subject == ownerUserID
}
