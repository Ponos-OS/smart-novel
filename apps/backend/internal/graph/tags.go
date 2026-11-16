package graph

import (
	"errors"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	enttag "github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/pagination"
)

// tagVisibility keeps pending tags to the admins. Everybody else gets only the approved ones; an admin gets them too unless the filter names a status.
func tagVisibility(where *ent.TagWhereInput, admin bool) *ent.TagWhereInput {
	approved := enttag.StatusAPPROVED
	approvedOnly := &ent.TagWhereInput{Status: &approved}
	// An empty filter (where: {}) is no filter; ent refuses it inside an and.
	if where == nil || isEmpty(where) {
		return approvedOnly
	}
	if admin && namesStatus(where) {
		return where
	}

	return &ent.TagWhereInput{And: []*ent.TagWhereInput{where, approvedOnly}}
}

func isEmpty(where *ent.TagWhereInput) bool {
	_, err := where.P()

	return errors.Is(err, ent.ErrEmptyTagWhereInput)
}

func namesStatus(where *ent.TagWhereInput) bool {
	return where.Status != nil || where.StatusNEQ != nil || len(where.StatusIn) > 0 || len(where.StatusNotIn) > 0
}

const (
	defaultPage  = 20
	maxPage      = 100
	nodesSize    = 100
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
	writersPage  = pagination.Size{Default: defaultPage, Max: maxPage}
	licensesPage = pagination.Size{Default: defaultPage, Max: maxPage}
)
