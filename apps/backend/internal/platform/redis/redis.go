// Package redis is the backend's client of Redis. It wraps go-redis so the rest of the code does not know the library: a missing key is not
// an error, and opening and closing are logged in one place.
package redis

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

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

// Del removes a key and reports whether it was there.
func (c *Client) Del(ctx context.Context, key string) (bool, error) {
	removed, err := c.client.Del(ctx, key).Result()

	return removed > 0, err
}
