package pagination_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/pagination"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

var tagsPage = pagination.Size{Default: 20, Max: 100}

func TestBound(t *testing.T) {
	cases := []struct {
		name      string
		first     *int
		last      *int
		wantFirst *int
		wantLast  *int
	}{
		{"neither asks for the default first", nil, nil, new(20), nil},
		{"first is kept", new(5), nil, new(5), nil},
		{"last is kept without a first", nil, new(7), nil, new(7)},
		{"the maximum is allowed", new(100), nil, new(100), nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			first, last, err := pagination.Bound(c.first, c.last, tagsPage)
			if err != nil {
				t.Fatalf("err = %v", err)
			}
			if !equal(first, c.wantFirst) || !equal(last, c.wantLast) {
				t.Errorf(
					"first, last = %v, %v, want %v, %v",
					deref(first),
					deref(last),
					deref(c.wantFirst),
					deref(c.wantLast),
				)
			}
		})
	}
}

func TestBoundRefusesAnEmptyOrOversizedPage(t *testing.T) {
	cases := []struct {
		name  string
		first *int
		last  *int
	}{
		{"first below one", new(0), nil},
		{"last below one", nil, new(-1)},
		{"first above the maximum", new(101), nil},
		{"last above the maximum", nil, new(101)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, _, err := pagination.Bound(c.first, c.last, tagsPage)

			if _, ok := errors.AsType[*validation.Error](err); !ok {
				t.Errorf("err = %v, want a validation error", err)
			}
		})
	}
}

func equal(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}

	return *a == *b
}

func deref(value *int) any {
	if value == nil {
		return nil
	}

	return *value
}
