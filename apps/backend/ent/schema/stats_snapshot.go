package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// StatsSnapshot holds the exact counts taken on one UTC day, read by the growth charts. The first run of a day wins.
type StatsSnapshot struct {
	ent.Schema
}

func (StatsSnapshot) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}}
}

func (StatsSnapshot) Fields() []ent.Field {
	return []ent.Field{
		field.Time("day").
			SchemaType(map[string]string{dialect.Postgres: "date"}).
			Immutable().
			Annotations(entgql.OrderField("DAY")),
		field.Int("novel_count"),
		field.Int("chapter_count"),
		field.Time("created_at").
			SchemaType(timestamptz).
			Default(time.Now).
			Immutable().
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")),
	}
}

func (StatsSnapshot) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("day").
			Unique().
			StorageKey("UQ_stats_snapshots_day"),
	}
}

func (StatsSnapshot) Annotations() []schema.Annotation {
	return []schema.Annotation{entgql.RelayConnection()}
}
