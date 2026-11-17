// Package background runs work a mutation starts after its own write was committed. The work must neither hold the request up nor fail it, so it runs on its own, without the cancellation of the request, and what goes wrong in it is only logged.
package background

import (
	"context"
	"log/slog"
)

const (
	logKeyWork  = "work"
	logKeyPanic = "panic"
)

// Go runs work in the background. It keeps what the context of the request carries (the trace, the viewer) but not its cancellation, and a panic is logged and does not stop the program.
func Go(
	ctx context.Context,
	logger *slog.Logger,
	name string,
	work func(ctx context.Context),
) {
	detached := context.WithoutCancel(ctx)
	go func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.ErrorContext(
					detached,
					"background work panicked",
					slog.String(logKeyWork, name),
					slog.Any(logKeyPanic, recovered),
				)
			}
		}()
		work(detached)
	}()
}
