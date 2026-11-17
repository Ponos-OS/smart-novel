package model_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

func TestUpdateRequireChange(t *testing.T) {
	name := "epic"
	description := "Heroes and long journeys."
	cases := []struct {
		name    string
		update  model.UpdateTagInput
		invalid bool
	}{
		{"a name", model.UpdateTagInput{Name: &name}, false},
		{
			"a description",
			model.UpdateTagInput{Description: &description},
			false,
		},
		{
			"both",
			model.UpdateTagInput{Name: &name, Description: &description},
			false,
		},
		{"nothing", model.UpdateTagInput{}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.update.RequireChange()

			var bad *apperr.Error
			if c.invalid &&
				(!errors.As(err, &bad) || bad.Code() != apperr.CodeBadRequest) {
				t.Errorf("err = %v, want a bad request", err)
			}
			if !c.invalid && err != nil {
				t.Errorf("err = %v, want nil", err)
			}
		})
	}
}
