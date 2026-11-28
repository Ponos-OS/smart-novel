package node

import "go.uber.org/fx"

func Module() fx.Option {
	return fx.Module("node", fx.Provide(NewService))
}
