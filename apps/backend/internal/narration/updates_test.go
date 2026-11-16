package narration

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"

	entchapter "github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

func newHub() *Service {
	return &Service{logger: slog.New(slog.DiscardHandler), subscribers: make(map[uuid.UUID]map[chan *model.ChapterNarrationEvent]struct{})}
}

func TestSubscribersHearOnlyTheirChapter(t *testing.T) {
	uut := newHub()
	mine, other := uuid.New(), uuid.New()
	events := uut.Subscribe(t.Context(), mine)

	uut.deliver(t.Context(), other, &model.ChapterNarrationEvent{Status: entchapter.NarrationStatusFAILED})
	uut.deliver(t.Context(), mine, &model.ChapterNarrationEvent{Status: entchapter.NarrationStatusPROCESSING})

	got := <-events
	if got.Status != entchapter.NarrationStatusPROCESSING || len(events) != 0 {
		t.Errorf("got %v with %d more waiting, want PROCESSING and none", got.Status, len(events))
	}
}

func TestSubscribeEndsWithItsContext(t *testing.T) {
	uut := newHub()
	chapterID := uuid.New()
	ctx, cancel := context.WithCancel(t.Context())
	events := uut.Subscribe(ctx, chapterID)

	cancel()

	select {
	case _, open := <-events:
		if open {
			t.Error("got an event, want the channel closed")
		}
	case <-time.After(time.Second):
		t.Fatal("the channel stayed open after the context ended")
	}
}

func TestDeliverSkipsASubscriberThatIsFull(t *testing.T) {
	uut := newHub()
	chapterID := uuid.New()
	events := uut.Subscribe(t.Context(), chapterID)

	for range subscriberBuffer + 1 {
		uut.deliver(t.Context(), chapterID, &model.ChapterNarrationEvent{Status: entchapter.NarrationStatusPROCESSING})
	}

	if len(events) != subscriberBuffer {
		t.Errorf("%d waiting, want %d", len(events), subscriberBuffer)
	}
}

func TestErrorOfJoinsTheCodeAndTheMessage(t *testing.T) {
	failed := ttscallbacks.Update{Status: statusFailed, Error: &ttscallbacks.UpdateError{Code: "TTS_PROVIDER_ERROR", Message: "quota exceeded"}}

	result := errorOf(failed)
	none := errorOf(ttscallbacks.Update{Status: statusFailed})

	if result == nil || *result != "TTS_PROVIDER_ERROR: quota exceeded" || none != nil {
		t.Errorf("got %v and %v", result, none)
	}
}
