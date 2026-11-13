package graph

import (
	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	enttag "github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/pagination"
)

// tagVisibility keeps pending tags to the admins. Everybody else gets only the approved ones; an admin gets them too unless the filter names a status.
func tagVisibility(where *ent.TagWhereInput, admin bool) *ent.TagWhereInput {
	approved := enttag.StatusAPPROVED
	approvedOnly := &ent.TagWhereInput{Status: &approved}
	if where == nil {
		return approvedOnly
	}
	if admin && namesStatus(where) {
		return where
	}

	return &ent.TagWhereInput{And: []*ent.TagWhereInput{where, approvedOnly}}
}

func namesStatus(where *ent.TagWhereInput) bool {
	return where.Status != nil || where.StatusNEQ != nil || len(where.StatusIn) > 0 || len(where.StatusNotIn) > 0
}

const (
	defaultPage  = 20
	maxPage      = 100
	chaptersPage = 100
	statsDefault = 30
	logKeyTag    = "tag"
	logKeyNovel  = "novel"
	logKeyError  = "error"
)

var (
	tagsPage     = pagination.Size{Default: defaultPage, Max: maxPage}
	novelsPage   = pagination.Size{Default: defaultPage, Max: maxPage}
	chaptersSize = pagination.Size{Default: chaptersPage, Max: maxPage}
	statsSize    = pagination.Size{Default: statsDefault, Max: maxPage}
)
