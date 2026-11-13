package graph

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	enttag "github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
)

func TestTagVisibility(t *testing.T) {
	pending := enttag.StatusPENDING
	name := "epic"
	cases := []struct {
		name  string
		where *ent.TagWhereInput
		admin bool
		want  func(*ent.TagWhereInput) bool
		desc  string
	}{
		{"no filter, reader", nil, false, onlyApproved, "only approved"},
		{"pending asked by a reader", &ent.TagWhereInput{Status: &pending}, false, approvedAlongside, "approved AND the filter"},
		{"no filter, admin", nil, true, onlyApproved, "only approved"},
		{"admin asks for pending", &ent.TagWhereInput{Status: &pending}, true, func(w *ent.TagWhereInput) bool { return w.Status != nil && *w.Status == pending }, "the filter unchanged"},
		{"admin searches by name", &ent.TagWhereInput{NameContainsFold: &name}, true, approvedAlongside, "approved AND the filter"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := tagVisibility(c.where, c.admin)

			if !c.want(got) {
				t.Errorf("tagVisibility = %+v, want %s", got, c.desc)
			}
		})
	}
}

func onlyApproved(where *ent.TagWhereInput) bool {
	return where.Status != nil && *where.Status == enttag.StatusAPPROVED && len(where.And) == 0
}

func approvedAlongside(where *ent.TagWhereInput) bool {
	return len(where.And) == 2 && onlyApproved(where.And[1])
}
