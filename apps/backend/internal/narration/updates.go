package narration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	entchapter "github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

// Event is what a subscriber of a chapter hears about its narration.
type Event struct {
	Status entchapter.NarrationStatus
	// NarrationURL is the audio address, once the status is READY.
	NarrationURL *string
	Error        *string
	// Stage is Beatrice's own word for how far the job is, while the status is PROCESSING.
	Stage *string
}

// eventsChannel is where a replica announces what it learned about a narration, and every replica hears it, so the subscriber of a chapter is told whichever replica holds its connection.
const eventsChannel = "chapter-narration:events"

type notice struct {
	ChapterID uuid.UUID
	Event     Event
}

// subscriberBuffer is how many events a slow subscriber may be behind before it misses some; a job reports a handful.
const subscriberBuffer = 16

// Subscribe returns the events of the narration of a chapter, as this replica hears them, until ctx ends.
func (s *Service) Subscribe(ctx context.Context, chapterID uuid.UUID) <-chan *Event {
	events := make(chan *Event, subscriberBuffer)
	s.mutex.Lock()
	if s.subscribers[chapterID] == nil {
		s.subscribers[chapterID] = make(map[chan *Event]struct{})
	}
	s.subscribers[chapterID][events] = struct{}{}
	s.mutex.Unlock()

	go func() {
		<-ctx.Done()
		s.mutex.Lock()
		defer s.mutex.Unlock()
		delete(s.subscribers[chapterID], events)
		if len(s.subscribers[chapterID]) == 0 {
			delete(s.subscribers, chapterID)
		}
		close(events)
	}()

	return events
}

// deliver hands an event to the subscribers of this replica.
func (s *Service) deliver(ctx context.Context, chapterID uuid.UUID, event *Event) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	for events := range s.subscribers[chapterID] {
		select {
		case events <- event:
		default:
			s.logger.WarnContext(ctx, "a subscriber is too slow, it misses an update", slog.String(logKeyChapterID, chapterID.String()))
		}
	}
}

// report tells the subscribers of the chapter what an update of Beatrice means. A job that ended well is reported only once its audio address is kept, and a failure only once the chapter is marked, so a subscriber never hears what the chapter does not have. The error is for what could not be kept.
func (s *Service) report(ctx context.Context, chapterID uuid.UUID, update ttscallbacks.Update) error {
	switch update.Status {
	case statusCompleted:
		url, kept, err := s.keepAudio(ctx, chapterID, update.JobID)
		if err != nil || !kept {
			return err
		}
		s.announce(ctx, chapterID, &Event{Status: entchapter.NarrationStatusREADY, NarrationURL: &url})
	case statusFailed:
		s.logger.ErrorContext(ctx, "Beatrice could not narrate a chapter", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, update.JobID), slog.String(logKeyFailure, failure(update)))
		started, err := s.startedFor(ctx, chapterID, update.JobID)
		if err != nil || !started {
			return err
		}
		if err = s.repo.setStatus(ctx, chapterID, entchapter.NarrationStatusFAILED); err != nil {
			return fmt.Errorf("marking a chapter as not narrated: %w", err)
		}
		s.announce(ctx, chapterID, &Event{Status: entchapter.NarrationStatusFAILED, Error: errorOf(update)})
	default:
		s.announce(ctx, chapterID, &Event{Status: entchapter.NarrationStatusPROCESSING, Stage: &update.Status})
	}

	return nil
}

// announce tells every replica, which hand the event to the subscribers they hold. Redis keeps nothing for who is not subscribed at that moment, and the update is handled already (its audio address kept, its lock released), so a failure is logged and nothing more. Only the audio address is stored, so a subscriber that missed an event can read that back from the chapter, not a stage or a failure.
func (s *Service) announce(ctx context.Context, chapterID uuid.UUID, event *Event) {
	message, err := json.Marshal(notice{ChapterID: chapterID, Event: *event})
	if err == nil {
		err = s.cache.Publish(ctx, eventsChannel, string(message))
	}
	if err != nil {
		s.logger.WarnContext(ctx, "announcing a narration event", slog.String(logKeyChapterID, chapterID.String()), slog.Any(logKeyError, err))
	}
}

func (s *Service) hear(ctx context.Context, message string) {
	var heard notice
	if err := json.Unmarshal([]byte(message), &heard); err != nil {
		s.logger.WarnContext(ctx, "a narration event is not valid", slog.Any(logKeyError, err))

		return
	}
	s.deliver(ctx, heard.ChapterID, &heard.Event)
}

func errorOf(update ttscallbacks.Update) *string {
	if update.Error == nil {
		return nil
	}
	text := update.Error.Code + ": " + update.Error.Message

	return &text
}

// RemoveAudio deletes the narrations a chapter or a novel had. It is meant to run inside the transaction that deletes their rows, so a failure rolls that back and the caller can delete again; deleting an object that is already gone is not an error. An address that is not in this bucket is left alone.
func (s *Service) RemoveAudio(ctx context.Context, urls ...string) error {
	var failures []error
	for _, url := range urls {
		key, ours := s.storage.KeyOf(url)
		if !ours {
			continue
		}
		if err := s.storage.Delete(ctx, key); err != nil {
			failures = append(failures, err)
		}
	}

	return errors.Join(failures...)
}
