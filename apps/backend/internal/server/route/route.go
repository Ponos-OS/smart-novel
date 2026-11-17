// Package route lets a package contribute an endpoint to the server without importing it.
package route

import (
	"net/http"

	"go.uber.org/fx"
)

// Group is the tag of the value group the server reads its routes from.
const Group = `group:"routes"`

// Route is an endpoint other services call, by "METHOD /path". Each checks its own caller, so none needs a viewer.
type Route struct {
	Pattern string
	Handler http.Handler
}

// Provide makes a constructor of a Route one the server serves.
func Provide(constructor any) any {
	return fx.Annotate(constructor, fx.ResultTags(Group))
}
