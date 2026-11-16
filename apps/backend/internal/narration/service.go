// Package narration turns a chapter into audio with Beatrice: it starts a job, remembers it while it runs so that only one runs per chapter,
// and, when Beatrice says the job is done, keeps the address of the audio on the chapter.
package narration

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	genqlient "github.com/Khan/genqlient/graphql"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entchapter "github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/beatrice"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

var errLockLost = errors.New("the lock of the chapter expired while its narration was being started")

const (
	// lockTTL is how long a chapter stays locked at most: the lock is released when the job ends, and this is for a job that never reports.
	lockTTL    = time.Hour
	retryAfter = 30 * time.Second

	logKeyChapterID = "chapterID"
	logKeyJobID     = "jobID"
	logKeyStatus    = "status"
	logKeyError     = "error"
	logKeyFailure   = "failure"
	logKeyURL       = "url"
)

// Response is what generateChapterAudio answers: the job is started, not done.
type Response struct {
	Status       entchapter.NarrationStatus
	NarrationURL *string
}

// Service starts narrations and follows them. Nothing about a running job is in the database or in the memory of a replica: the lock of the chapter holds the job, and Redis remembers how far each job came, so whichever replica Beatrice calls can handle its update.
type Service struct {
	repo        *repository
	cache       *redis.Client
	storage     *objectstorage.Client
	beatrice    genqlient.Client
	voice       string
	internalURL string
	logger      *slog.Logger

	mutex       sync.Mutex
	subscribers map[uuid.UUID]map[chan *Event]struct{}
}

// NewService takes the voice every narration is made with and the address Beatrice reaches this backend on.
func NewService(client *ent.Client, cache *redis.Client, storage *objectstorage.Client, beatriceClient genqlient.Client, voice, internalURL string, logger *slog.Logger) *Service {
	return &Service{
		repo: newRepository(client), cache: cache, storage: storage, beatrice: beatriceClient, voice: voice,
		internalURL: strings.TrimRight(internalURL, "/"), logger: logger,
		subscribers: make(map[uuid.UUID]map[chan *Event]struct{}),
	}
}

func lockKey(chapterID uuid.UUID) string {
	return "chapter_tts:" + chapterID.String()
}

// Generate is the writer's button: it always makes new audio, and refuses only when a job for the chapter is running already.
func (s *Service) Generate(ctx context.Context, viewer auth.Viewer, chapterID uuid.UUID) (Response, error) {
	found, err := s.repo.chapterWithOwner(ctx, chapterID)
	if ent.IsNotFound(err) {
		return Response{}, apperr.NotFound("Chapter not found")
	}
	if err != nil {
		return Response{}, err
	}
	if err = auth.DenyUnlessCan(viewer, auth.Update, auth.Chapter{NovelOwnerUserID: found.Edges.Novel.Edges.Writer.UserID}); err != nil {
		return Response{}, err
	}
	text, err := s.repo.text(ctx, found.ContentID)
	if err != nil {
		return Response{}, err
	}
	if strings.TrimSpace(text) == "" {
		return Response{}, apperr.BadRequest("Chapter has no content to narrate")
	}
	token, acquired, err := s.cache.TryLock(ctx, lockKey(chapterID), lockTTL)
	if err != nil {
		return Response{}, fmt.Errorf("locking the narration of a chapter: %w", err)
	}
	if !acquired {
		return Response{}, apperr.Conflict("Narration generation is already in progress for this chapter")
	}
	if err = s.start(ctx, chapterID, text, token); err != nil {
		s.release(ctx, lockKey(chapterID), token)
		s.logger.ErrorContext(ctx, "starting the narration of a chapter", slog.String(logKeyChapterID, chapterID.String()), slog.Any(logKeyError, err))

		return Response{}, apperr.Unavailable("The narration is not available right now. Try again later.")
	}

	return Response{Status: entchapter.NarrationStatusPROCESSING}, nil
}

// Regenerate is for the code that saves the text of a chapter, so the audio is never forgotten. It starts a job unless one runs already,
// and only logs what goes wrong: the save was committed, and a narration that did not start must not undo it.
func (s *Service) Regenerate(ctx context.Context, chapterID uuid.UUID, text string) {
	key := lockKey(chapterID)
	token, acquired, err := s.cache.TryLock(ctx, key, lockTTL)
	if err != nil {
		s.logger.ErrorContext(ctx, "locking the narration of a chapter", slog.String(logKeyChapterID, chapterID.String()), slog.Any(logKeyError, err))

		return
	}
	if !acquired {
		s.logger.DebugContext(ctx, "a narration is running already, not starting another", slog.String(logKeyChapterID, chapterID.String()))

		return
	}
	if err = s.start(ctx, chapterID, text, token); err != nil {
		s.release(ctx, key, token)
		s.logger.ErrorContext(ctx, "starting the narration of a chapter", slog.String(logKeyChapterID, chapterID.String()), slog.Any(logKeyError, err))
	}
}

// start marks the chapter as being narrated and asks Beatrice for a job. The status is written before the call, so an update that comes back
// quickly cannot be overwritten by it; a narration that cannot be started leaves the chapter FAILED.
func (s *Service) start(ctx context.Context, chapterID uuid.UUID, text, token string) error {
	if err := s.repo.setStatus(ctx, chapterID, entchapter.NarrationStatusPROCESSING); err != nil {
		return fmt.Errorf("marking a chapter as being narrated: %w", err)
	}
	err := s.ask(ctx, chapterID, text, token)
	if err == nil {
		return nil
	}
	if statusErr := s.repo.setStatus(ctx, chapterID, entchapter.NarrationStatusFAILED); statusErr != nil {
		s.logger.WarnContext(ctx, "marking a chapter as not narrated", slog.String(logKeyChapterID, chapterID.String()), slog.Any(logKeyError, statusErr))
	}

	return err
}

// ask asks Beatrice for a job and keeps the lock until the job ends. The lock held the token of this call; it now holds the job, which is how any replica tells that an update is about the job started for the chapter, and releases the lock when the job ends. The token of the writer goes along: Beatrice brings it back on its callbacks. The chapter is the context of the job, so every update says which chapter it is about without a lookup.
func (s *Service) ask(ctx context.Context, chapterID uuid.UUID, text, token string) error {
	if bearer, ok := auth.BearerFrom(ctx); ok {
		ctx = beatrice.WithAuthorization(ctx, bearer)
	}
	response, err := beatrice.GenerateAudio(ctx, s.beatrice, text, s.voice,
		s.internalURL+"/beatrice-callbacks/gen-upload-url", s.internalURL+"/beatrice-callbacks/status", chapterID.String())
	if err != nil {
		return fmt.Errorf("asking Beatrice for audio: %w", err)
	}
	job := response.GenerateAudio.JobId
	swapped, err := s.cache.Swap(ctx, lockKey(chapterID), token, job)
	if err != nil {
		return fmt.Errorf("remembering the job of a chapter: %w", err)
	}
	if !swapped {
		return errLockLost
	}
	s.logger.InfoContext(ctx, "narration started", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, job))
	s.finishIfEnded(ctx, chapterID, job)

	return nil
}

// finishIfEnded does what Handle could not do for a job that ended before start had written it down: Beatrice answers the call that starts a job only after it has queued it, and a job can be reported done sooner than that answer is handled. Without this the lock of the chapter would stay held until it expires.
func (s *Service) finishIfEnded(ctx context.Context, chapterID uuid.UUID, jobID string) {
	update, ended, err := s.endedWith(ctx, jobID)
	if err != nil {
		s.logger.WarnContext(ctx, "looking at how a job ended", slog.String(logKeyJobID, jobID), slog.Any(logKeyError, err))

		return
	}
	if !ended {
		return
	}
	if err = s.report(ctx, chapterID, update); err != nil {
		s.logger.ErrorContext(ctx, "reporting a job that ended", slog.String(logKeyJobID, jobID), slog.Any(logKeyError, err))
	}
	s.release(ctx, lockKey(chapterID), jobID)
}

func (s *Service) release(ctx context.Context, key, token string) {
	if err := s.cache.Unlock(ctx, key, token); err != nil {
		s.logger.WarnContext(ctx, "releasing the lock of a narration", slog.Any(logKeyError, err))
	}
}

// KeepListening hands what the replicas announce about a narration to the subscribers of this replica, from the first moment until ctx ends.
// A Redis that cannot be reached is tried again.
func (s *Service) KeepListening(ctx context.Context) {
	for {
		err := s.cache.Subscribe(ctx, eventsChannel, s.hear)
		if err == nil {
			s.logger.InfoContext(ctx, "narration events listener started")

			return
		}
		s.logger.WarnContext(ctx, "listening for narration events", slog.Any(logKeyError, err))
		select {
		case <-ctx.Done():
			return
		case <-time.After(retryAfter):
		}
	}
}

// Handle is what the replica Beatrice called does with an update of a job. The chapter it belongs to comes from the context Beatrice echoes; an update that names none, such as one from a job started by an older release, is dropped. An error is for Beatrice to try again.
func (s *Service) Handle(ctx context.Context, update ttscallbacks.Update) error {
	chapterID, ok := s.chapterOf(ctx, update)
	if !ok {
		return nil
	}
	news, err := s.isNews(ctx, update)
	if err != nil {
		return fmt.Errorf("looking at how far the job came: %w", err)
	}
	if !news {
		s.logger.DebugContext(ctx, "dropping an update that is not news", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status))

		return nil
	}
	if !isKnown(update.Status) {
		s.logger.WarnContext(ctx, "Beatrice sent a status this release does not know, treating it as in progress", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status))
	}
	if err = s.report(ctx, chapterID, update); err != nil {
		if isTerminal(update.Status) {
			s.forgetEnd(ctx, update.JobID)
		}

		return err
	}
	if isTerminal(update.Status) {
		s.release(ctx, lockKey(chapterID), update.JobID)
	}

	return nil
}

// forgetEnd makes the terminal update news again, for the one Beatrice sends again after Handle failed.
func (s *Service) forgetEnd(ctx context.Context, jobID string) {
	if _, err := s.cache.Del(ctx, endedKey(jobID)); err != nil {
		s.logger.WarnContext(ctx, "forgetting how a job ended", slog.String(logKeyJobID, jobID), slog.Any(logKeyError, err))
	}
}

func (s *Service) chapterOf(ctx context.Context, update ttscallbacks.Update) (uuid.UUID, bool) {
	if update.ClientContextID != nil {
		if chapterID, err := uuid.Parse(*update.ClientContextID); err == nil {
			return chapterID, true
		}
	}
	s.logger.WarnContext(ctx, "an update of Beatrice names no chapter, dropping it", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status))

	return uuid.UUID{}, false
}

// startedFor tells whether the job is the one this backend started for the chapter: an update nobody asked for, or about another job, must not
// be able to change a chapter.
func (s *Service) startedFor(ctx context.Context, chapterID uuid.UUID, jobID string) (bool, error) {
	started, found, err := s.cache.Get(ctx, lockKey(chapterID))
	if err != nil {
		return false, fmt.Errorf("looking at the job of a chapter: %w", err)
	}
	if !found || started != jobID {
		s.logger.WarnContext(ctx, "this is not the job started for this chapter, ignoring it", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, jobID))

		return false, nil
	}

	return true, nil
}

// keepAudio stores the address of the audio on the chapter and marks it READY, but only for the job this backend started for it. kept is false,
// without an error, for any other job.
func (s *Service) keepAudio(ctx context.Context, chapterID uuid.UUID, jobID string) (url string, kept bool, err error) {
	started, err := s.startedFor(ctx, chapterID, jobID)
	if err != nil || !started {
		return "", false, err
	}
	url = s.storage.URLOf(ttscallbacks.AudioKey(jobID))
	if err = s.repo.setReady(ctx, chapterID, url); err != nil {
		return "", false, fmt.Errorf("keeping the audio address of a chapter: %w", err)
	}
	s.logger.InfoContext(ctx, "audio address kept", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, jobID))

	return url, true, nil
}

func failure(update ttscallbacks.Update) string {
	if update.Error == nil {
		return "no details"
	}

	return update.Error.Code + ": " + update.Error.Message
}
