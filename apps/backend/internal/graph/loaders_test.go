package graph

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

type row struct{ id uuid.UUID }

func TestArrangePutsRowsInTheOrderOfTheKeys(t *testing.T) {
	first, second, missing := uuid.New(), uuid.New(), uuid.New()
	rows := []row{{second}, {first}}

	values, errs := arrange([]uuid.UUID{first, missing, second}, rows, nil, func(r row) uuid.UUID { return r.id })

	if values[0].id != first || values[2].id != second {
		t.Errorf("values = %+v, want the rows in the order of the keys", values)
	}
	if errs[0] != nil || errs[2] != nil || errs[1] == nil {
		t.Errorf("errs = %v, want an error only for the missing key", errs)
	}
}

func TestArrangeFailsEveryKeyWhenTheQueryFailed(t *testing.T) {
	failure := errors.New("connection lost")

	_, errs := arrange([]uuid.UUID{uuid.New(), uuid.New()}, nil, failure, func(r row) uuid.UUID { return r.id })

	if !errors.Is(errs[0], failure) || !errors.Is(errs[1], failure) {
		t.Errorf("errs = %v, want the failure for each key", errs)
	}
}
