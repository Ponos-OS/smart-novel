package license

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

const (
	turnBody = `{"assistantMessage":"CC BY-NC 4.0 fits.","conversation":[{"role":"user","content":"No sales please"},{"role":"assistant","content":"CC BY-NC 4.0 fits."}],"disclaimers":["This is not legal advice."],"draft":{"title":"CC BY-NC 4.0","text":"# Creative Commons","source":{"type":"forked","canonicalId":"CC-BY-NC-4.0"}},"draftChanged":true,"isReadyToFinalize":false,"recommendations":["CC-BY-NC-4.0"]}`
)

func TestAssistSendsTheConversationAndTheDraftToFithara(t *testing.T) {
	var sent fithara.DraftRequest
	uut := newServiceWithFithara(t, func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&sent); err != nil {
			t.Error(err)
		}
		answer(http.StatusOK, turnBody)(w, r)
	})
	canonicalID := "CC-BY-NC-4.0"

	_, err := uut.Assist(context.Background(), model.DraftLicenseInput{
		Conversation: []*model.LicenseAssistantMessageInput{{Role: model.LicenseAssistantMessageRoleUser, Content: "Hello"}},
		Draft:        &model.LicenseAssistantDraftInput{Name: "Mine", Text: "Text", SourceType: entlicense.SourceTypeFORKED, CanonicalID: &canonicalID},
		Message:      "No sales please",
	})
	if err != nil {
		t.Fatal(err)
	}
	if sent.Message != "No sales please" || sent.Draft.Title != "Mine" || sent.Draft.Source.Type != fithara.Forked || *sent.Draft.Source.CanonicalId != canonicalID {
		t.Errorf("sent %+v", sent)
	}
	if turns := *sent.Conversation; len(turns) != 1 || turns[0].Role != fithara.User {
		t.Errorf("conversation %+v", turns)
	}
}

func TestAssistGivesTheTurnOfFithara(t *testing.T) {
	uut := newServiceWithFithara(t, answer(http.StatusOK, turnBody))

	turn, err := uut.Assist(context.Background(), model.DraftLicenseInput{Message: "No sales please"})
	if err != nil {
		t.Fatal(err)
	}
	if turn.Draft == nil || turn.Draft.SourceType != entlicense.SourceTypeFORKED || *turn.Draft.CanonicalID != "CC-BY-NC-4.0" || !turn.DraftChanged {
		t.Errorf("draft = %+v", turn.Draft)
	}
	if len(turn.Conversation) != 2 || turn.Conversation[1].Role != model.LicenseAssistantMessageRoleAssistant || turn.Disclaimers[0] != "This is not legal advice." {
		t.Errorf("turn = %+v", turn)
	}
}

func TestAssistAnswersWithTheCodeOfWhatFitharaRefused(t *testing.T) {
	cases := map[string]struct {
		status int
		body   string
		code   string
	}{
		"a bad request":     {http.StatusBadRequest, `{"error":{"code":"INVALID_REQUEST","message":"too long"}}`, apperr.CodeLicenseAssistantInvalidRequest},
		"a rate limit":      {http.StatusTooManyRequests, `{"error":{"code":"RATE_LIMITED","message":"slow down"}}`, apperr.CodeLicenseAssistantRateLimited},
		"an unknown draft":  {http.StatusBadRequest, `{"error":{"code":"UNKNOWN_LICENSE","message":"no"}}`, apperr.CodeCanonicalLicenseNotFound},
		"a retired draft":   {http.StatusBadRequest, `{"error":{"code":"LICENSE_INACTIVE","message":"gone"}}`, apperr.CodeCanonicalLicenseRetired},
		"the model is down": {http.StatusBadGateway, `{"error":{"code":"LLM_UNAVAILABLE","message":"down"}}`, apperr.CodeUnavailable},
		"a bad model reply": {http.StatusBadRequest, `{"error":{"code":"LLM_INVALID_OUTPUT","message":"bad"}}`, apperr.CodeUnavailable},
	}
	for name, test := range cases {
		t.Run(name, func(t *testing.T) {
			uut := newServiceWithFithara(t, answer(test.status, test.body))

			_, err := uut.Assist(context.Background(), model.DraftLicenseInput{Message: "Hello"})

			var coded interface{ Code() string }
			if !errors.As(err, &coded) || coded.Code() != test.code {
				t.Errorf("error = %v, want %s", err, test.code)
			}
		})
	}
}
