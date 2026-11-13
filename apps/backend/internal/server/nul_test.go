package server

import "testing"

func TestHasNUL(t *testing.T) {
	cases := []struct {
		name  string
		value any
		want  bool
	}{
		{"plain text", "fantasy", false},
		{"text with NUL", "fant\x00asy", true},
		{"NUL in a list", []any{"epic", "\x00"}, true},
		{"NUL in a nested input", map[string]any{"where": map[string]any{"nameIn": []any{"a\x00"}}}, true},
		{"NUL in a key", map[string]any{"a\x00": 1}, true},
		{"numbers and booleans", map[string]any{"first": 5, "flag": true}, false},
		{"nothing", nil, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := hasNUL(c.value)

			if got != c.want {
				t.Errorf("hasNUL = %v, want %v", got, c.want)
			}
		})
	}
}
