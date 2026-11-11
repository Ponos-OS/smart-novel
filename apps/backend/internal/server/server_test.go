package server_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
)

func newHandler(env string) http.Handler {
	return server.New(server.Options{
		Config: config.Config{App: config.App{
			Env:                env,
			CORSAllowedOrigins: []string{"http://localhost:8080"},
		}},
		Logger:         slog.New(slog.DiscardHandler),
		Schema:         graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{}}),
		TracerProvider: sdktrace.NewTracerProvider(),
	})
}

func post(t *testing.T, handler http.Handler, query string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", strings.NewReader(query))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	return recorder
}

func TestGraphQLAnswersTypename(t *testing.T) {
	handler := newHandler(config.EnvTest)

	recorder := post(t, handler, `{"query":"{ __typename }"}`)

	if recorder.Code != http.StatusOK || strings.TrimSpace(recorder.Body.String()) != `{"data":{"__typename":"Query"}}` {
		t.Errorf("got %d %q", recorder.Code, recorder.Body.String())
	}
}

func TestGraphQLHealthQuery(t *testing.T) {
	handler := newHandler(config.EnvTest)

	recorder := post(t, handler, `{"query":"{ health }"}`)

	if strings.TrimSpace(recorder.Body.String()) != `{"data":{"health":"OK"}}` {
		t.Errorf("got %q", recorder.Body.String())
	}
}

func TestIntrospectionOnlyOutsideProduction(t *testing.T) {
	cases := []struct {
		env        string
		introspect bool
	}{
		{config.EnvDevelopment, true},
		{config.EnvProduction, false},
	}
	for _, c := range cases {
		t.Run(c.env, func(t *testing.T) {
			handler := newHandler(c.env)

			recorder := post(t, handler, `{"query":"{ __schema { queryType { name } } }"}`)

			if got := strings.Contains(recorder.Body.String(), `"queryType":{"name":"Query"}`); got != c.introspect {
				t.Errorf("introspection answered = %v, want %v: %s", got, c.introspect, recorder.Body.String())
			}
		})
	}
}

func TestPlaygroundOnlyOutsideProduction(t *testing.T) {
	cases := []struct {
		env  string
		want int
	}{
		{config.EnvDevelopment, http.StatusOK},
		{config.EnvProduction, http.StatusMethodNotAllowed},
	}
	for _, c := range cases {
		t.Run(c.env, func(t *testing.T) {
			handler := newHandler(c.env)
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/graphql", nil)
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, request)

			if recorder.Code != c.want {
				t.Errorf("status = %d, want %d", recorder.Code, c.want)
			}
		})
	}
}

func TestCORS(t *testing.T) {
	cases := []struct {
		name   string
		origin string
		want   string
	}{
		{"allowed origin", "http://localhost:8080", "http://localhost:8080"},
		{"unknown origin", "https://evil.example.com", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			handler := newHandler(config.EnvTest)
			request := httptest.NewRequestWithContext(t.Context(), http.MethodOptions, "/graphql", nil)
			request.Header.Set("Origin", c.origin)
			request.Header.Set("Access-Control-Request-Method", http.MethodPost)
			request.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, request)

			if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != c.want {
				t.Errorf("allow-origin = %q, want %q", got, c.want)
			}
			if c.want != "" && recorder.Header().Get("Access-Control-Allow-Credentials") != "true" {
				t.Error("credentials must be allowed")
			}
		})
	}
}

func TestTraceIDHeader(t *testing.T) {
	handler := newHandler(config.EnvTest)

	recorder := post(t, handler, `{"query":"{ health }"}`)

	if got := recorder.Header().Get("x-trace-id"); len(got) != 32 {
		t.Errorf("x-trace-id = %q, want a 32 character trace ID", got)
	}
}

func TestOperationSpanIsNamedAfterTheOperation(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	handler := server.New(server.Options{
		Config: config.Config{App: config.App{
			Env:                config.EnvTest,
			CORSAllowedOrigins: []string{"http://localhost:8080"},
		}},
		Logger:         slog.New(slog.DiscardHandler),
		Schema:         graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{}}),
		TracerProvider: provider,
	})

	post(t, handler, `{"query":"{ health }"}`)

	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("got %d spans, want 1", len(spans))
	}
	if spans[0].Name() != "query health" {
		t.Errorf("span name = %q, want %q", spans[0].Name(), "query health")
	}
	if !slices.Contains(spans[0].Attributes(), attribute.String("graphql.operation.name", "health")) {
		t.Errorf("attributes = %v, want graphql.operation.name=health", spans[0].Attributes())
	}
}
