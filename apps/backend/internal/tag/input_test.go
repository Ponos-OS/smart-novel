package tag_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
)

func TestUpdateRequireChange(t *testing.T) {
	name := "epic"
	description := "Heroes and long journeys."
	cases := []struct {
		name    string
		update  tag.Update
		invalid bool
	}{
		{"a name", tag.Update{Name: &name}, false},
		{"a description", tag.Update{Description: &description}, false},
		{"both", tag.Update{Name: &name, Description: &description}, false},
		{"nothing", tag.Update{}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.update.RequireChange()

			var bad *apperr.Error
			if c.invalid && (!errors.As(err, &bad) || bad.Code() != shared.BadRequest) {
				t.Errorf("err = %v, want a bad request", err)
			}
			if !c.invalid && err != nil {
				t.Errorf("err = %v, want nil", err)
			}
		})
	}
}
