package platformterms

import "go.uber.org/fx"

func Module() fx.Option {
	return fx.Module(
		"platformterms",
		fx.Provide(
			Current,
			NewService,
			func(service *Service) Acceptances { return service },
		),
	)
}
