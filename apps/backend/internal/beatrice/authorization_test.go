package beatrice_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	genqlient "github.com/Khan/genqlient/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/beatrice"
)

func TestHTTPClientTakesAcceptedAsSuccessAndSendsTheTokenOfTheContext(
	t *testing.T,
) {
	var authorization string
	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authorization = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			if _, err := w.Write(
				[]byte(
					`{"data":{"generateAudio":{"jobId":"2bce49d6-6592-4ed3-b421-f913b9ecc3bd"}}}`,
				),
			); err != nil {
				t.Error(err)
			}
		}),
	)
	t.Cleanup(server.Close)
	client := genqlient.NewClient(
		server.URL,
		beatrice.HTTPClient{HTTP: server.Client()},
	)

	response, err := beatrice.GenerateAudio(
		beatrice.WithAuthorization(t.Context(), "writer-token"),
		client,
		"Hello.",
		"alloy",
		"http://backend:3000/a",
		"http://backend:3000/b",
		"4dd92f16-4743-47b9-960c-6529678e9bc5",
	)

	if err != nil ||
		response.GenerateAudio.JobId != "2bce49d6-6592-4ed3-b421-f913b9ecc3bd" {
		t.Errorf("response = %+v, err = %v", response, err)
	}
	if authorization != "Bearer writer-token" {
		t.Errorf("Authorization = %q", authorization)
	}
}

func TestHTTPClientSendsNoAuthorizationWithoutAToken(t *testing.T) {
	var authorization string
	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authorization = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			if _, err := w.Write(
				[]byte(
					`{"data":{"explainWord":{"meaning":"m","simplifiedExplanation":"s","synonyms":[],"antonyms":[]}}}`,
				),
			); err != nil {
				t.Error(err)
			}
		}),
	)
	t.Cleanup(server.Close)
	client := genqlient.NewClient(
		server.URL,
		beatrice.HTTPClient{HTTP: server.Client()},
	)

	_, err := beatrice.ExplainWord(
		t.Context(),
		client,
		"scrutinize",
		"The detective scrutinized the crime scene.",
	)

	if err != nil || authorization != "" {
		t.Errorf("err = %v, Authorization = %q", err, authorization)
	}
}
