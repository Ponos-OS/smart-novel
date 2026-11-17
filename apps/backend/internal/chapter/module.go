package chapter

import "go.uber.org/fx"

var Module = fx.Module("chapter", fx.Provide(NewService))
