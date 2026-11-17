package devdata_test

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
)

func TestParseChapter(t *testing.T) {
	text := []byte(
		"---\r\nid: '4dd92f16-4743-47b9-960c-6529678e9bc5'\r\ntitle: 'The Beginning'\r\n---\r\n\r\n# Chapter 1\r\n\r\nIn a small village.\r\n",
	)

	chapter, err := devdata.ParseChapter(text)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if chapter.ID != uuid.MustParse("4dd92f16-4743-47b9-960c-6529678e9bc5") ||
		chapter.Title != "The Beginning" {
		t.Errorf("chapter = %+v", chapter)
	}
	if want := "# Chapter 1\n\nIn a small village."; chapter.Content != want {
		t.Errorf("content = %q, want %q", chapter.Content, want)
	}
}

func TestParseChapterRefuses(t *testing.T) {
	cases := map[string]string{
		"no front matter":     "# Chapter 1",
		"open front matter":   "---\nid: x\n",
		"no id":               "---\ntitle: 'A'\n---\nbody",
		"an id that is no ID": "---\nid: 'chapter-one'\n---\nbody",
	}
	for name, text := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := devdata.ParseChapter([]byte(text))

			if err == nil {
				t.Error("err = nil, want an error")
			}
		})
	}
}

func TestLoadChaptersOrdersByNumber(t *testing.T) {
	dir := t.TempDir()
	write := func(name, id string) {
		content := "---\nid: '" + id + "'\ntitle: '" + name + "'\n---\nbody"
		if err := os.WriteFile(
			filepath.Join(dir, name),
			[]byte(content),
			0o600,
		); err != nil {
			t.Fatal(err)
		}
	}
	write("chapter10.md", "00000000-0000-4000-8000-000000000010")
	write("chapter2.md", "00000000-0000-4000-8000-000000000002")
	if err := os.WriteFile(
		filepath.Join(dir, "details.json"),
		[]byte("{}"),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	chapters, err := devdata.LoadChapters(dir)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	numbers := []int{chapters[0].Number, chapters[1].Number}
	if len(chapters) != 2 || !reflect.DeepEqual(numbers, []int{2, 10}) {
		t.Errorf("numbers = %v, want [2 10]", numbers)
	}
}

func TestUniqueTags(t *testing.T) {
	novels := []devdata.NovelDetails{
		{Tags: []string{"Fantasy", "adventure"}},
		{Tags: []string{"fantasy"}},
	}

	tags := devdata.UniqueTags(novels)

	if want := []string{
		"adventure",
		"fantasy",
	}; !reflect.DeepEqual(
		tags,
		want,
	) {
		t.Errorf("tags = %v, want %v", tags, want)
	}
}
