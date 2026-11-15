// The chat with Fithara behind the draftLicense mutation. Nothing is stored here; the stored drafts are in drafts.go.
package license

import (
	"context"
	"fmt"
	"log/slog"

	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

// AssistantRole says who wrote a message of the conversation.
type AssistantRole string

const (
	AssistantRoleAssistant AssistantRole = "ASSISTANT"
	AssistantRoleUser      AssistantRole = "USER"
)

type AssistantMessage struct {
	Role    AssistantRole
	Content string
}

// AssistantDraft is the license text being worked on, as the client holds it.
type AssistantDraft struct {
	Name        string
	Text        string
	SourceType  entlicense.SourceType
	CanonicalID *string
}

type AssistantPreferences struct {
	Category *string
}

// AssistantRequest is one message to the assistant with everything it needs: nothing is stored, the client sends the conversation and the draft.
type AssistantRequest struct {
	Conversation []AssistantMessage
	Draft        *AssistantDraft
	Message      string
	Preferences  *AssistantPreferences
}

type AssistantTurn struct {
	AssistantMessage  string
	Draft             *AssistantDraft
	DraftChanged      bool
	Recommendations   []string
	Disclaimers       []string
	IsReadyToFinalize bool
	Conversation      []AssistantMessage
}

// Assist sends one message to Fithara.
func (s *Service) Assist(ctx context.Context, request AssistantRequest) (*AssistantTurn, error) {
	response, err := s.fitharaClient.DraftV1DraftPostWithResponse(ctx, toFitharaRequest(request))
	if err != nil {
		return nil, s.assistantUnavailable(ctx, err)
	}
	if response.JSON200 == nil {
		return nil, s.assistantError(ctx, response)
	}

	return toAssistantTurn(response.JSON200), nil
}

// assistantError turns what Fithara refused with into the error of the client; its own failures (the model down, a bad model answer) are all
// unavailable for the caller.
func (s *Service) assistantError(ctx context.Context, response *fithara.DraftV1DraftPostResponse) error {
	refusal := response.JSON400
	if refusal == nil {
		refusal = response.JSON429
	}
	if refusal == nil {
		return s.assistantUnavailable(ctx, fmt.Errorf("%w: %d", errUnexpectedStatus, response.StatusCode()))
	}
	s.logger.WarnContext(ctx, "Fithara refused the request", slog.String(logKeyFitharaCode, string(refusal.Error.Code)), slog.String(logKeyRequestID, requestID(refusal)))

	switch refusal.Error.Code {
	case fithara.INVALIDREQUEST:
		return apperr.WithCode(apperr.CodeLicenseAssistantInvalidRequest, refusal.Error.Message)
	case fithara.RATELIMITED:
		return apperr.WithCode(apperr.CodeLicenseAssistantRateLimited, refusal.Error.Message)
	case fithara.UNKNOWNLICENSE:
		return apperr.WithCode(apperr.CodeCanonicalLicenseNotFound, refusal.Error.Message)
	case fithara.LICENSEINACTIVE:
		return apperr.WithCode(apperr.CodeCanonicalLicenseRetired, refusal.Error.Message)
	case fithara.INTERNAL, fithara.LLMINVALIDOUTPUT, fithara.LLMUNAVAILABLE:
	}

	return apperr.Unavailable("The license assistant is not available right now. Try again later.")
}

func requestID(refusal *fithara.ErrorResponse) string {
	if refusal.Error.RequestId == nil {
		return ""
	}

	return *refusal.Error.RequestId
}

func toFitharaRequest(request AssistantRequest) fithara.DraftRequest {
	conversation := make([]fithara.ConversationTurn, 0, len(request.Conversation))
	for _, message := range request.Conversation {
		conversation = append(conversation, fithara.ConversationTurn{Role: toFitharaRole(message.Role), Content: message.Content})
	}
	out := fithara.DraftRequest{Message: request.Message, Conversation: &conversation}
	if request.Draft != nil {
		out.Draft = &fithara.Draft{
			Title:  request.Draft.Name,
			Text:   request.Draft.Text,
			Source: fithara.DraftSource{Type: toFitharaSourceType(request.Draft.SourceType), CanonicalId: request.Draft.CanonicalID},
		}
	}
	if request.Preferences != nil && request.Preferences.Category != nil {
		out.Preferences = &fithara.Preferences{Category: request.Preferences.Category}
	}

	return out
}

func toAssistantTurn(response *fithara.DraftResponse) *AssistantTurn {
	conversation := make([]AssistantMessage, 0, len(response.Conversation))
	for _, turn := range response.Conversation {
		conversation = append(conversation, AssistantMessage{Role: toAssistantRole(turn.Role), Content: turn.Content})
	}
	turn := &AssistantTurn{
		AssistantMessage:  response.AssistantMessage,
		DraftChanged:      response.DraftChanged,
		Recommendations:   response.Recommendations,
		Disclaimers:       response.Disclaimers,
		IsReadyToFinalize: response.IsReadyToFinalize,
		Conversation:      conversation,
	}
	if response.Draft != nil {
		turn.Draft = &AssistantDraft{
			Name:        response.Draft.Title,
			Text:        response.Draft.Text,
			SourceType:  toSourceType(response.Draft.Source.Type),
			CanonicalID: response.Draft.Source.CanonicalId,
		}
	}

	return turn
}

func toFitharaRole(role AssistantRole) fithara.ConversationTurnRole {
	if role == AssistantRoleUser {
		return fithara.User
	}

	return fithara.Assistant
}

func toAssistantRole(role fithara.ConversationTurnRole) AssistantRole {
	if role == fithara.User {
		return AssistantRoleUser
	}

	return AssistantRoleAssistant
}

func toFitharaSourceType(sourceType entlicense.SourceType) fithara.DraftSourceType {
	switch sourceType {
	case entlicense.SourceTypeCANONICAL:
		return fithara.Canonical
	case entlicense.SourceTypeFORKED:
		return fithara.Forked
	case entlicense.SourceTypeCUSTOM:
	}

	return fithara.Custom
}

func toSourceType(sourceType fithara.DraftSourceType) entlicense.SourceType {
	switch sourceType {
	case fithara.Canonical:
		return entlicense.SourceTypeCANONICAL
	case fithara.Forked:
		return entlicense.SourceTypeFORKED
	case fithara.Custom:
	}

	return entlicense.SourceTypeCUSTOM
}
