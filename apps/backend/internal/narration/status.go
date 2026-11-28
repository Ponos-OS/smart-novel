package narration

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

// Beatrice's own words for how far a job is. Only the first two decide anything here; the others are the stages known today, and any other is
// treated as one of them, because a stage Beatrice invents later must not break the narration.
const (
	statusCompleted = "completed"
	statusFailed    = "failed"

	// progressKeepFor is how long Redis remembers how far a job came: as long as an update of it may still arrive.
	progressKeepFor = 2 * lockTTL
)

func isTerminal(status string) bool {
	return status == statusCompleted || status == statusFailed
}

func isKnown(status string) bool {
	return isTerminal(status) || isTransient(status)
}

func isTransient(status string) bool {
	switch status {
	case "queued", "generating", "uploading":
		return true
	default:
		return false
	}
}

func progressKey(jobID string) string {
	return "chapter_tts_progress:" + jobID
}

// endedKey holds the terminal update of a job, completed or failed, so the first one wins and everything after it is dropped.
func endedKey(jobID string) string {
	return "chapter_tts_ended:" + jobID
}

// isNews says whether the update is news for its job, so that one arriving out of order is dropped: Beatrice's queued and generating callbacks race each other over the network, and progress only means a bigger number is later for this job. After a terminal update every later one is dropped, whatever made it late. Any replica may be the one called, so what each job has shown lives in Redis.
func (s *Service) isNews(
	ctx context.Context,
	update ttscallbacks.Update,
) (bool, error) {
	if isTerminal(update.Status) {
		ended, err := json.Marshal(update)
		if err != nil {
			return false, fmt.Errorf("keeping how a job ended: %w", err)
		}

		return s.cache.SetIfAbsent(
			ctx,
			endedKey(update.JobID),
			string(ended),
			progressKeepFor,
		)
	}
	_, ended, err := s.cache.Get(ctx, endedKey(update.JobID))
	if err != nil || ended {
		return false, err
	}
	if update.Progress == nil {
		return true, nil
	}

	return s.cache.RaiseTo(
		ctx,
		progressKey(update.JobID),
		*update.Progress,
		progressKeepFor,
	)
}

// endedWith is the terminal update of the job when it ended already. A job can end before the code that started it has written it down.
func (s *Service) endedWith(
	ctx context.Context,
	jobID string,
) (update ttscallbacks.Update, ended bool, err error) {
	stored, ended, err := s.cache.Get(ctx, endedKey(jobID))
	if err != nil || !ended {
		return update, false, err
	}
	if err = json.Unmarshal([]byte(stored), &update); err != nil {
		return update, false, fmt.Errorf("reading how a job ended: %w", err)
	}

	return update, true, nil
}
