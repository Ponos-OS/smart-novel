package writer_test

import (
	"slices"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entwriter "github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

func TestListFilterShowsPendingRequestsUnlessAStatusIsNamed(t *testing.T) {
	approved := entwriter.StatusAPPROVED
	cases := []struct {
		name  string
		where *ent.WriterWhereInput
		named bool
	}{
		{"no filter", nil, false},
		{"a filter without a status", &ent.WriterWhereInput{}, false},
		{"a status", &ent.WriterWhereInput{Status: &approved}, true},
		{"a status to avoid", &ent.WriterWhereInput{StatusNEQ: &approved}, true},
		{"a list of statuses", &ent.WriterWhereInput{StatusIn: []entwriter.Status{approved}}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := writer.ListFilter(c.where, nil)

			if _, err := result.P(); err != nil {
				t.Fatalf("ent cannot build the filter: %v", err)
			}

			pending := slices.ContainsFunc(result.And, func(w *ent.WriterWhereInput) bool {
				return w.Status != nil && *w.Status == entwriter.StatusPENDING
			})
			if pending == c.named {
				t.Errorf("filter = %+v, want pending added = %v", result, !c.named)
			}
		})
	}
}

func TestListFilterSearchesThePenNameAndIgnoresBlank(t *testing.T) {
	text, blank := "mina", "  "

	searched := writer.ListFilter(nil, &text)
	ignored := writer.ListFilter(nil, &blank)

	for _, filter := range []*ent.WriterWhereInput{searched, ignored} {
		if _, err := filter.P(); err != nil {
			t.Fatalf("ent cannot build the filter: %v", err)
		}
	}
	found := slices.ContainsFunc(searched.And, func(w *ent.WriterWhereInput) bool {
		return w.PenNameContainsFold != nil && *w.PenNameContainsFold == "mina"
	})
	skipped := slices.ContainsFunc(ignored.And, func(w *ent.WriterWhereInput) bool { return w.PenNameContainsFold != nil })
	if !found || skipped {
		t.Errorf("searched = %+v, ignored = %+v", searched, ignored)
	}
}
