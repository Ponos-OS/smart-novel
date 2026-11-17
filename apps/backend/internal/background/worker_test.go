package background_test

import (
	"context"
	"testing"
	"time"

	"go.uber.org/fx/fxtest"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/background"
)

func TestKeepRunsWorkUntilStopAndWaitsForIt(t *testing.T) {
	lifecycle := fxtest.NewLifecycle(t)
	started := make(chan struct{})
	finished := make(chan struct{})
	background.Keep(lifecycle, func(ctx context.Context) {
		close(started)
		<-ctx.Done()
		close(finished)
	})

	lifecycle.RequireStart()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("the work did not start")
	}
	lifecycle.RequireStop()

	select {
	case <-finished:
	default:
		t.Error("stop returned before the work did")
	}
}
