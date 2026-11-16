// Package narration turns a chapter into audio with Beatrice: it starts a job, remembers it while it runs so that only one runs per chapter,
// and, when Beatrice says the job is done, keeps the address of the audio on the chapter.
package narration

import (
	"context"
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

const (
	// lockTTL is how long a chapter stays locked at most: the lock is released when the job ends, and this is for a job that never reports.
	lockTTL    = time.Hour
	retryAfter = 30 * time.Second

	logKeyChapterID = "chapterID"
	logKeyJobID     = "jobID"
	logKeyStatus    = "status"
	logKeyError     = "error"
	logKeyPanic     = "panic"
	logKeyFailure   = "failure"
)

// Response is what generateChapterAudio answers: the job is started, not done.
type Response struct {
	Status       entchapter.NarrationStatus
	NarrationURL *string
}

type heldLock struct {
	key    string
	token  string
	jobKey string
}

// Service starts narrations and follows them. Nothing about a running job is in the database: the lock is in Redis and the rest in the memory of the replica that started it.
type Service struct {
	repo        *repository
	cache       *redis.Client
	storage     *objectstorage.Client
	beatrice    genqlient.Client
	voice       string
	internalURL string
	logger      *slog.Logger

	mutex    sync.Mutex
	held     map[string]heldLock
	progress *progressBook
}

// NewService takes the voice every narration is made with and the address Beatrice reaches this backend on.
func NewService(client *ent.Client, cache *redis.Client, storage *objectstorage.Client, beatriceClient genqlient.Client, voice, internalURL string, logger *slog.Logger) *Service {
	return &Service{
		repo: newRepository(client), cache: cache, storage: storage, beatrice: beatriceClient, voice: voice,
		internalURL: strings.TrimRight(internalURL, "/"), logger: logger,
		held: make(map[string]heldLock), progress: newProgressBook(),
	}
}

func lockKey(chapterID uuid.UUID) string {
	return "chapter_tts:" + chapterID.String()
}

// jobKey holds the job we started for a chapter, next to its lock. Every replica reads it, so an update that names another job, or a
// chapter we started nothing for, never gets to change a chapter.
func jobKey(chapterID uuid.UUID) string {
	return "chapter_tts_job:" + chapterID.String()
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

// start asks Beatrice for a job and keeps the lock until the job ends. The token of the writer goes along: Beatrice brings it back on its
// callbacks. The chapter is the context of the job, so every update says which chapter it is about without a lookup.
func (s *Service) start(ctx context.Context, chapterID uuid.UUID, text, token string) error {
	if bearer, ok := auth.BearerFrom(ctx); ok {
		ctx = beatrice.WithAuthorization(ctx, bearer)
	}
	response, err := beatrice.GenerateAudio(ctx, s.beatrice, text, s.voice,
		s.internalURL+"/beatrice-callbacks/gen-upload-url", s.internalURL+"/beatrice-callbacks/status", chapterID.String())
	if err != nil {
		return fmt.Errorf("asking Beatrice for audio: %w", err)
	}
	job := response.GenerateAudio.JobId
	if err = s.cache.Set(ctx, jobKey(chapterID), job, lockTTL); err != nil {
		return fmt.Errorf("remembering the job of a chapter: %w", err)
	}
	s.mutex.Lock()
	s.held[job] = heldLock{key: lockKey(chapterID), token: token, jobKey: jobKey(chapterID)}
	s.mutex.Unlock()
	s.logger.InfoContext(ctx, "narration started", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, job))
	s.finishIfEnded(ctx, chapterID, job)

	return nil
}

// finishIfEnded does what the listener could not do for a job that ended before start had written it down: Beatrice answers the call that
// starts a job only after it has queued it, and a job can be reported done sooner than that answer is handled. Without this the lock of the
// chapter would stay held until it expires.
func (s *Service) finishIfEnded(ctx context.Context, chapterID uuid.UUID, jobID string) {
	status, ended := s.progress.endedWith(jobID)
	if !ended {
		return
	}
	if status == statusCompleted {
		s.keepAudio(ctx, chapterID, jobID)
	}
	s.releaseJob(ctx, jobID)
}

func (s *Service) release(ctx context.Context, key, token string) {
	if err := s.cache.Unlock(ctx, key, token); err != nil {
		s.logger.WarnContext(ctx, "releasing the lock of a narration", slog.Any(logKeyError, err))
	}
}

// KeepListening follows what Beatrice says about its jobs, from the first moment until ctx ends. Every replica hears every update; the one
// that started the job releases its lock. A Redis that cannot be reached is tried again, because narrations started meanwhile would never
// get their audio address.
func (s *Service) KeepListening(ctx context.Context) {
	for {
		err := s.cache.Subscribe(ctx, ttscallbacks.StatusChannel, s.handle)
		if err == nil {
			s.logger.InfoContext(ctx, "narration status listener started")

			return
		}
		s.logger.WarnContext(ctx, "listening for narration updates", slog.Any(logKeyError, err))
		select {
		case <-ctx.Done():
			return
		case <-time.After(retryAfter):
		}
	}
}

func (s *Service) handle(ctx context.Context, message string) {
	defer func() {
		if recovered := recover(); recovered != nil {
			s.logger.ErrorContext(ctx, "handling a narration update panicked", slog.Any(logKeyPanic, recovered))
		}
	}()
	update, chapterID, ok := s.read(ctx, message)
	if !ok || !s.progress.apply(ctx, update, time.Now(), s.logger) {
		return
	}
	if !isKnown(update.Status) {
		s.logger.WarnContext(ctx, "Beatrice sent a status this release does not know, treating it as in progress", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status))
	}
	if update.Status == statusCompleted {
		s.keepAudio(ctx, chapterID, update.JobID)
	}
	if update.Status == statusFailed {
		s.logger.ErrorContext(ctx, "Beatrice could not narrate a chapter", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, update.JobID), slog.String(logKeyFailure, failure(update)))
	}
	if isTerminal(update.Status) {
		s.releaseJob(ctx, update.JobID)
	}
}

// read checks the update and finds the chapter it is about, which Beatrice echoes from what the job was started with. An update that names no
// chapter, such as one from a job started by an older release, is dropped.
func (s *Service) read(ctx context.Context, message string) (update ttscallbacks.Update, chapterID uuid.UUID, ok bool) {
	update, err := ttscallbacks.ParseUpdate([]byte(message))
	if err != nil {
		s.logger.WarnContext(ctx, "an update of Beatrice is not valid", slog.Any(logKeyError, err))

		return update, chapterID, false
	}
	if update.ClientContextID != nil {
		chapterID, err = uuid.Parse(*update.ClientContextID)
	}
	if update.ClientContextID == nil || err != nil {
		s.logger.WarnContext(ctx, "an update of Beatrice names no chapter, dropping it", slog.String(logKeyJobID, update.JobID), slog.String(logKeyStatus, update.Status))

		return update, chapterID, false
	}

	return update, chapterID, true
}

// keepAudio stores the address of the audio on the chapter, but only for the job this backend started for it: an update nobody asked for, or
// about another job, must not be able to point a chapter at some audio.
func (s *Service) keepAudio(ctx context.Context, chapterID uuid.UUID, jobID string) {
	started, found, err := s.cache.Get(ctx, jobKey(chapterID))
	if err != nil || !found || started != jobID {
		s.logger.WarnContext(ctx, "this is not the job started for this chapter, not keeping the audio", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, jobID), slog.Any(logKeyError, err))

		return
	}
	if err = s.repo.setNarrationURL(ctx, chapterID, s.storage.URLOf(ttscallbacks.AudioKey(jobID))); err != nil {
		s.logger.ErrorContext(ctx, "keeping the audio address of a chapter", slog.String(logKeyChapterID, chapterID.String()), slog.Any(logKeyError, err))

		return
	}
	s.logger.InfoContext(ctx, "audio address kept", slog.String(logKeyChapterID, chapterID.String()), slog.String(logKeyJobID, jobID))
}

func (s *Service) releaseJob(ctx context.Context, jobID string) {
	s.mutex.Lock()
	lock, ok := s.held[jobID]
	delete(s.held, jobID)
	s.mutex.Unlock()
	if !ok {
		return
	}
	s.release(ctx, lock.key, lock.token)
	if _, err := s.cache.Del(ctx, lock.jobKey); err != nil {
		s.logger.WarnContext(ctx, "forgetting the job of a chapter", slog.String(logKeyJobID, jobID), slog.Any(logKeyError, err))
	}
}

func failure(update ttscallbacks.Update) string {
	if update.Error == nil {
		return "no details"
	}

	return update.Error.Code + ": " + update.Error.Message
}
