package server

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPanicsBecomeAServerError(t *testing.T) {
	panicking := http.HandlerFunc(
		func(http.ResponseWriter, *http.Request) { panic("nil map write") },
	)
	handler := recoverPanics(slog.New(slog.DiscardHandler), panicking)
	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodGet,
		"/graphql",
		nil,
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "nil map write") {
		t.Errorf("the panic value leaked: %q", recorder.Body.String())
	}
}
