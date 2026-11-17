package license

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
)

func TestEditionAfter(t *testing.T) {
	version := func(value string) *string { return &value }
	cases := map[string]struct {
		base *ent.License
		want string
	}{
		"a canonical license begins its own line": {
			&ent.License{
				SourceType: entlicense.SourceTypeCANONICAL,
				Version:    version("4.0"),
			},
			"1",
		},
		"the first edition of a custom license": {
			&ent.License{
				SourceType: entlicense.SourceTypeCUSTOM,
				Version:    version("1"),
			},
			"2",
		},
		"the fourth edition of a fork": {
			&ent.License{
				SourceType: entlicense.SourceTypeFORKED,
				Version:    version("3"),
			},
			"4",
		},
		"a license stored before versions existed": {
			&ent.License{SourceType: entlicense.SourceTypeCUSTOM},
			"2",
		},
		"a version that is not a number is the first": {
			&ent.License{
				SourceType: entlicense.SourceTypeFORKED,
				Version:    version("4.0"),
			},
			"2",
		},
	}
	for name, test := range cases {
		t.Run(name, func(t *testing.T) {
			result := editionAfter(test.base)

			if result != test.want {
				t.Errorf("got %s, want %s", result, test.want)
			}
		})
	}
}
