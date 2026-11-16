// Package platformterms holds the platform terms every writer accepts before changing anything, and who accepted which version.
package platformterms

import (
	_ "embed" // the terms are a markdown file next to the code
	"errors"
	"fmt"
	"strings"

	"github.com/adrg/frontmatter"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

// The following line is a compiler directive. It copies platform-terms.md into the binary at build time

//go:embed platform-terms.md
var source string

var (
	errNoVersion = errors.New("platform terms start with a frontmatter holding a positive integer \"version\"")
	errNoText    = errors.New("platform terms have no text")
)

// Current reads the terms that ship with this build; it fails when the file is malformed, so a bad edit stops the backend from starting.
func Current() (model.PlatformTerms, error) {
	return Parse(source)
}

// Parse reads a markdown file that starts with a frontmatter holding a positive integer `version`.
func Parse(text string) (model.PlatformTerms, error) {
	var header struct {
		Version int `yaml:"version"`
	}
	body, err := frontmatter.Parse(strings.NewReader(text), &header)
	if err != nil {
		return model.PlatformTerms{}, fmt.Errorf("%w: %w", errNoVersion, err)
	}
	if header.Version < 1 {
		return model.PlatformTerms{}, errNoVersion
	}
	markdown := strings.TrimSpace(string(body))
	if markdown == "" {
		return model.PlatformTerms{}, errNoText
	}

	return model.PlatformTerms{Version: header.Version, Markdown: markdown}, nil
}
