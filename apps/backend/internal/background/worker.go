package background

import (
	"context"

	"go.uber.org/fx"
)

// Keep runs work from the start of the application until its stop: the context it gets ends when the application stops, and the stop waits for work to return.
func Keep(lc fx.Lifecycle, work func(ctx context.Context)) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			go func() {
				defer close(done)
				work(ctx)
			}()

			return nil
		},
		OnStop: func(stopCtx context.Context) error {
			cancel()
			select {
			case <-done:
				return nil
			case <-stopCtx.Done():
				return stopCtx.Err()
			}
		},
	})
}
