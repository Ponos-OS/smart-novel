package config

import (
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strconv"
	"strings"
	"time"
)

type Lookup func(key string) (string, bool)

type reader struct {
	lookup Lookup
	errs   []error
}

type settingError struct {
	key     string
	problem string
}

func (e settingError) Error() string { return e.key + " " + e.problem }

func (r *reader) fail(key, format string, args ...any) {
	r.errs = append(r.errs, settingError{key: key, problem: fmt.Sprintf(format, args...)})
}

func (r *reader) value(key string) (string, bool) {
	value, ok := r.lookup(key)
	value = strings.TrimSpace(value)

	return value, ok && value != ""
}

func (r *reader) text(key, fallback string) string {
	if value, ok := r.value(key); ok {
		return value
	}

	return fallback
}

func (r *reader) oneOf(key string, allowed []string, fallback string) string {
	value, ok := r.value(key)
	if !ok {
		if fallback == "" {
			r.fail(key, "is required, one of %s", strings.Join(allowed, ", "))
		}

		return fallback
	}
	if !slices.Contains(allowed, value) {
		r.fail(key, "must be one of %s, got %q", strings.Join(allowed, ", "), value)
	}

	return value
}

func (r *reader) logLevel(key string, fallback slog.Level) slog.Level {
	value, ok := r.value(key)
	if !ok {
		return fallback
	}
	var level slog.Level
	if err := level.UnmarshalText([]byte(value)); err != nil {
		r.fail(key, "must be debug, info, warn or error, got %q", value)
	}

	return level
}

func (r *reader) port(key string) int {
	value, ok := r.value(key)
	if !ok {
		r.fail(key, "is required")

		return 0
	}
	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		r.fail(key, "must be a port between 1 and 65535, got %q", value)
	}

	return port
}

func (r *reader) positiveInt(key string, fallback int) int {
	value, ok := r.value(key)
	if !ok {
		return fallback
	}
	number, err := strconv.Atoi(value)
	if err != nil || number < 1 {
		r.fail(key, "must be a positive integer, got %q", value)
	}

	return number
}

func (r *reader) milliseconds(key string, fallback time.Duration) time.Duration {
	value, ok := r.value(key)
	if !ok {
		return fallback
	}
	number, err := strconv.Atoi(value)
	if err != nil || number < 1 {
		r.fail(key, "must be a positive number of milliseconds, got %q", value)
	}

	return time.Duration(number) * time.Millisecond
}

func (r *reader) ratio(key string, fallback float64) float64 {
	value, ok := r.value(key)
	if !ok {
		return fallback
	}
	number, err := strconv.ParseFloat(value, 64)
	if err != nil || number < 0 || number > 1 {
		r.fail(key, "must be a number between 0 and 1, got %q", value)
	}

	return number
}

func (r *reader) boolean(key string, fallback bool) bool {
	value, ok := r.value(key)
	if !ok {
		return fallback
	}
	switch value {
	case "true":
		return true
	case "false":
		return false
	}
	r.fail(key, "must be true or false, got %q", value)

	return fallback
}

func (r *reader) list(key string) []string {
	value, _ := r.value(key)
	var items []string
	for item := range strings.SplitSeq(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	if len(items) == 0 {
		r.fail(key, "is required, a comma separated list")
	}

	return items
}

func (r *reader) err() error {
	return errors.Join(r.errs...)
}
