package narration

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

// Beatrice's own words for how far a job is. Only the first two decide anything here; the others are the stages known today, and any other is
// treated as one of them, because a stage Beatrice invents later must not break the narration.
const (
	statusCompleted = "completed"
	statusFailed    = "failed"

	logKeyProgress = "progress"

	progressKeepFor = 2 * lockTTL
	sweepEvery      = time.Minute
)

var transientStatuses = map[string]bool{"queued": true, "generating": true, "uploading": true}

func isTerminal(status string) bool {
	return status == statusCompleted || status == statusFailed
}

func isKnown(status string) bool {
	return isTerminal(status) || transientStatuses[status]
}

type jobProgress struct {
	lastSeen int
	terminal bool
	// ended is the terminal status, completed or failed, when terminal.
	ended string
	at    time.Time
}

// progressBook remembers, per job, how far the updates have come, so that one arriving out of order is dropped. Beatrice's queued and
// generating callbacks race each other over the network, and progress only means a bigger number is later for this job. It lives in the
// memory of the replica, like the lock tokens do, and forgets a job when its updates cannot come any more.
type progressBook struct {
	mutex     sync.Mutex
	jobs      map[string]jobProgress
	nextSweep time.Time
}

func newProgressBook() *progressBook {
	return &progressBook{jobs: make(map[string]jobProgress)}
}

// apply says whether the update is news. After a terminal update every later one is dropped, whatever made it late; the terminal mark stays
// so that a late retry of an earlier stage does not look like a new job.
func (b *progressBook) apply(ctx context.Context, update ttscallbacks.Update, now time.Time, logger *slog.Logger) bool {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	b.sweep(now)
	seen := b.jobs[update.JobID]
	if seen.terminal {
		logger.DebugContext(ctx, "dropping an update after the job ended", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status))

		return false
	}
	if isTerminal(update.Status) {
		b.jobs[update.JobID] = jobProgress{lastSeen: seen.lastSeen, terminal: true, ended: update.Status, at: now}

		return true
	}
	if update.Progress == nil {
		return true
	}
	if *update.Progress <= seen.lastSeen {
		logger.DebugContext(ctx, "dropping a stale update", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status), slog.Int(logKeyProgress, *update.Progress))

		return false
	}
	b.jobs[update.JobID] = jobProgress{lastSeen: *update.Progress, at: now}

	return true
}

// endedWith is the terminal status of the job when it ended already. A job can end before the code that started it has written it down.
func (b *progressBook) endedWith(jobID string) (status string, ended bool) {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	seen := b.jobs[jobID]

	return seen.ended, seen.terminal
}

func (b *progressBook) sweep(now time.Time) {
	if now.Before(b.nextSweep) {
		return
	}
	for id, seen := range b.jobs {
		if now.Sub(seen.at) > progressKeepFor {
			delete(b.jobs, id)
		}
	}
	b.nextSweep = now.Add(sweepEvery)
}
