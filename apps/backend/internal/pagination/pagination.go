// Package pagination holds the page size rules every connection shares. The cursors themselves are ent's.
package pagination

import (
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

// Size is how many rows a page has when the caller does not say, and the most it may ask for.
type Size struct {
	Default int
	Max     int
}

// Bound returns first and last with the defaults applied. Without either, the page would be every row, so first is set to the default;
// an oversized or empty page is refused instead of silently cut.
func Bound(
	first, last *int,
	size Size,
) (boundedFirst, boundedLast *int, err error) {
	var check validation.Checker
	if first != nil {
		check.AtLeast("first", *first, 1)
		check.AtMost("first", *first, size.Max)
	}
	if last != nil {
		check.AtLeast("last", *last, 1)
		check.AtMost("last", *last, size.Max)
	}
	if err := check.Err(); err != nil {
		return nil, nil, err
	}
	if first == nil && last == nil {
		return &size.Default, nil, nil
	}

	return first, last, nil
}
