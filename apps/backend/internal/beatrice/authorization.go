package beatrice

import (
	"context"
	"net/http"
)

type authorizationKey struct{}

// WithAuthorization makes the calls made with the returned context carry the bearer token. Beatrice relays it on the callbacks it makes for the job it starts, and those are guarded here.
func WithAuthorization(
	ctx context.Context,
	bearerToken string,
) context.Context {
	return context.WithValue(ctx, authorizationKey{}, bearerToken)
}

// HTTPClient sends the requests of the generated client. It adds the Authorization header of the context of each when it has one, and it takes 202 Accepted as the success it is: Beatrice answers that, with the GraphQL answer in the body, for a job it has queued, and the generated client accepts only 200.
type HTTPClient struct {
	HTTP *http.Client
}

func (c HTTPClient) Do(req *http.Request) (*http.Response, error) {
	if token, ok := req.Context().Value(authorizationKey{}).(string); ok &&
		token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.HTTP.Do( //nolint:gosec // the URL is BEATRICE_URL from the configuration, not something a caller chooses
		req,
	)
	if err == nil && resp.StatusCode == http.StatusAccepted {
		resp.StatusCode, resp.Status = http.StatusOK, "200 OK"
	}

	return resp, err
}
