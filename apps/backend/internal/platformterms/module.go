package platformterms

import "go.uber.org/fx"

var Module = fx.Module(
	"platformterms",
	fx.Provide(
		Current,
		NewService,
		func(service *Service) Acceptances { return service },
	),
)
