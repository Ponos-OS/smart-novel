package model

import "github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"

// RequireChange refuses an update that changes nothing.
func (u UpdateTagInput) RequireChange() error {
	if u.Name == nil && u.Description == nil {
		return apperr.BadRequest("Provide a name, a description or both")
	}

	return nil
}
