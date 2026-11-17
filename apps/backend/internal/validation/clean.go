package validation

import (
	"strings"
	"unicode"
)

// invisibleSpaces are the characters that take room like a space but show nothing, so two names that look the same would differ.
func invisibleSpace(r rune) bool {
	switch r {
	case '\u200b', '\ufeff', '\u2060':
		return true
	}

	return false
}

// SingleLine cleans a name or a title: invalid UTF-8 and control characters (NUL included) go, every kind of white space becomes one space,
// runs of them become one, and the ends are trimmed. Run it before checking the value, so a blank one is seen as blank.
func SingleLine(text string) string {
	var cleaned strings.Builder
	pendingSpace := false
	for _, r := range strings.ToValidUTF8(text, "") {
		switch {
		case unicode.IsSpace(r) || invisibleSpace(r):
			pendingSpace = cleaned.Len() > 0
		case unicode.IsControl(r):
		default:
			if pendingSpace {
				cleaned.WriteByte(' ')
				pendingSpace = false
			}
			cleaned.WriteRune(r)
		}
	}

	return cleaned.String()
}

// Text cleans a description or a chapter: invalid UTF-8, control characters other than line breaks and tabs, and the invisible spaces go,
// line breaks are \n, and the ends are trimmed. The line breaks and the spaces inside stay, since markdown uses them.
func Text(text string) string {
	text = strings.ToValidUTF8(text, "")
	text = strings.NewReplacer("\r\n", "\n", "\r", "\n").Replace(text)
	text = strings.Map(func(r rune) rune {
		if invisibleSpace(r) ||
			(unicode.IsControl(r) && r != '\n' && r != '\t') {
			return -1
		}

		return r
	}, text)

	return strings.TrimSpace(text)
}
