package platformterms_test

import (
	"strings"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
)

func TestCurrentReadsTheTermsThatShipWithTheBuild(t *testing.T) {
	terms, err := platformterms.Current()

	if err != nil || terms.Version < 1 ||
		!strings.HasPrefix(terms.Markdown, "# Platform License") {
		t.Errorf("terms = %+v, err = %v", terms, err)
	}
}

func TestParse(t *testing.T) {
	cases := []struct {
		name    string
		text    string
		version int
		invalid bool
	}{
		{
			"a version and a text",
			"---\nversion: 3\n---\n\n# Terms\n\nText.\n",
			3,
			false,
		},
		{
			"windows line endings",
			"---\r\nversion: 2\r\n---\r\n# Terms\r\n",
			2,
			false,
		},
		{"no frontmatter", "# Terms\n", 0, true},
		{
			"frontmatter that is never closed",
			"---\nversion: 1\n# Terms\n",
			0,
			true,
		},
		{"no version", "---\ntitle: Terms\n---\n# Terms\n", 0, true},
		{"version zero", "---\nversion: 0\n---\n# Terms\n", 0, true},
		{
			"version that is not a number",
			"---\nversion: first\n---\n# Terms\n",
			0,
			true,
		},
		{"no text", "---\nversion: 1\n---\n\n", 0, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			terms, err := platformterms.Parse(c.text)

			if (err != nil) != c.invalid || terms.Version != c.version {
				t.Errorf("terms = %+v, err = %v", terms, err)
			}
		})
	}
}

func TestParseTrimsTheText(t *testing.T) {
	terms, err := platformterms.Parse("---\nversion: 1\n---\n\n\n# Terms\n\n")

	if err != nil || terms.Markdown != "# Terms" {
		t.Errorf("markdown = %q, err = %v", terms.Markdown, err)
	}
}
