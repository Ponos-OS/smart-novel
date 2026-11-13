package license_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
)

func TestNormalizeText(t *testing.T) {
	text := "\r\n  Attribution 4.0 International  \r\nCreative Commons\t\r\n\r\n"

	result := license.NormalizeText(text)

	if want := "Attribution 4.0 International\nCreative Commons"; result != want {
		t.Errorf("NormalizeText = %q, want %q", result, want)
	}
}

func TestTextHashIgnoresWhatNormalizingRemoves(t *testing.T) {
	windows := "Attribution 4.0 International  \r\nCreative Commons  \r\n"
	unix := "Attribution 4.0 International\nCreative Commons"

	if license.TextHash(windows) != license.TextHash(unix) {
		t.Error("the hash of the same text differs by line endings or trailing spaces")
	}
	if license.TextHash(unix) == license.TextHash(unix+" more") {
		t.Error("different texts share a hash")
	}
}
