package novel

import (
	"fmt"
	"testing"

	"github.com/google/uuid"
)

func TestIsCoverKeyOf(t *testing.T) {
	novelID := uuid.MustParse("93fec4bf-2f66-4e4a-9572-7aa4871f1458")
	otherNovelID := uuid.MustParse("1d1a4f0e-3c5b-4c53-a4a6-0f5a4d2e9a10")
	upload := "0b6f9f0c-3a41-4b75-9f0e-5d1f6a7c2e11"
	cases := map[string]struct {
		key  string
		want bool
	}{
		"a png of this novel":          {fmt.Sprintf("covers/%s/%s.png", novelID, upload), true},
		"a jpg of this novel":          {fmt.Sprintf("covers/%s/%s.jpg", novelID, upload), true},
		"a webp of this novel":         {fmt.Sprintf("covers/%s/%s.webp", novelID, upload), true},
		"a key of another novel":       {fmt.Sprintf("covers/%s/%s.png", otherNovelID, upload), false},
		"an extension that is not one": {fmt.Sprintf("covers/%s/%s.gif", novelID, upload), false},
		"no extension":                 {fmt.Sprintf("covers/%s/%s", novelID, upload), false},
		"a name that is not a uuid":    {fmt.Sprintf("covers/%s/cover.png", novelID), false},
		"a uuid without hyphens":       {fmt.Sprintf("covers/%s/0b6f9f0c3a414b759f0e5d1f6a7c2e11.png", novelID), false},
		"a path below the novel":       {fmt.Sprintf("covers/%s/x/%s.png", novelID, upload), false},
		"another prefix":               {fmt.Sprintf("narrations/%s/%s.png", novelID, upload), false},
	}
	for name, test := range cases {
		t.Run(name, func(t *testing.T) {
			result := isCoverKeyOf(novelID, test.key)

			if result != test.want {
				t.Errorf("isCoverKeyOf(%q) = %v, want %v", test.key, result, test.want)
			}
		})
	}
}
