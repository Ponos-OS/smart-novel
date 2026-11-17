package schema

import "testing"

func TestLicenseLimitsMatchTheAPI(t *testing.T) {
	const path = "../../api/license.graphql"
	cases := []struct {
		input string
		field string
	}{
		{"LicenseInput", "name"},
		{"LicenseInput", "text"},
		{"SaveLicenseDraftInput", "name"},
		{"SaveLicenseDraftInput", "text"},
	}
	for _, c := range cases {
		t.Run(c.input+"."+c.field, func(t *testing.T) {
			api := maxLengthInSDL(t, path, c.input, c.field)

			stored := entMaxLength(t, License{}.Fields(), c.field)

			if api != stored {
				t.Errorf(
					"@maxLength is %d in %s but the ent field allows %d",
					api,
					path,
					stored,
				)
			}
		})
	}
}
