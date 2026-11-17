// Package zitadelevents receives the calls ZITADEL makes to the backend when something happens to a user (Actions v2).
package zitadelevents

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
)

const (
	signatureTolerance = 5 * time.Minute
	maxBodyBytes       = 1 << 20
	logKeyUserID       = "userID"
	logKeyError        = "error"
)

var (
	timestampPart = regexp.MustCompile(`t=(\d+)`)
	signaturePart = regexp.MustCompile(`v1=([0-9a-f]+)`)

	errMissingSignature = errors.New("missing signature")
	errStaleSignature   = errors.New("stale signature")
	errBadSignature     = errors.New("invalid signature")
)

// UserAdded answers ZITADEL's call on user.human.added: the event's aggregateID is the new user. Everyone starts as a user; one that already holds a role (the seeded ones) is left alone. The call is signed with signingKey.
func UserAdded(
	signingKey string,
	management *zitadel.Management,
	logger *slog.Logger,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		if err != nil {
			http.Error(w, "unreadable body", http.StatusBadRequest)

			return
		}
		if err := verify(
			signingKey,
			r.Header.Get("ZITADEL-Signature"),
			body,
			time.Now(),
		); err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)

			return
		}
		var event struct {
			AggregateID string `json:"aggregateID"`
		}
		if err := json.Unmarshal(
			body,
			&event,
		); err != nil ||
			event.AggregateID == "" {
			http.Error(w, "the event has no aggregateID", http.StatusBadRequest)

			return
		}
		if err := management.GrantProjectRoleIfAbsent(
			r.Context(),
			event.AggregateID,
			auth.RoleUser,
		); err != nil {
			logger.ErrorContext(
				r.Context(),
				"granting the first role to a new user",
				slog.String(logKeyUserID, event.AggregateID),
				slog.Any(logKeyError, err),
			)
			http.Error(
				w,
				"could not grant the role",
				http.StatusInternalServerError,
			)

			return
		}
		logger.InfoContext(
			r.Context(),
			"new user got the first role",
			slog.String(logKeyUserID, event.AggregateID),
		)
		w.WriteHeader(http.StatusNoContent)
	})
}

// verify checks the ZITADEL-Signature header: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">. Only the standard library, so the check is easy to read.
func verify(signingKey, header string, body []byte, now time.Time) error {
	timestamp := timestampPart.FindStringSubmatch(header)
	signature := signaturePart.FindStringSubmatch(header)
	if timestamp == nil || signature == nil {
		return errMissingSignature
	}
	seconds, err := strconv.ParseInt(timestamp[1], 10, 64)
	if err != nil {
		return errMissingSignature
	}
	age := now.Sub(time.Unix(seconds, 0))
	if age > signatureTolerance || age < -signatureTolerance {
		return errStaleSignature
	}
	mac := hmac.New(sha256.New, []byte(signingKey))
	mac.Write([]byte(timestamp[1] + "."))
	mac.Write(body)
	actual, err := hex.DecodeString(signature[1])
	if err != nil || !hmac.Equal(actual, mac.Sum(nil)) {
		return errBadSignature
	}

	return nil
}
