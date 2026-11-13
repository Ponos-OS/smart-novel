package tag

import (
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// Input is what requestTag and createTag take; the schema directives on the input types have cleaned and checked it.
type Input struct {
	Name        string
	Description string
}

// Update is what updateTag takes; a nil field stays as it is.
type Update struct {
	Name        *string
	Description *string
}

// RequireChange refuses an update that changes nothing.
func (u Update) RequireChange() error {
	if u.Name == nil && u.Description == nil {
		return apperr.BadRequest("Provide a name, a description or both")
	}

	return nil
}
