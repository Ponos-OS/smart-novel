package novel

import (
	"testing"
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
)

func TestKeysetConditions(t *testing.T) {
	id := uuid.MustParse("bb563ad5-1ac4-46c2-a25f-6f62d245f44c")
	date := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	dated := entgql.Cursor[uuid.UUID]{ID: id, Value: date}
	undated := entgql.Cursor[uuid.UUID]{ID: id}
	cases := []struct {
		name      string
		cursor    entgql.Cursor[uuid.UUID]
		direction entgql.OrderDirection
		before    bool
		want      string
	}{
		{
			"after a dated row, oldest first: later dates, the same date with a later ID, and every undated row",
			dated,
			entgql.OrderDirectionAsc,
			false,
			`SELECT * FROM "novels" WHERE ("novels"."first_chapter_created_at" > $1 OR ("novels"."first_chapter_created_at" = $2 AND "novels"."id" > $3)) OR "novels"."first_chapter_created_at" IS NULL`,
		},
		{
			"after a dated row, newest first: earlier dates, the same date with an earlier ID, and every undated row",
			dated,
			entgql.OrderDirectionDesc,
			false,
			`SELECT * FROM "novels" WHERE ("novels"."first_chapter_created_at" < $1 OR ("novels"."first_chapter_created_at" = $2 AND "novels"."id" < $3)) OR "novels"."first_chapter_created_at" IS NULL`,
		},
		{
			"after an undated row: only undated rows with a later ID",
			undated,
			entgql.OrderDirectionAsc,
			false,
			`SELECT * FROM "novels" WHERE "novels"."first_chapter_created_at" IS NULL AND "novels"."id" > $1`,
		},
		{
			"before a dated row, oldest first: earlier dates and the same date with an earlier ID, never undated rows",
			dated,
			entgql.OrderDirectionAsc,
			true,
			`SELECT * FROM "novels" WHERE "novels"."first_chapter_created_at" < $1 OR ("novels"."first_chapter_created_at" = $2 AND "novels"."id" < $3)`,
		},
		{
			"before an undated row, newest first: every dated row and the undated rows with a larger ID",
			undated,
			entgql.OrderDirectionDesc,
			true,
			`SELECT * FROM "novels" WHERE "novels"."first_chapter_created_at" IS NOT NULL OR ("novels"."first_chapter_created_at" IS NULL AND "novels"."id" > $1)`,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			selector := sql.Dialect(dialect.Postgres).
				Select("*").
				From(sql.Table("novels"))

			keyset(c.cursor, c.direction, c.before)(selector)
			got, _ := selector.Query()

			if got != c.want {
				t.Errorf("query = %s\nwant    = %s", got, c.want)
			}
		})
	}
}
