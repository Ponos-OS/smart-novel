package examplenovel_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/tools/examplenovel"
)

func TestNovelChapters(t *testing.T) {
	novel := examplenovel.Novel()

	if len(novel.Chapters) != 5 {
		t.Fatalf("chapters = %d, want 5", len(novel.Chapters))
	}
	seen := map[string]bool{}
	for index, chapter := range novel.Chapters {
		if chapter.Number != index+1 {
			t.Errorf(
				"chapter %q has number %d, want %d",
				chapter.Title,
				chapter.Number,
				index+1,
			)
		}
		if seen[chapter.ID.String()] {
			t.Errorf("chapter ID %s is used twice", chapter.ID)
		}
		seen[chapter.ID.String()] = true
		if chapter.Content == "" || chapter.Title == "" {
			t.Errorf("chapter %d has no title or content", chapter.Number)
		}
	}
}
