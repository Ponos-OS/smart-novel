// Package devdata fills a fresh database with the data the local stack and the e2e tests expect, none of it for production: the default license, the tags and novels
// of the example data, and the writers Terraform created accounts for.
package devdata

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// NovelDetails is the details.json of a novel directory.
type NovelDetails struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Tags        []string  `json:"tags"`
	State       string    `json:"state"`
	CoverURL    string    `json:"coverUrl"`
	License     string    `json:"license"`
}

// Chapter is one chapterN.md of a novel directory.
type Chapter struct {
	ID      uuid.UUID
	Number  int
	Title   string
	Content string
}

var (
	ErrNoFrontMatter        = errors.New("no front matter")
	ErrFrontMatterNotClosed = errors.New("front matter is not closed")
	ErrFrontMatterNoID      = errors.New("front matter has no id")
)

var chapterFile = regexp.MustCompile(`(?i)^chapter(\d+)\.md$`)

// LoadChapters reads the chapterN.md files of a novel directory in chapter order.
func LoadChapters(dir string) ([]Chapter, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var chapters []Chapter
	for _, entry := range entries {
		match := chapterFile.FindStringSubmatch(entry.Name())
		if match == nil {
			continue
		}
		number, err := strconv.Atoi(match[1])
		if err != nil {
			return nil, fmt.Errorf("chapter number of %s: %w", entry.Name(), err)
		}
		text, err := os.ReadFile(filepath.Join(dir, entry.Name())) //nolint:gosec // devdata reads the data directory its operator mounted
		if err != nil {
			return nil, err
		}
		chapter, err := ParseChapter(text)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", entry.Name(), err)
		}
		chapter.Number = number
		chapters = append(chapters, chapter)
	}
	sort.Slice(chapters, func(i, j int) bool { return chapters[i].Number < chapters[j].Number })

	return chapters, nil
}

// ParseChapter splits a chapter file into its front matter (id and title) and the markdown after it.
func ParseChapter(text []byte) (Chapter, error) {
	const fence = "---"
	text = bytes.ReplaceAll(text, []byte("\r\n"), []byte("\n"))
	rest, found := bytes.CutPrefix(text, []byte(fence+"\n"))
	if !found {
		return Chapter{}, ErrNoFrontMatter
	}
	header, body, found := bytes.Cut(rest, []byte("\n"+fence))
	if !found {
		return Chapter{}, ErrFrontMatterNotClosed
	}
	var meta struct {
		ID    string `yaml:"id"`
		Title string `yaml:"title"`
	}
	if err := yaml.Unmarshal(header, &meta); err != nil {
		return Chapter{}, fmt.Errorf("front matter: %w", err)
	}
	if meta.ID == "" {
		return Chapter{}, ErrFrontMatterNoID
	}
	id, err := uuid.Parse(meta.ID)
	if err != nil {
		return Chapter{}, fmt.Errorf("front matter id: %w", err)
	}

	return Chapter{ID: id, Title: meta.Title, Content: strings.TrimSpace(string(body))}, nil
}

// UniqueTags is every tag the novels use, lowercased, once, in order.
func UniqueTags(novels []NovelDetails) []string {
	var tags []string
	for _, details := range novels {
		for _, name := range details.Tags {
			tags = append(tags, strings.ToLower(name))
		}
	}
	slices.Sort(tags)

	return slices.Compact(tags)
}
