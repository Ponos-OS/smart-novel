package server_test

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
)

// tokenVerifier knows one token, the way ZITADEL would for a writer.
type tokenVerifier struct{}

const writerToken = "eyJhbGciOiJSUzI1NiJ9.e30.writer-signature"

func (tokenVerifier) Verify(_ context.Context, token string) (auth.Viewer, error) {
	if token != writerToken {
		return auth.Viewer{}, errors.New("token is not active")
	}

	return auth.Viewer{
		Subject:           "399193312025837589",
		Name:              "Writer User",
		PreferredUsername: "writer",
		Email:             "writer@test.com",
		EmailVerified:     true,
		Roles:             []string{"writer"},
	}, nil
}

// acceptedTerms stands in for the database: every user has accepted the current terms.
type acceptedTerms struct{}

func (acceptedTerms) HasAcceptedCurrent(context.Context, string) (bool, error) {
	return true, nil
}

func newHandler(env string) http.Handler {
	return server.New(server.Options{
		Config: config.Config{App: config.App{
			Env:                env,
			CORSAllowedOrigins: []string{"http://localhost:8080"},
		}},
		Logger:         slog.New(slog.DiscardHandler),
		Schema:         graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{}, Directives: graph.Directives()}),
		Verifier:       tokenVerifier{},
		Terms:          acceptedTerms{},
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
		Schema:         graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{}, Directives: graph.Directives()}),
		Verifier:       tokenVerifier{},
		Terms:          acceptedTerms{},
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

func postWithToken(t *testing.T, handler http.Handler, query, authorization string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", strings.NewReader(query))
	request.Header.Set("Content-Type", "application/json")
	if authorization != "" {
		request.Header.Set("Authorization", authorization)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	return recorder
}

func TestWhoAmI(t *testing.T) {
	const query = `{"query":"{ whoAmI { sub name preferredUsername email emailVerified orgID roles } }"}`
	cases := []struct {
		name          string
		authorization string
		want          string
	}{
		{"without a token", "", `"message":"Missing Bearer token in Authorization header"`},
		{"with a token ZITADEL does not accept", "Bearer eyJhbGciOiJSUzI1NiJ9.e30.expired", `"message":"Invalid or expired token"`},
		{"with a writer token", "Bearer " + writerToken, `"whoAmI":{"sub":"399193312025837589","name":"Writer User","preferredUsername":"writer","email":"writer@test.com","emailVerified":true,"orgID":null,"roles":["writer"]}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			handler := newHandler(config.EnvTest)

			recorder := postWithToken(t, handler, query, c.authorization)

			if !strings.Contains(recorder.Body.String(), c.want) {
				t.Errorf("body = %s, want it to contain %s", recorder.Body.String(), c.want)
			}
		})
	}
}

func TestUnauthenticatedCallersGetTheUnauthenticatedCode(t *testing.T) {
	handler := newHandler(config.EnvTest)

	recorder := postWithToken(t, handler, `{"query":"{ whoAmI { sub } }"}`, "")

	if !strings.Contains(recorder.Body.String(), `"code":"UNAUTHENTICATED"`) {
		t.Errorf("body = %s", recorder.Body.String())
	}
}

func TestPublicQueriesIgnoreABadToken(t *testing.T) {
	handler := newHandler(config.EnvTest)

	recorder := postWithToken(t, handler, `{"query":"{ health }"}`, "Bearer eyJhbGciOiJSUzI1NiJ9.e30.expired")

	if !strings.Contains(recorder.Body.String(), `"health":"OK"`) {
		t.Errorf("body = %s", recorder.Body.String())
	}
}

func TestAMalformedIDIsABadRequest(t *testing.T) {
	handler := newHandler(config.EnvTest)

	recorder := postWithToken(t, handler, `{"query":"{ node(id: \"x\") { id } }"}`, "Bearer "+writerToken)

	body := recorder.Body.String()
	if !strings.Contains(body, `"message":"Invalid ID"`) || !strings.Contains(body, `"code":"BAD_REQUEST"`) {
		t.Errorf("body = %s", body)
	}
}

// The input rules live in schema directives, so every operation with input is tested through the real schema. Only bad input is sent:
// the resolvers behind a good one need a database.
func TestInputDirectives(t *testing.T) {
	const novelID = `93fec4bf-2f66-4e4a-9572-7aa4871f1458`
	tooManyIDs := `\"` + strings.Repeat(`316784561234\",\"`, 100) + `316784561234\"`
	cases := []struct {
		name  string
		query string
		want  string
	}{
		{"chapter with a blank title", `mutation { createChapter(novelID: \"` + novelID + `\", input: {title: \"   \", content: \"# Text\"}) { id } }`, `"field":"title","rule":"blank"`},
		{"chapter whose title is invisible", `mutation { createChapter(novelID: \"` + novelID + `\", input: {title: \"\\u200b\\u2060\", content: \"# Text\"}) { id } }`, `"field":"title","rule":"blank"`},
		{"chapter with empty content", `mutation { createChapter(novelID: \"` + novelID + `\", input: {title: \"Dry\", content: \"\\n \\n\"}) { id } }`, `"field":"content","rule":"blank"`},
		{"chapter title with a NUL", `mutation { createChapter(novelID: \"` + novelID + `\", input: {title: \"Dry\\u0000\", content: \"# Text\"}) { id } }`, `NUL character`},
		{"chapter update with a blank title", `mutation { updateChapter(id: \"` + novelID + `\", input: {title: \" \"}, expectedUpdatedAt: \"2026-01-01T00:00:00Z\") { id } }`, `"field":"title","rule":"blank"`},
		{"chapter content that is blank", `mutation { updateContent(id: \"` + novelID + `\", content: \" \", expectedContentUpdatedAt: \"2026-01-01T00:00:00Z\") { id } }`, `"field":"content","rule":"blank"`},
		{"novel with a blank name", `mutation { createNovel(input: {name: \" \", description: \"Salt.\"}) { id } }`, `"field":"name","rule":"blank"`},
		{"novel with a blank tag", `mutation { createNovel(input: {name: \"Dry Sea\", description: \"Salt.\", tags: [\"epic\", \" \"]}) { id } }`, `"field":"tags","rule":"blank"`},
		{"novel update with a blank name", `mutation { updateNovel(id: \"` + novelID + `\", input: {name: \" \"}) { id } }`, `"field":"name","rule":"blank"`},
		{"too many owners", `{ novels(ownerIDs: [` + tooManyIDs + `]) { totalCount } }`, `"field":"ownerIDs","rule":"too_large","params":{"max":100}`},
		{"too many chapters to mark", `mutation { markChaptersRead(chapterIDs: [` + strings.Repeat(`\"`+novelID+`\",`, 100) + `\"` + novelID + `\"]) { markedCount } }`, `"field":"chapterIDs","rule":"too_large","params":{"max":100}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			handler := newHandler(config.EnvTest)

			recorder := postWithToken(t, handler, `{"query":"`+c.query+`"}`, "Bearer "+writerToken)

			if !strings.Contains(recorder.Body.String(), c.want) || !strings.Contains(recorder.Body.String(), `"code":"BAD_REQUEST"`) {
				t.Errorf("body = %s, want BAD_REQUEST with %s", recorder.Body.String(), c.want)
			}
		})
	}
}

func TestANULAnywhereInAnArgumentIsABadRequest(t *testing.T) {
	cases := []struct {
		name  string
		query string
	}{
		{"in a nested filter variable", `{"query":"query($where: NovelWhereInput) { novels(where: $where) { totalCount } }","variables":{"where":{"hasTagsWith":[{"nameIn":["\u0000"]}]}}}`},
		{"in a literal", `{"query":"{ novels(where: {nameContains: \"a\\u0000\"}) { totalCount } }"}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			handler := newHandler(config.EnvTest)

			recorder := postWithToken(t, handler, c.query, "Bearer "+writerToken)

			if !strings.Contains(recorder.Body.String(), `"code":"BAD_REQUEST"`) || !strings.Contains(recorder.Body.String(), "NUL character") {
				t.Errorf("body = %s, want a bad request about the NUL character", recorder.Body.String())
			}
		})
	}
}
