package narration

import (
	"log/slog"
	"testing"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

const jobID = "2bce49d6-6592-4ed3-b421-f913b9ecc3bd"

func update(status string, progress int) ttscallbacks.Update {
	result := ttscallbacks.Update{JobID: jobID, Status: status}
	if progress > 0 {
		result.Progress = &progress
	}

	return result
}

func TestProgressBookDropsWhatArrivesOutOfOrder(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	logger := slog.New(slog.DiscardHandler)
	uut := newProgressBook()

	generating := uut.apply(t.Context(), update("generating", 2), now, logger)
	staleQueued := uut.apply(t.Context(), update("queued", 1), now, logger)
	sameAgain := uut.apply(t.Context(), update("generating", 2), now, logger)
	uploading := uut.apply(t.Context(), update("uploading", 3), now, logger)

	if !generating || staleQueued || sameAgain || !uploading {
		t.Errorf("generating %v, stale queued %v, same again %v, uploading %v; want true, false, false, true", generating, staleQueued, sameAgain, uploading)
	}
}

func TestProgressBookDropsEverythingAfterTheEnd(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	logger := slog.New(slog.DiscardHandler)
	uut := newProgressBook()
	uut.apply(t.Context(), update("generating", 2), now, logger)

	completed := uut.apply(t.Context(), update("completed", 0), now, logger)
	retry := uut.apply(t.Context(), update("uploading", 5), now, logger)
	failedLater := uut.apply(t.Context(), update("failed", 0), now, logger)

	if !completed || retry || failedLater {
		t.Errorf("completed %v, retry %v, failed later %v; want true, false, false", completed, retry, failedLater)
	}
}

func TestProgressBookLetsAnUpdateWithoutProgressThrough(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	uut := newProgressBook()

	first := uut.apply(t.Context(), update("queued", 0), time.Now(), logger)
	second := uut.apply(t.Context(), update("queued", 0), time.Now(), logger)

	if !first || !second {
		t.Errorf("first %v, second %v; want true, true", first, second)
	}
}

func TestProgressBookForgetsAJobWhenNoUpdateCanComeAnyMore(t *testing.T) {
	start := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	logger := slog.New(slog.DiscardHandler)
	uut := newProgressBook()
	uut.apply(t.Context(), update("completed", 0), start, logger)

	uut.apply(t.Context(), update("queued", 1), start.Add(progressKeepFor+sweepEvery+time.Second), logger)

	if _, remembered := uut.jobs[jobID]; remembered && uut.jobs[jobID].terminal {
		t.Error("the ended job is still remembered long after it could have been heard from")
	}
}

func TestIsKnown(t *testing.T) {
	for status, want := range map[string]bool{"queued": true, "generating": true, "uploading": true, "completed": true, "failed": true, "transcoding": false} {
		if got := isKnown(status); got != want {
			t.Errorf("isKnown(%q) = %v, want %v", status, got, want)
		}
	}
}

func TestProgressBookSaysHowAJobEnded(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	uut := newProgressBook()
	_, endedBefore := uut.endedWith(jobID)
	uut.apply(t.Context(), update("generating", 2), time.Now(), logger)
	_, endedWhileRunning := uut.endedWith(jobID)

	uut.apply(t.Context(), update("completed", 0), time.Now(), logger)
	status, ended := uut.endedWith(jobID)

	if endedBefore || endedWhileRunning || !ended || status != "completed" {
		t.Errorf("ended before %v, while running %v, after %v with %q; want false, false, true, completed", endedBefore, endedWhileRunning, ended, status)
	}
}
