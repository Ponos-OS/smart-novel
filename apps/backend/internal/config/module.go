package config

import (
	"os"

	"go.uber.org/fx"
)

func Module() fx.Option {
	return fx.Module("config", fx.Provide(func() (Config, error) {
		return Load(os.LookupEnv)
	}))
}
