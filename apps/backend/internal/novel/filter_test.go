package novel_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
)

func intPtr(value int) *int { return &value }

func TestPredicatesRefuses(t *testing.T) {
	cases := []struct {
		name         string
		chapterCount *novel.ChapterCountRange
		ownerIDs     []string
		field        string
	}{
		{"a maximum below the minimum", &novel.ChapterCountRange{Min: intPtr(5), Max: intPtr(1)}, nil, "chapterCount.max"},
		{"a negative minimum", &novel.ChapterCountRange{Min: intPtr(-1)}, nil, "chapterCount.min"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := novel.Predicates(c.chapterCount, c.ownerIDs)

			if got := violations(t, err); len(got) != 1 || got[0].Field != c.field {
				t.Errorf("violations = %+v, want one on %s", got, c.field)
			}
		})
	}
}

func TestPredicatesCountsWhatWasAskedFor(t *testing.T) {
	cases := []struct {
		name         string
		chapterCount *novel.ChapterCountRange
		ownerIDs     []string
		want         int
	}{
		{"nothing asked", nil, nil, 0},
		{"an empty list of owners is no filter", nil, []string{}, 0},
		{"a minimum", &novel.ChapterCountRange{Min: intPtr(2)}, nil, 1},
		{"a range", &novel.ChapterCountRange{Min: intPtr(1), Max: intPtr(2)}, nil, 2},
		{"owners and a maximum", &novel.ChapterCountRange{Max: intPtr(0)}, []string{"316784561234"}, 2},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			predicates, err := novel.Predicates(c.chapterCount, c.ownerIDs)

			if err != nil || len(predicates) != c.want {
				t.Errorf("predicates = %d, err = %v, want %d", len(predicates), err, c.want)
			}
		})
	}
}
