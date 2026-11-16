// Package ttscallbacks holds the two REST endpoints Beatrice calls while it narrates a chapter: where to upload the audio, and how far the job is. They are webhooks of another service, so they are not part of the GraphQL API.
package ttscallbacks

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
)

const (
	// StatusChannel is the Redis channel every replica hears the status updates on, whichever replica Beatrice called.
	StatusChannel = "tts-audio:status"
	// AudioKeyPrefix is where the audio of a job is stored: narrations/<jobId>.mp3.
	AudioKeyPrefix = "narrations"

	audioContentType = "audio/mpeg"
	uploadURLTTL     = 5 * time.Minute
	maxBodyBytes     = 1 << 16

	logKeyJobID  = "jobID"
	logKeyStatus = "status"
	logKeyError  = "error"
)

// jobIDPattern is a UUID, which is all Beatrice ever sends as the Idempotency-Key. Nothing else may become part of an object key.
var jobIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

var errBadStatus = errors.New("the status update is not valid")

// AudioKey is the object key of the audio of a job.
func AudioKey(jobID string) string {
	return AudioKeyPrefix + "/" + jobID + ".mp3"
}

// GenUploadURL answers Beatrice's genUploadUrl callback with a short-lived URL it PUTs the audio to once. The call carries the bearer token of the request that started the job, which must be one ZITADEL issued, expired or not.
func GenUploadURL(check *auth.IssuerCheck, storage *objectstorage.Client, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			refuse(w, http.StatusUnauthorized, "Missing Bearer token in Authorization header")

			return
		}
		if err := check.Verify(r.Context(), strings.TrimSpace(token)); err != nil {
			logger.WarnContext(r.Context(), "token of a Beatrice callback rejected", slog.Any(logKeyError, err))
			refuse(w, http.StatusUnauthorized, "Invalid token")

			return
		}
		jobID := r.Header.Get("Idempotency-Key")
		if !jobIDPattern.MatchString(strings.ToLower(jobID)) {
			refuse(w, http.StatusBadRequest, "Idempotency-Key must be a UUID")

			return
		}
		url, err := storage.PresignClusterUpload(r.Context(), AudioKey(jobID), audioContentType, uploadURLTTL)
		if err != nil {
			logger.ErrorContext(r.Context(), "signing the upload URL of a narration", slog.String(logKeyJobID, jobID), slog.Any(logKeyError, err))
			refuse(w, http.StatusInternalServerError, "Could not sign the upload URL")

			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(uploadURL{URL: url}) //nolint:errcheck,errchkjson // the status is sent; a client that has gone cannot be told anything
	})
}

// Update is how far a job is, as Beatrice says it. Status stays the text Beatrice sent: its vocabulary is its own and may grow, and the
// backend acts on the two it knows, completed and failed.
type Update struct {
	JobID           string       `json:"jobId"`
	Status          string       `json:"status"`
	Progress        *int         `json:"progress,omitempty"`
	ClientContextID *string      `json:"clientContextId,omitempty"`
	FileSizeBytes   *int         `json:"fileSizeBytes,omitempty"`
	Attempt         *int         `json:"attempt,omitempty"`
	FailedAt        *string      `json:"failedAt,omitempty"`
	Error           *UpdateError `json:"error,omitempty"`
}

type UpdateError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Status answers Beatrice's statusCallbackUrl: a valid update is published on StatusChannel for every replica to hear, and nothing is answered but 204.
func Status(cache *redis.Client, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		if err != nil {
			refuse(w, http.StatusBadRequest, "Unreadable body")

			return
		}
		update, err := ParseUpdate(body)
		if err != nil {
			refuse(w, http.StatusBadRequest, err.Error())

			return
		}
		logger.InfoContext(r.Context(), "status callback of Beatrice", slog.String(logKeyStatus, update.Status), slog.String(logKeyJobID, update.JobID))
		published, err := json.Marshal(update)
		if err == nil {
			err = cache.Publish(r.Context(), StatusChannel, string(published))
		}
		if err != nil {
			logger.ErrorContext(r.Context(), "publishing a status update of Beatrice", slog.String(logKeyJobID, update.JobID), slog.Any(logKeyError, err))
			refuse(w, http.StatusInternalServerError, "Could not publish the status update")

			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

// ParseUpdate reads a status update and checks it.
func ParseUpdate(body []byte) (Update, error) {
	var update Update
	if err := json.Unmarshal(body, &update); err != nil {
		return Update{}, fmt.Errorf("%w: it is not JSON of the expected shape", errBadStatus)
	}
	for _, rule := range []struct {
		broken  bool
		message string
	}{
		{!jobIDPattern.MatchString(strings.ToLower(update.JobID)), "jobId must be a UUID"},
		{strings.TrimSpace(update.Status) == "", "status must be a string"},
		{update.Progress != nil && *update.Progress < 1, "progress must not be less than 1"},
		{update.FileSizeBytes != nil && *update.FileSizeBytes < 0, "fileSizeBytes must not be less than 0"},
		{update.Attempt != nil && *update.Attempt < 1, "attempt must not be less than 1"},
		{update.FailedAt != nil && !isTimestamp(*update.FailedAt), "failedAt must be an ISO 8601 date"},
	} {
		if rule.broken {
			return Update{}, fmt.Errorf("%w: %s", errBadStatus, rule.message)
		}
	}

	return update, nil
}

func isTimestamp(value string) bool {
	_, err := time.Parse(time.RFC3339, value)

	return err == nil
}

// problem is the body of a refusal, uploadURL the one of GenUploadURL.
type (
	problem struct {
		Message string `json:"message"`
	}
	uploadURL struct {
		URL string `json:"url"`
	}
)

func refuse(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(problem{Message: message}) //nolint:errcheck,errchkjson // the status is sent; a client that has gone cannot be told anything
}
