package main

import (
	"math/rand/v2"
	"strings"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
)

const (
	// coverURL is the cover of every generated novel: the image that data/example-novel holds, uploaded by the object storage module.
	coverURL = "http://s3.localhost:8080/smart-novel/covers/71a3fcd8-937d-4e3d-94de-a643ff515f82.png"

	tagPoolSize         = 24
	maxTagsPerNovel     = 3
	minWordsPerChapter  = 2000
	maxWordsPerChapter  = 3500
	descriptionSentence = 3
)

// generateConfig says how much to generate; a zero count generates nothing.
type generateConfig struct {
	Seed             uint64
	Novels           int
	ChaptersPerNovel int
}

// generate returns generateConfig.Novels novels of generateConfig.ChaptersPerNovel chapters each, the same ones for the same Seed.
func generate(config generateConfig) []devdata.Novel {
	if config.Novels <= 0 {
		return nil
	}
	faker := gofakeit.New(config.Seed)
	tags := generateTags(config.Seed)
	novels := make([]devdata.Novel, config.Novels)
	for index := range novels {
		novels[index] = devdata.Novel{
			NovelDetails: devdata.NovelDetails{
				ID:          fakeID(faker),
				Name:        faker.BookTitle(),
				Description: sentences(faker, descriptionSentence),
				Tags:        pickTags(faker, tags),
				State:       state(faker),
				CoverURL:    coverURL,
			},
			Chapters: chapters(faker, config.ChaptersPerNovel),
		}
	}

	return novels
}

// generateTags returns the pool of tags the generated novels pick from, the same ones for the same seed.
func generateTags(seed uint64) []string {
	faker := gofakeit.New(seed)
	seen := map[string]bool{}
	var pool []string
	for len(pool) < tagPoolSize {
		name := strings.ToLower(faker.Word())
		if seen[name] {
			continue
		}
		seen[name] = true
		pool = append(pool, name)
	}

	return pool
}

func fakeID(faker *gofakeit.Faker) uuid.UUID {
	return uuid.MustParse(faker.UUID())
}

func state(faker *gofakeit.Faker) string {
	if faker.Bool() {
		return "ONGOING"
	}

	return "FINISHED"
}

func pickTags(faker *gofakeit.Faker, pool []string) []string {
	count := faker.IntRange(1, maxTagsPerNovel)
	picked := make([]string, 0, count)
	// The seeded source is the point: the same seed has to pick the same tags.
	for _, position := range rand.New(faker.Rand).Perm( //nolint:gosec // reproducible data, not a secret
		len(pool))[:count] {
		picked = append(picked, pool[position])
	}

	return picked
}

func sentences(faker *gofakeit.Faker, count int) string {
	parts := make([]string, count)
	for index := range parts {
		parts[index] = faker.Sentence()
	}

	return strings.Join(parts, " ")
}

func chapters(faker *gofakeit.Faker, count int) []devdata.Chapter {
	generated := make([]devdata.Chapter, max(count, 0))
	for index := range generated {
		generated[index] = devdata.Chapter{
			ID:      fakeID(faker),
			Number:  index + 1,
			Title:   faker.Sentence(),
			Content: chapterText(faker),
		}
	}

	return generated
}

func chapterText(faker *gofakeit.Faker) string {
	target := faker.IntRange(minWordsPerChapter, maxWordsPerChapter)
	var paragraphs []string
	for words := 0; words < target; {
		paragraph := faker.Paragraph()
		paragraphs = append(paragraphs, paragraph)
		words += len(strings.Fields(paragraph))
	}

	return strings.Join(paragraphs, "\n\n")
}
