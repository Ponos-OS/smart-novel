package node

import (
	"context"
	"fmt"
	"maps"
	"strings"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/statssnapshot"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
)

// repository is the only place of this package that builds ent queries or SQL. It decides nothing and returns the database's own errors.
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

// tablesOf says which table each of the IDs is in; an ID that is in none is left out. Raw SQL, because an ID carries no type and ent cannot query several tables at once: this is one statement instead of one query per table and ID.
func (r *repository) tablesOf(
	ctx context.Context,
	ids []uuid.UUID,
) (map[uuid.UUID]string, error) {
	texts := make([]string, len(ids))
	for index, id := range ids {
		texts[index] = id.String()
	}
	selects := make([]string, 0, len(nodeTables()))
	for _, table := range nodeTables() {
		selects = append(
			selects,
			fmt.Sprintf(
				"SELECT id, '%s' AS found_in FROM %s WHERE id = ANY($1::uuid[])",
				table,
				table,
			),
		)
	}
	rows, err := r.client.QueryContext(
		ctx,
		strings.Join(selects, " UNION ALL "),
		texts,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck // a failed close of rows already read is nothing to act on

	tables := make(map[uuid.UUID]string, len(ids))
	for rows.Next() {
		var id uuid.UUID
		var table string
		if err = rows.Scan(&id, &table); err != nil {
			return nil, err
		}
		tables[id] = table
	}

	return tables, rows.Err()
}

// nodeTables are the tables of the entities that implement Node.
func nodeTables() []string {
	return []string{
		chapter.Table,
		license.Table,
		novel.Table,
		statssnapshot.Table,
		tag.Table,
		writer.Table,
	}
}

// load returns the entities of the IDs, by ID, with every column. The ent loader of nodes selects only the columns the GraphQL query names, and
// the service decides who may see an entity from columns the query may not name (the owner of a license, the user of a writer).
func (r *repository) load(
	ctx context.Context,
	tables map[uuid.UUID]string,
) (map[uuid.UUID]ent.Noder, error) {
	byTable := make(map[string][]uuid.UUID)
	for id, table := range tables {
		byTable[table] = append(byTable[table], id)
	}
	nodes := make(map[uuid.UUID]ent.Noder, len(tables))
	for table, ids := range byTable {
		found, err := r.loadTable(ctx, table, ids)
		if err != nil {
			return nil, err
		}
		maps.Copy(nodes, found)
	}

	return nodes, nil
}

func (r *repository) loadTable(
	ctx context.Context,
	table string,
	ids []uuid.UUID,
) (map[uuid.UUID]ent.Noder, error) {
	switch table {
	case chapter.Table:
		rows, err := r.client.Chapter.Query().
			Where(chapter.IDIn(ids...)).
			All(ctx)

		return byID(
			rows,
			func(row *ent.Chapter) uuid.UUID { return row.ID },
		), err
	case license.Table:
		rows, err := r.client.License.Query().
			Where(license.IDIn(ids...)).
			All(ctx)

		return byID(
			rows,
			func(row *ent.License) uuid.UUID { return row.ID },
		), err
	case novel.Table:
		rows, err := r.client.Novel.Query().Where(novel.IDIn(ids...)).All(ctx)

		return byID(rows, func(row *ent.Novel) uuid.UUID { return row.ID }), err
	case statssnapshot.Table:
		rows, err := r.client.StatsSnapshot.Query().
			Where(statssnapshot.IDIn(ids...)).
			All(ctx)

		return byID(
			rows,
			func(row *ent.StatsSnapshot) uuid.UUID { return row.ID },
		), err
	case tag.Table:
		rows, err := r.client.Tag.Query().Where(tag.IDIn(ids...)).All(ctx)

		return byID(rows, func(row *ent.Tag) uuid.UUID { return row.ID }), err
	case writer.Table:
		rows, err := r.client.Writer.Query().Where(writer.IDIn(ids...)).All(ctx)

		return byID(
			rows,
			func(row *ent.Writer) uuid.UUID { return row.ID },
		), err
	}

	return nil, nil
}

func byID[T ent.Noder](rows []T, id func(T) uuid.UUID) map[uuid.UUID]ent.Noder {
	found := make(map[uuid.UUID]ent.Noder, len(rows))
	for _, row := range rows {
		found[id(row)] = row
	}

	return found
}
