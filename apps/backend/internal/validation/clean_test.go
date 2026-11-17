package validation_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

func TestSingleLine(t *testing.T) {
	cases := []struct {
		name string
		text string
		want string
	}{
		{"plain", "Slice of life", "Slice of life"},
		{"the ends are trimmed", "  epic \t", "epic"},
		{
			"runs of white space become one space",
			"slice \t of\n\n life",
			"slice of life",
		},
		{
			"a no-break space is a space",
			"slice\u00a0of\u00a0life",
			"slice of life",
		},
		{
			"NUL and other control characters go",
			"ep\x00ic\x07\x1b[0m",
			"epic[0m",
		},
		{"a zero-width space is not a letter", "\u200bepic\ufeff", "epic"},
		{
			"a zero-width space between words is a space",
			"slice\u200bof",
			"slice of",
		},
		{"invalid UTF-8 goes", "ep\xffic", "epic"},
		{"only white space is empty", " \u200b\t\x00 ", ""},
		{"letters of other scripts stay", "  物語  の 世界 ", "物語 の 世界"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := validation.SingleLine(c.text)

			if result != c.want {
				t.Errorf("SingleLine(%q) = %q, want %q", c.text, result, c.want)
			}
		})
	}
}

func TestText(t *testing.T) {
	cases := []struct {
		name string
		text string
		want string
	}{
		{
			"line breaks and tabs stay",
			"# Title\n\n\tIndented\nText.",
			"# Title\n\n\tIndented\nText.",
		},
		{"CRLF and CR become LF", "a\r\nb\rc", "a\nb\nc"},
		{"the ends are trimmed", "\n\n  Text.  \n", "Text."},
		{
			"trailing spaces inside stay for markdown line breaks",
			"a  \nb",
			"a  \nb",
		},
		{"NUL and other control characters go", "Te\x00xt\x07", "Text"},
		{"invisible spaces go", "Te\u200bxt\ufeff", "Text"},
		{"invalid UTF-8 goes", "Te\xffxt", "Text"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := validation.Text(c.text)

			if result != c.want {
				t.Errorf("Text(%q) = %q, want %q", c.text, result, c.want)
			}
		})
	}
}
