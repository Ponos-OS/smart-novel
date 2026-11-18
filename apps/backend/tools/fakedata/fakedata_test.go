package fakedata_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/tools/fakedata"
)

func config() fakedata.Config {
	return fakedata.Config{
		Seed:             20260101,
		Novels:           4,
		ChaptersPerNovel: 2,
	}
}

func TestGenerateSameSeedSameNovels(t *testing.T) {
	first := fakedata.Generate(config())

	second := fakedata.Generate(config())

	if !reflect.DeepEqual(first, second) {
		t.Error("two runs with the same seed differ")
	}
}

func TestGenerateOtherSeedOtherNovels(t *testing.T) {
	other := config()
	other.Seed++

	novels := fakedata.Generate(other)

	if reflect.DeepEqual(fakedata.Generate(config()), novels) {
		t.Error("two seeds gave the same novels")
	}
}

func TestGenerateHonorsCounts(t *testing.T) {
	novels := fakedata.Generate(config())

	if len(novels) != 4 {
		t.Fatalf("novels = %d, want 4", len(novels))
	}
	ids := map[string]bool{}
	for _, novel := range novels {
		ids[novel.ID.String()] = true
		if len(novel.Chapters) != 2 {
			t.Errorf("chapters = %d, want 2", len(novel.Chapters))
		}
		if novel.CoverURL != fakedata.CoverURL {
			t.Errorf("cover = %q, want %q", novel.CoverURL, fakedata.CoverURL)
		}
		if len(novel.Tags) == 0 {
			t.Error("a novel has no tag")
		}
	}
	if len(ids) != 4 {
		t.Errorf("distinct novel IDs = %d, want 4", len(ids))
	}
}

func TestGenerateChaptersHaveSeveralThousandWords(t *testing.T) {
	novels := fakedata.Generate(config())

	for _, chapter := range novels[0].Chapters {
		if words := len(strings.Fields(chapter.Content)); words < 2000 {
			t.Errorf(
				"chapter %d has %d words, want 2000 or more",
				chapter.Number,
				words,
			)
		}
	}
	if novels[0].Chapters[1].Number != 2 {
		t.Errorf("number = %d, want 2", novels[0].Chapters[1].Number)
	}
}

func TestGenerateNothingAtZero(t *testing.T) {
	zero := config()
	zero.Novels = 0

	novels := fakedata.Generate(zero)

	if len(novels) != 0 {
		t.Errorf("novels = %d, want 0", len(novels))
	}
}
