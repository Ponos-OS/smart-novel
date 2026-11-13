package graph

import (
	"context"
	"reflect"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

// Directives implements the schema directives. @public and @hasRole are markers read by auth.Guard, so running one only continues the
// resolver chain. The input directives run while gqlgen reads an argument or an input field, in the order they are written, so @isString
// comes first. They work on a string, an optional string (nil passes) and a list of strings.
func Directives() DirectiveRoot {
	return DirectiveRoot{
		Public: func(ctx context.Context, _ any, next graphql.Resolver) (any, error) {
			return next(ctx)
		},
		HasRole: func(ctx context.Context, _ any, next graphql.Resolver, _ model.Role) (any, error) {
			return next(ctx)
		},
		IsString: isString,
		MaxLength: func(ctx context.Context, _ any, next graphql.Resolver, maximum int) (any, error) {
			return checkNext(ctx, next, func(c *validation.Checker, field string, texts []string) {
				for _, text := range texts {
					c.MaxLength(field, text, maximum)
				}
			})
		},
		MaxSize: maxSize,
	}
}

func isString(ctx context.Context, _ any, next graphql.Resolver, multiline, allowEmpty bool) (any, error) {
	cleaner := validation.SingleLine
	if multiline {
		cleaner = validation.Text
	}
	value, err := clean(ctx, next, cleaner)
	if err != nil || allowEmpty {
		return value, err
	}

	return checkNext(ctx, func(context.Context) (any, error) { return value, nil }, func(c *validation.Checker, field string, texts []string) {
		for _, text := range texts {
			c.NotBlank(field, text)
		}
	})
}

func maxSize(ctx context.Context, _ any, next graphql.Resolver, maximum int) (any, error) {
	value, err := next(ctx)
	if err != nil {
		return nil, err
	}
	if items := reflect.ValueOf(value); items.Kind() == reflect.Slice {
		var c validation.Checker
		c.AtMost(inputFieldName(ctx), items.Len(), maximum)

		return value, c.Err()
	}

	return value, nil
}

// checkNext hands the strings of the value to a rule; a value that holds none (absent, or not text) passes.
func checkNext(ctx context.Context, next graphql.Resolver, rule func(*validation.Checker, string, []string)) (any, error) {
	value, err := next(ctx)
	if err != nil {
		return nil, err
	}
	var texts []string
	switch typed := value.(type) {
	case string:
		texts = []string{typed}
	case *string:
		if typed != nil {
			texts = []string{*typed}
		}
	case []string:
		texts = typed
	}
	var c validation.Checker
	rule(&c, inputFieldName(ctx), texts)

	return value, c.Err()
}

// clean runs the cleaner on every string of the value, which stays absent when it was. A NUL is refused first, since cleaning would
// drop it without a word.
func clean(ctx context.Context, next graphql.Resolver, cleaner func(string) string) (any, error) {
	value, err := next(ctx)
	if err != nil {
		return nil, err
	}
	switch typed := value.(type) {
	case string:
		return cleanOne(typed, cleaner)
	case *string:
		return cleanOptional(typed, cleaner)
	case []string:
		return cleanList(typed, cleaner)
	}

	return value, nil
}

func cleanOptional(text *string, cleaner func(string) string) (any, error) {
	if text == nil {
		return text, nil
	}
	cleaned, err := cleanOne(*text, cleaner)
	if err != nil {
		return nil, err
	}

	return &cleaned, nil
}

func cleanList(texts []string, cleaner func(string) string) (any, error) {
	if texts == nil {
		return texts, nil
	}
	cleaned := make([]string, len(texts))
	for index, text := range texts {
		one, err := cleanOne(text, cleaner)
		if err != nil {
			return nil, err
		}
		cleaned[index] = one
	}

	return cleaned, nil
}

func cleanOne(text string, cleaner func(string) string) (string, error) {
	if strings.ContainsRune(text, 0) {
		return "", apperr.BadRequest(validation.NULMessage)
	}

	return cleaner(text), nil
}

// inputFieldName is the name of the argument or input field gqlgen is reading, the last element of its path.
func inputFieldName(ctx context.Context) string {
	path := graphql.GetPath(ctx)
	if len(path) == 0 {
		return ""
	}
	if name, ok := path[len(path)-1].(ast.PathName); ok {
		return string(name)
	}

	return ""
}
