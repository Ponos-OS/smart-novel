package novel

import (
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

// CreateInput is what createNovel takes; the schema directives on the input type have cleaned and checked it.
type CreateInput struct {
	Name        string
	Description string
	State       *novel.State
	Tags        []string
	// LicenseID is the license; nil gives the default license.
	LicenseID *uuid.UUID
}

// UpdateInput is what updateNovel takes; a nil field stays as it is, and Tags, when given, replaces the current ones.
type UpdateInput struct {
	Name        *string
	Description *string
	State       *novel.State
	Tags        []string
	// LicenseID is another license; nil keeps the current one.
	LicenseID *uuid.UUID
}

// ChapterCountRange narrows a novel list to the novels with this many chapters; a nil bound is open.
type ChapterCountRange struct {
	Min *int
	Max *int
}

func (r ChapterCountRange) check(check *validation.Checker) {
	if r.Min != nil {
		check.AtLeast("chapterCount.min", *r.Min, 0)
	}
	if r.Max != nil {
		check.AtLeast("chapterCount.max", *r.Max, 0)
	}
	if r.Min != nil && r.Max != nil && *r.Max < *r.Min {
		check.AtLeast("chapterCount.max", *r.Max, *r.Min)
	}
}
