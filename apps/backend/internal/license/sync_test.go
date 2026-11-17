package license

import (
	"testing"

	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
)

func detail() *fithara.LicenseDetail {
	return &fithara.LicenseDetail{
		Id:          "CC-BY-NC-4.0",
		ShortName:   "CC BY-NC 4.0",
		Version:     "4.0",
		OfficialUrl: "https://creativecommons.org/licenses/by-nc/4.0/legalcode",
		Body:        "# Creative Commons\r\n\r\nText  \r\n",
	}
}

func TestStoredCanonicalIsASharedCanonicalLicenseNamedAfterTheShortName(
	t *testing.T,
) {
	result := storedCanonical(detail())

	if result.Name != "CC BY-NC 4.0" || result.OwnerID != SystemOwner ||
		result.SourceType != entlicense.SourceTypeCANONICAL ||
		*result.CanonicalID != "CC-BY-NC-4.0" {
		t.Errorf("got %+v", result)
	}
	if result.Text != "# Creative Commons\n\nText" ||
		result.TextHash != TextHash(detail().Body) {
		t.Errorf("text = %q, hash = %s", result.Text, result.TextHash)
	}
	if result.Metadata.OfficialURL != detail().OfficialUrl ||
		result.Metadata.Version != "4.0" {
		t.Errorf("metadata = %+v", result.Metadata)
	}
}
