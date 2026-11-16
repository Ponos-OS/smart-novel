package model

import "github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"

// Check adds what is wrong with the range to check; a nil bound is open.
func (r ChapterCountRangeInput) Check(check *validation.Checker) {
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
