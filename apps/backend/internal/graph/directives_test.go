package graph_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/99designs/gqlgen/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
)

func returning(value any) graphql.Resolver {
	return func(context.Context) (any, error) { return value, nil }
}

func isString(
	t *testing.T,
	value any,
	multiline, allowEmpty bool,
) (any, error) {
	t.Helper()

	return graph.Directives().
		IsString(t.Context(), nil, returning(value), multiline, allowEmpty, nil)
}

func TestIsStringCleans(t *testing.T) {
	cases := []struct {
		name      string
		multiline bool
		value     string
		want      string
	}{
		{
			"a name is one line",
			false,
			"  The   Dry\n Sea\u200b ",
			"The Dry Sea",
		},
		{
			"a chapter keeps its line breaks",
			true,
			"\r\n# The Dry Sea\r\n\r\nText.\n",
			"# The Dry Sea\n\nText.",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result, err := isString(t, c.value, c.multiline, false)

			if err != nil || result != c.want {
				t.Errorf("result = %q, err = %v, want %q", result, err, c.want)
			}
		})
	}
}

func TestIsStringOnAnOptionalValue(t *testing.T) {
	subtitle := "  The   Dry\tSea "
	var absent *string

	set, setErr := isString(t, &subtitle, false, false)
	none, noneErr := isString(t, absent, false, false)

	if got, ok := set.(*string); setErr != nil || !ok || *got != "The Dry Sea" {
		t.Errorf("set = %v, err = %v", set, setErr)
	}
	if got, ok := none.(*string); noneErr != nil || !ok || got != nil {
		t.Errorf("none = %v, err = %v, want nil", none, noneErr)
	}
}

func TestIsStringOnAList(t *testing.T) {
	list, err := isString(
		t,
		[]string{"  slice \t of life ", "epic"},
		false,
		false,
	)
	_, blankItemErr := isString(t, []string{"epic", " "}, false, false)

	if got, ok := list.([]string); err != nil || !ok || len(got) != 2 ||
		got[0] != "slice of life" ||
		got[1] != "epic" {
		t.Errorf("list = %v, err = %v", list, err)
	}
	if blankItemErr == nil {
		t.Error("a blank item must be refused")
	}
}

func TestIsStringKeepsAbsentAndEmptyListsApart(t *testing.T) {
	absent, absentErr := isString(t, []string(nil), false, false)
	empty, emptyErr := isString(t, []string{}, false, false)

	if got, ok := absent.([]string); absentErr != nil || !ok || got != nil {
		t.Errorf(
			"absent = %#v, err = %v, want nil, since nil keeps the tags of a novel",
			absent,
			absentErr,
		)
	}
	if got, ok := empty.([]string); emptyErr != nil || !ok || got == nil ||
		len(got) != 0 {
		t.Errorf(
			"empty = %#v, err = %v, want empty, since empty removes the tags",
			empty,
			emptyErr,
		)
	}
}

func TestIsStringRefusesNUL(t *testing.T) {
	withNUL := "The Dry\x00 Sea"
	for name, value := range map[string]any{"text": withNUL, "optional text": &withNUL, "list": []string{withNUL}} {
		t.Run(name, func(t *testing.T) {
			_, err := isString(t, value, false, true)

			var coded interface{ Code() string }
			if !errors.As(err, &coded) ||
				coded.Code() != apperr.CodeBadRequest {
				t.Errorf("err = %v, want a bad request", err)
			}
		})
	}
}

func TestIsStringBlank(t *testing.T) {
	cases := []struct {
		name       string
		value      string
		allowEmpty bool
		invalid    bool
	}{
		{"text", "The Dry Sea", false, false},
		{"white space only", " \n\t", false, true},
		{"invisible characters only", "\u200b\u2060", false, true},
		{"empty", "", false, true},
		{"empty when it may be", "", true, false},
		{"white space only when it may be empty", " \n", true, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := isString(t, c.value, false, c.allowEmpty)

			if (err != nil) != c.invalid {
				t.Errorf("err = %v, want invalid = %v", err, c.invalid)
			}
		})
	}
}

func TestMaxLengthDirective(t *testing.T) {
	cases := []struct {
		name    string
		value   any
		invalid bool
	}{
		{"as long as allowed, counted in characters", "ééééé", false},
		{"one character too many", "éééééé", true},
		{"optional text that is absent", (*string)(nil), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := graph.Directives().
				MaxLength(t.Context(), nil, returning(c.value), 5, nil)

			if (err != nil) != c.invalid {
				t.Errorf("err = %v, want invalid = %v", err, c.invalid)
			}
		})
	}
}

func TestMaxSizeDirective(t *testing.T) {
	cases := []struct {
		name    string
		value   any
		invalid bool
	}{
		{"as many as allowed", []string{"a", "b"}, false},
		{"one too many", []string{"a", "b", "c"}, true},
		{"absent list", []string(nil), false},
		{"not a list", "abc", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := graph.Directives().
				MaxSize(t.Context(), nil, returning(c.value), 2)

			if (err != nil) != c.invalid {
				t.Errorf("err = %v, want invalid = %v", err, c.invalid)
			}
		})
	}
}

func TestMinLengthDirective(t *testing.T) {
	cases := []struct {
		name    string
		value   any
		invalid bool
	}{
		{"as short as allowed, counted in characters", "ééé", false},
		{"one character too few", "éé", true},
		{"optional text that is absent", (*string)(nil), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := graph.Directives().
				MinLength(t.Context(), nil, returning(c.value), 3, nil)

			if (err != nil) != c.invalid {
				t.Errorf("err = %v, want invalid = %v", err, c.invalid)
			}
		})
	}
}

func TestPatternDirective(t *testing.T) {
	cases := []struct {
		name    string
		value   any
		invalid bool
	}{
		{"letters, hyphens and underscores", "Mina_T-Ardalan", false},
		{"a digit", "Mina2", true},
		{"a space", "Mina T", true},
		{"another alphabet", "مینا", true},
		{"optional text that is absent", (*string)(nil), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := graph.Directives().
				Pattern(t.Context(), nil, returning(c.value), "^[A-Za-z_-]+$", nil)

			if (err != nil) != c.invalid {
				t.Errorf("err = %v, want invalid = %v", err, c.invalid)
			}
		})
	}
}

func TestPatternDirectiveRefusesAnExpressionItCannotCompile(t *testing.T) {
	_, err := graph.Directives().
		Pattern(t.Context(), nil, returning("Mina"), "^(Mina", nil)

	if err == nil {
		t.Error("err = nil, want the invalid expression reported")
	}
}

func TestValidationDirectivesAnswerWithTheMessageTheSchemaGives(t *testing.T) {
	message := "A pen name needs at least 3 characters"
	directives := graph.Directives()
	cases := []struct {
		name string
		run  func() error
	}{
		{"isString", func() error {
			_, err := directives.IsString(
				t.Context(),
				nil,
				returning(" "),
				false,
				false,
				&message,
			)
			return err
		}},
		{"minLength", func() error {
			_, err := directives.MinLength(
				t.Context(),
				nil,
				returning("ab"),
				3,
				&message,
			)
			return err
		}},
		{"maxLength", func() error {
			_, err := directives.MaxLength(
				t.Context(),
				nil,
				returning("abcd"),
				3,
				&message,
			)
			return err
		}},
		{"pattern", func() error {
			_, err := directives.Pattern(
				t.Context(),
				nil,
				returning("a1"),
				"^[a-z]+$",
				&message,
			)
			return err
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.run()

			var coded interface{ Code() string }
			if err == nil || err.Error() != message ||
				!errors.As(err, &coded) ||
				coded.Code() != apperr.CodeBadRequest {
				t.Errorf("err = %v, want a BAD_REQUEST saying %q", err, message)
			}
		})
	}
}

func TestOnlyTheseMutationsSkipTheTermsOfServiceCheck(t *testing.T) {
	schema := graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{}, Directives: graph.Directives()}).
		Schema()
	var skipping []string

	for _, field := range schema.Mutation.Fields {
		if field.Directives.ForName("skipTermsOfServiceCheck") != nil {
			skipping = append(skipping, field.Name)
		}
	}

	slices.Sort(skipping)
	want := []string{
		"acceptPlatformTerms",
		"deleteReadHistory",
		"explain",
		"markChaptersRead",
		"requestWriterAccess",
	}
	if !slices.Equal(skipping, want) {
		t.Errorf(
			"mutations that skip the terms check = %v, want %v: every other mutation needs the terms accepted",
			skipping,
			want,
		)
	}
}
