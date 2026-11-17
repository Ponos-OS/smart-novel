package novel

import (
	"context"
	"slices"

	"entgo.io/contrib/entgql"
	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/predicate"
)

// Paging is the connection arguments of a page; First and Last are already bounded.
type Paging struct {
	First, Last   *int
	After, Before *entgql.Cursor[uuid.UUID]
}

// PageByFirstChapter pages novels by the date of their first chapter, with the novels that have no chapter last in either direction.
// ent's own cursors cannot do it: a cursor on a NULL date falls back to the ID alone and the page loses its place at the border.
// base already carries every filter; TotalCount is counted only when wanted.
func PageByFirstChapter(
	ctx context.Context,
	base *ent.NovelQuery,
	direction entgql.OrderDirection,
	paging Paging,
	withTotal bool,
) (*ent.NovelConnection, error) {
	backward := paging.Last != nil && paging.First == nil
	size := pageSize(paging, backward)
	query := base.Clone().Where(cursorConditions(paging, direction)...)
	// Backward pages read the rows in the opposite order, from the end, then turn them around.
	query = query.Order(orderTerms(direction, backward)...).Limit(size + 1)
	rows, err := query.All(ctx)
	if err != nil {
		return nil, err
	}
	more := len(rows) > size
	if more {
		rows = rows[:size]
	}
	if backward {
		slices.Reverse(rows)
	}

	connection := &ent.NovelConnection{Edges: make([]*ent.NovelEdge, len(rows))}
	for index, row := range rows {
		connection.Edges[index] = &ent.NovelEdge{
			Node:   row,
			Cursor: firstChapterCursor(row),
		}
	}
	connection.PageInfo = pageInfo(connection.Edges, paging, backward, more)
	if withTotal {
		if connection.TotalCount, err = base.Clone().Count(ctx); err != nil {
			return nil, err
		}
	}

	return connection, nil
}

func pageSize(paging Paging, backward bool) int {
	if backward {
		return *paging.Last
	}

	return *paging.First
}

func pageInfo(
	edges []*ent.NovelEdge,
	paging Paging,
	backward, more bool,
) ent.PageInfo {
	info := ent.PageInfo{}
	if backward {
		info.HasPreviousPage = more
		info.HasNextPage = paging.Before != nil
	} else {
		info.HasNextPage = more
		info.HasPreviousPage = paging.After != nil
	}
	if len(edges) > 0 {
		info.StartCursor = &edges[0].Cursor
		info.EndCursor = &edges[len(edges)-1].Cursor
	}

	return info
}

func firstChapterCursor(row *ent.Novel) entgql.Cursor[uuid.UUID] {
	return entgql.Cursor[uuid.UUID]{
		ID:    row.ID,
		Value: row.FirstChapterCreatedAt,
	}
}

// orderTerms sorts by the date, the novels without one last, then by ID in the same direction. Backward pages flip the direction and put the NULLs first.
func orderTerms(
	direction entgql.OrderDirection,
	backward bool,
) []novel.OrderOption {
	descending := direction == entgql.OrderDirectionDesc
	if backward {
		descending = !descending
	}
	option := sql.OrderAsc()
	if descending {
		option = sql.OrderDesc()
	}
	nulls := sql.OrderNullsLast()
	if backward {
		nulls = sql.OrderNullsFirst()
	}

	return []novel.OrderOption{
		novel.ByFirstChapterCreatedAt(option, nulls),
		novel.ByID(option),
	}
}

func cursorConditions(
	paging Paging,
	direction entgql.OrderDirection,
) []predicate.Novel {
	var conditions []predicate.Novel
	if paging.After != nil {
		conditions = append(conditions, keyset(*paging.After, direction, false))
	}
	if paging.Before != nil {
		conditions = append(conditions, keyset(*paging.Before, direction, true))
	}

	return conditions
}

// keyset keeps the rows that come after the cursor in the page order (the date in the direction, the NULLs last), or before it.
func keyset(
	cursor entgql.Cursor[uuid.UUID],
	direction entgql.OrderDirection,
	before bool,
) predicate.Novel {
	// Whether the rows we want have a larger date and ID than the cursor.
	larger := (direction == entgql.OrderDirectionAsc) != before

	return func(selector *sql.Selector) {
		selector.Where(keysetPredicate(selector, cursor, larger, before))
	}
}

func keysetPredicate(
	selector *sql.Selector,
	cursor entgql.Cursor[uuid.UUID],
	larger, before bool,
) *sql.Predicate {
	date, id := selector.C(
		novel.FieldFirstChapterCreatedAt,
	), selector.C(
		novel.FieldID,
	)
	moreOf := func(column string, value any) *sql.Predicate {
		if larger {
			return sql.GT(column, value)
		}

		return sql.LT(column, value)
	}
	if cursor.Value == nil {
		// The cursor is among the novels without a date, which are last: nothing after it but later IDs; before it, every dated row and the earlier IDs.
		sameGroup := sql.And(
			sql.IsNull(date),
			moreOf(id, cursor.ID),
		) // date IS NULL AND id > 123 so we can paginate through the novels without any chapter

		if before { // Browsing backward.
			return sql.Or(sql.NotNull(date), sameGroup)
		}

		return sameGroup
	}

	beyond := sql.Or(
		moreOf(date, cursor.Value),
		sql.And(sql.EQ(date, cursor.Value), moreOf(id, cursor.ID)),
	)
	if before {
		return beyond
	}

	return sql.Or(beyond, sql.IsNull(date))
}
