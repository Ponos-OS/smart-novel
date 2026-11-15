package license

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

const (
	ccByNc = `{"id":"CC-BY-NC-4.0","name":"Creative Commons Attribution-NonCommercial 4.0 International","shortName":"CC BY-NC 4.0","version":"4.0","category":"creative_commons","officialUrl":"https://creativecommons.org/licenses/by-nc/4.0/legalcode","summary":"","permissions":[],"conditions":[],"limitations":[],"body":"# Creative Commons Attribution-NonCommercial 4.0 International\n..."}`
	listed = `{"licenses":[{"id":"CC-BY-NC-4.0","name":"Creative Commons Attribution-NonCommercial 4.0 International","shortName":"CC BY-NC 4.0","version":"4.0","category":"creative_commons","officialUrl":"https://creativecommons.org/licenses/by-nc/4.0/legalcode","summary":"","permissions":[],"conditions":[],"limitations":[]}]}`
)

func newServiceWithFithara(t *testing.T, handler http.HandlerFunc) *Service {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := fithara.NewClientWithResponses(server.URL, fithara.WithHTTPClient(&http.Client{Timeout: time.Second}))
	if err != nil {
		t.Fatal(err)
	}

	return NewService(nil, client, slog.New(slog.DiscardHandler))
}

func answer(status int, body string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if _, err := io.WriteString(w, body); err != nil {
			panic(err)
		}
	}
}

func TestFindCanonicalReturnsTheLicenseOfFithara(t *testing.T) {
	uut := newServiceWithFithara(t, answer(http.StatusOK, ccByNc))

	result, err := uut.findCanonical(context.Background(), "CC-BY-NC-4.0")

	if err != nil || result == nil || result.ShortName != "CC BY-NC 4.0" || result.Id != "CC-BY-NC-4.0" {
		t.Errorf("got %+v, %v", result, err)
	}
}

func TestFindCanonicalGivesNothingForALicenseFitharaDoesNotOffer(t *testing.T) {
	for name, status := range map[string]int{"unknown": http.StatusNotFound, "retired": http.StatusGone} {
		t.Run(name, func(t *testing.T) {
			uut := newServiceWithFithara(t, answer(status, `{"error":{"code":"UNKNOWN_LICENSE","message":"no"}}`))

			result, err := uut.findCanonical(context.Background(), "CC-BY-NC-4.0")

			if result != nil || err != nil {
				t.Errorf("got %+v, %v, want nil, nil", result, err)
			}
		})
	}
}

func TestFindCanonicalIsUnavailableWhenFitharaCannotBeAsked(t *testing.T) {
	cases := map[string]http.HandlerFunc{
		"a server error": answer(http.StatusInternalServerError, `{"error":{"code":"INTERNAL","message":"boom"}}`),
		"a slow answer": func(http.ResponseWriter, *http.Request) {
			time.Sleep(1500 * time.Millisecond)
		},
	}
	for name, handler := range cases {
		t.Run(name, func(t *testing.T) {
			uut := newServiceWithFithara(t, handler)

			_, err := uut.findCanonical(context.Background(), "CC-BY-NC-4.0")

			var coded interface{ Code() string }
			if !errors.As(err, &coded) || coded.Code() != apperr.CodeUnavailable {
				t.Errorf("error = %v, want %s", err, apperr.CodeUnavailable)
			}
		})
	}
}

func TestOfficialURLIsListedOnceAndKept(t *testing.T) {
	var calls atomic.Int32
	uut := newServiceWithFithara(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		answer(http.StatusOK, listed)(w, r)
	})

	first := uut.OfficialURL(context.Background(), "CC-BY-NC-4.0")
	unknown := uut.OfficialURL(context.Background(), "MIT")

	if first != "https://creativecommons.org/licenses/by-nc/4.0/legalcode" || unknown != "" || calls.Load() != 1 {
		t.Errorf("url = %q, unknown = %q, %d calls", first, unknown, calls.Load())
	}
}

func TestOfficialURLIsEmptyWhenFitharaCannotBeReached(t *testing.T) {
	uut := newServiceWithFithara(t, answer(http.StatusInternalServerError, `{}`))

	url := uut.OfficialURL(context.Background(), "CC-BY-NC-4.0")

	if url != "" {
		t.Errorf("got %q, want nothing", url)
	}
}
