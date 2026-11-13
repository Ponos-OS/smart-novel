package devdata_test

import (
	"strings"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
)

func TestParseWriters(t *testing.T) {
	raw := `[{"userId":"316784561234","name":"Writer User","email":"writer@smart-novel.localhost","penName":"The-Writer"}]`

	writers, err := devdata.ParseWriters(raw)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(writers) != 1 || writers[0].PenName != "The-Writer" {
		t.Errorf("writers = %+v", writers)
	}
}

func TestParseWritersRefuses(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{"unset", "  ", "is not set"},
		{"not JSON", "writer", "not a valid JSON array"},
		{"empty", "[]", "non-empty JSON array"},
		{"a missing field", `[{"userId":"1","name":"A","email":"a@x.io"}]`, "SEEDED_WRITERS[0].penName"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := devdata.ParseWriters(c.raw)

			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Errorf("err = %v, want it to contain %q", err, c.want)
			}
		})
	}
}
