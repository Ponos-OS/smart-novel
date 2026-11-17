package node

import "go.uber.org/fx"

var Module = fx.Module("node", fx.Provide(NewService))
