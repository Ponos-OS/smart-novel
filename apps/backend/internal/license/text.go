// Package license holds the rules for the licenses a novel is published under.
package license

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

var trailingSpaces = regexp.MustCompile(`(?m)[ \t]+$`)

// NormalizeText makes two copies of one license text equal: line endings, trailing white space and the ends of the text are the same.
func NormalizeText(text string) string {
	text = strings.NewReplacer("\r\n", "\n", "\r", "\n").Replace(text)

	return strings.TrimSpace(trailingSpaces.ReplaceAllString(text, ""))
}

// TextHash identifies a license text; the same text always has the same hash.
func TextHash(text string) string {
	sum := sha256.Sum256([]byte(NormalizeText(text)))

	return hex.EncodeToString(sum[:])
}
