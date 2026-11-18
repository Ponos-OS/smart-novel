package devdata

import (
	"slices"
	"strings"

	"github.com/google/uuid"
)

// NovelDetails is what a novel is before its chapters.
type NovelDetails struct {
	ID          uuid.UUID
	Name        string
	Description string
	Tags        []string
	State       string
	CoverURL    string
	License     string
}

// Chapter is one chapter of a Novel.
type Chapter struct {
	ID      uuid.UUID
	Number  int
	Title   string
	Content string
}

// Novel is a novel to seed with its chapters.
type Novel struct {
	NovelDetails
	Chapters []Chapter
}

// UniqueTags is every tag the novels use, lowercased, once, in order.
func UniqueTags(novels []Novel) []string {
	var tags []string
	for _, novel := range novels {
		for _, name := range novel.Tags {
			tags = append(tags, strings.ToLower(name))
		}
	}
	slices.Sort(tags)

	return slices.Compact(tags)
}
