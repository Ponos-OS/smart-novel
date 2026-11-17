// Package llm explains a word as it is used in a sentence, with the LLM of Beatrice. An explanation is kept in Redis, and a request for what is
// being asked at the same moment waits for that answer instead of asking again.
package llm

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/Khan/genqlient/graphql"
	"golang.org/x/sync/singleflight"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/beatrice"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
)

const (
	logKeyWord      = "word"
	logKeyCacheKey  = "cacheKey"
	logKeyLatency   = "latencyMs"
	logKeyCacheHit  = "cacheHit"
	logKeyCoalesced = "coalesced"
	logKeyInstance  = "instanceID"
	logKeyError     = "error"
)

type Service struct {
	beatrice graphql.Client
	cache    *redis.Client
	ttl      time.Duration
	logger   *slog.Logger
	flights  singleflight.Group
}

func NewService(
	beatriceClient graphql.Client,
	cache *redis.Client,
	ttl time.Duration,
	logger *slog.Logger,
) *Service {
	return &Service{
		beatrice: beatriceClient,
		cache:    cache,
		ttl:      ttl,
		logger:   logger,
	}
}

// Explain answers from Redis when it can, and otherwise asks Beatrice once for everybody who asks for the same word in the same context.
func (s *Service) Explain(
	ctx context.Context,
	word, sentence string,
) (*model.WordExplanation, error) {
	started := time.Now()
	key := CacheKey(word, sentence)
	explanation, hit := s.cached(ctx, key)
	coalesced := false
	if !hit {
		var err error
		explanation, coalesced, err = s.ask(ctx, key, word, sentence)
		if err != nil {
			return nil, err
		}
	}
	explanation.CacheKey = key
	hostname, hostErr := os.Hostname()
	if hostErr != nil {
		hostname = "unknown"
	}
	s.logger.InfoContext(
		ctx,
		"word explained",
		slog.String(logKeyWord, word),
		slog.String(logKeyCacheKey, key),
		slog.String(logKeyInstance, hostname),
		slog.Int64(
			logKeyLatency,
			time.Since(started).Milliseconds(),
		),
		slog.Bool(logKeyCacheHit, hit),
		slog.Bool(logKeyCoalesced, coalesced),
	)

	return explanation, nil
}

func (s *Service) cached(
	ctx context.Context,
	key string,
) (*model.WordExplanation, bool) {
	value, found, err := s.cache.Get(ctx, key)
	if err != nil {
		s.logger.WarnContext(
			ctx,
			"reading an explanation from Redis",
			slog.String(logKeyCacheKey, key),
			slog.Any(logKeyError, err),
		)

		return nil, false
	}
	var explanation model.WordExplanation
	if !found || json.Unmarshal([]byte(value), &explanation) != nil {
		return nil, false
	}

	return &explanation, true
}

// ask shares one call to Beatrice between the requests for the same key that run together. It does not stop when the first of them gives up,
// because the others wait for the answer.
func (s *Service) ask(
	ctx context.Context,
	key, word, sentence string,
) (explanation *model.WordExplanation, coalesced bool, err error) {
	asked, err, shared := s.flights.Do(key, func() (any, error) {
		return s.askBeatrice(context.WithoutCancel(ctx), key, word, sentence)
	})
	if err != nil {
		return nil, false, err
	}
	explained, ok := asked.(*model.WordExplanation)
	if !ok {
		return nil, false, unavailable()
	}
	// Every caller gets its own copy, because each one sets its key on it.
	copied := *explained

	return &copied, shared, nil
}

func (s *Service) askBeatrice(
	ctx context.Context,
	key, word, sentence string,
) (*model.WordExplanation, error) {
	response, err := beatrice.ExplainWord(ctx, s.beatrice, word, sentence)
	if err != nil {
		s.logger.ErrorContext(
			ctx,
			"asking Beatrice to explain a word",
			slog.String(logKeyWord, word),
			slog.Any(logKeyError, err),
		)

		return nil, unavailable()
	}
	said := response.ExplainWord
	explanation := &model.WordExplanation{
		Meaning:               said.Meaning,
		SimplifiedExplanation: said.SimplifiedExplanation,
		Synonyms:              said.Synonyms,
		Antonyms:              said.Antonyms,
	}
	if stored, marshalErr := json.Marshal(explanation); marshalErr == nil {
		if setErr := s.cache.Set(
			ctx,
			key,
			string(stored),
			s.ttl,
		); setErr != nil {
			s.logger.WarnContext(
				ctx,
				"keeping an explanation in Redis",
				slog.String(logKeyCacheKey, key),
				slog.Any(logKeyError, setErr),
			)
		}
	}

	return explanation, nil
}

func unavailable() error {
	return apperr.Unavailable(
		"The word explanation is not available right now. Try again later.",
	)
}

// CacheKey names an explanation by the word, whatever its case, and the sentence it is in, whatever its spacing and case, so the same
// question always finds the same answer and a different sentence never gets a wrong one.
func CacheKey(word, sentence string) string {
	normalized := strings.ToLower(strings.Join(strings.Fields(sentence), " "))
	fingerprint := sha256.Sum256([]byte(normalized))

	return "explain:" + strings.ToLower(
		strings.TrimSpace(word),
	) + ":" + hex.EncodeToString(
		fingerprint[:],
	)
}
