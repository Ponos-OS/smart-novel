package server

import (
	"context"
	"errors"
	"log/slog"
	"maps"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

const (
	codeInternal   = "INTERNAL_SERVER_ERROR"
	codeValidation = "GRAPHQL_VALIDATION_FAILED"

	logKeyPath    = "path"
	logKeyCode    = "code"
	logKeyMessage = "message"
	logKeyError   = "error"
	logKeyAddr    = "addr"

	logKeyMethod     = "method"
	logKeyStatus     = "status"
	logKeyDurationMS = "duration_ms"
	logKeyPanic      = "panic"
	logKeyStack      = "stack"

	extensionCode = "code"

	// introspectionDisabled is gqlgen's own message; it has no sentinel error to compare with.
	introspectionDisabled = "introspection disabled"
)

// ClientError is an error a client may see: the message is meant for them and Code goes to extensions.code.
type ClientError interface {
	error
	Code() string
}

// extended is a ClientError with more to tell the client than a code, for example which input fields were wrong.
type extended interface {
	Extensions() map[string]any
}

// errorPresenter logs every error and shows a client only what it may see; other resolver errors become a generic one.
func errorPresenter(logger *slog.Logger) graphql.ErrorPresenterFunc {
	return func(ctx context.Context, err error) *gqlerror.Error {
		presented := graphql.DefaultErrorPresenter(ctx, err)
		if presented.Err == nil {
			logger.WarnContext(ctx, "graphql error",
				slog.String(logKeyPath, presented.Path.String()),
				slog.String(logKeyMessage, presented.Message),
			)

			return presented
		}

		if presented.Err.Error() == introspectionDisabled {
			logger.WarnContext(
				ctx,
				introspectionDisabled,
				slog.String(logKeyPath, presented.Path.String()),
			)
			presented.Extensions = map[string]any{extensionCode: codeValidation}

			return presented
		}

		if client, ok := errors.AsType[ClientError](presented.Err); ok {
			logger.WarnContext(ctx, "client error",
				slog.String(logKeyPath, presented.Path.String()),
				slog.String(logKeyCode, client.Code()),
				slog.String(logKeyMessage, client.Error()),
			)
			presented.Message = client.Error()
			presented.Extensions = map[string]any{extensionCode: client.Code()}
			var more extended
			if errors.As(presented.Err, &more) {
				maps.Copy(presented.Extensions, more.Extensions())
			}

			return presented
		}

		logger.ErrorContext(ctx, "resolver failed",
			slog.String(logKeyPath, presented.Path.String()),
			slog.Any(logKeyError, presented.Err),
		)

		return &gqlerror.Error{
			Message:    "Internal server error",
			Path:       presented.Path,
			Extensions: map[string]any{extensionCode: codeInternal},
		}
	}
}
