// Package redis is the backend's client of Redis. It wraps go-redis so the rest of the code does not know the library: a missing key is not
// an error, and opening and closing are logged in one place.
package redis

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

const logKeyError = "error"

type Client struct {
	client *goredis.Client
	logger *slog.Logger
}

// Open makes the client and asks Redis once. It does not fail because Redis does not answer: the cache is only a shortcut and the database
// answers without it, so that is logged and the client connects when Redis is back.
func Open(ctx context.Context, cfg config.Redis, logger *slog.Logger) (*Client, error) {
	options, err := goredis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("reading REDIS_URL: %w", err)
	}
	if cfg.Password != "" {
		options.Password = cfg.Password
	}
	client := &Client{client: goredis.NewClient(options), logger: logger}
	if pingErr := client.client.Ping(ctx).Err(); pingErr != nil {
		logger.WarnContext(ctx, "Redis does not answer, the database answers instead", slog.Any(logKeyError, pingErr))
	} else {
		logger.InfoContext(ctx, "Redis connected")
	}

	return client, nil
}

// Close disconnects; call it when the program ends.
func (c *Client) Close(ctx context.Context) {
	if err := c.client.Close(); err != nil {
		c.logger.ErrorContext(ctx, "closing the Redis client", slog.Any(logKeyError, err))

		return
	}
	c.logger.InfoContext(ctx, "Redis disconnected")
}

// Get reads a key; found is false when it is not there.
func (c *Client) Get(ctx context.Context, key string) (value string, found bool, err error) {
	value, err = c.client.Get(ctx, key).Result()
	if errors.Is(err, goredis.Nil) {
		return "", false, nil
	}

	return value, err == nil, err
}

// Set writes a key that Redis forgets after ttl; a ttl of zero keeps it.
func (c *Client) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

// Publish sends a message to every subscriber of the channel, in every replica. Nobody being subscribed is not an error.
func (c *Client) Publish(ctx context.Context, channel, message string) error {
	return c.client.Publish(ctx, channel, message).Err()
}

// Subscribe calls handle for every message of the channel until ctx ends. It returns once Redis has confirmed the subscription, so a message published afterwards is not missed; go-redis subscribes again by itself when the connection drops.
func (c *Client) Subscribe(ctx context.Context, channel string, handle func(ctx context.Context, message string)) error {
	subscription := c.client.Subscribe(ctx, channel)
	if _, err := subscription.Receive(ctx); err != nil {
		_ = subscription.Close() //nolint:errcheck // the subscription failed already, that is the error to report

		return fmt.Errorf("subscribing to %s: %w", channel, err)
	}
	go func() {
		defer subscription.Close() //nolint:errcheck // nothing to do about a failed close when the program is ending
		messages := subscription.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case message, open := <-messages:
				if !open {
					return
				}
				handle(ctx, message.Payload)
			}
		}
	}()

	return nil
}

// TryLock takes the lock on key for at most ttl unless somebody holds it, and returns the token to give back to Unlock. acquired is false when the lock is held.
func (c *Client) TryLock(ctx context.Context, key string, ttl time.Duration) (token string, acquired bool, err error) {
	token = uuid.NewString()
	acquired, err = c.client.SetNX(ctx, key, token, ttl).Result()

	return token, acquired, err
}

// unlockScript deletes the key only while it still holds the token of the caller, so a lock that expired and was taken by somebody else is not released by the first holder.
var unlockScript = goredis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0`)

// Unlock releases the lock of token; one that is not the caller's, or has expired, is left alone.
func (c *Client) Unlock(ctx context.Context, key, token string) error {
	return unlockScript.Run(ctx, c.client, []string{key}, token).Err()
}

// Del removes a key and reports whether it was there.
func (c *Client) Del(ctx context.Context, key string) (bool, error) {
	removed, err := c.client.Del(ctx, key).Result()

	return removed > 0, err
}
