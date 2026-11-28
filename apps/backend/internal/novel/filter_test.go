package novel_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

func violations(t *testing.T, err error) []validation.Violation {
	t.Helper()
	var invalid *validation.Error
	if !errors.As(err, &invalid) {
		t.Fatalf("err = %v, want a validation error", err)
	}

	return invalid.Violations
}

func TestPredicatesRefuses(t *testing.T) {
	cases := []struct {
		name         string
		chapterCount *model.ChapterCountRangeInput
		ownerIDs     []string
		field        string
	}{
		{
			"a maximum below the minimum",
			&model.ChapterCountRangeInput{Min: new(5), Max: new(1)},
			nil,
			"chapterCount.max",
		},
		{
			"a negative minimum",
			&model.ChapterCountRangeInput{Min: new(-1)},
			nil,
			"chapterCount.min",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := novel.Predicates(c.chapterCount, c.ownerIDs)

			if got := violations(
				t,
				err,
			); len(got) != 1 ||
				got[0].Field != c.field {
				t.Errorf("violations = %+v, want one on %s", got, c.field)
			}
		})
	}
}

func TestPredicatesCountsWhatWasAskedFor(t *testing.T) {
	cases := []struct {
		name         string
		chapterCount *model.ChapterCountRangeInput
		ownerIDs     []string
		want         int
	}{
		{"nothing asked", nil, nil, 0},
		{"an empty list of owners is no filter", nil, []string{}, 0},
		{"a minimum", &model.ChapterCountRangeInput{Min: new(2)}, nil, 1},
		{
			"a range",
			&model.ChapterCountRangeInput{Min: new(1), Max: new(2)},
			nil,
			2,
		},
		{
			"owners and a maximum",
			&model.ChapterCountRangeInput{Max: new(0)},
			[]string{"316784561234"},
			2,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			predicates, err := novel.Predicates(c.chapterCount, c.ownerIDs)

			if err != nil || len(predicates) != c.want {
				t.Errorf(
					"predicates = %d, err = %v, want %d",
					len(predicates),
					err,
					c.want,
				)
			}
		})
	}
}
