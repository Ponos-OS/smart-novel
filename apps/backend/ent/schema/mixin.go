package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
	"github.com/google/uuid"
)

// timestamptz makes the PostgreSQL type explicit; it is also ent's default for time fields.
func timestamptz() map[string]string {
	return map[string]string{dialect.Postgres: "timestamptz"}
}

// uuidID is the primary key every entity with a surrogate key shares.
type uuidID struct{ mixin.Schema }

func (uuidID) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New).Immutable(),
	}
}

// timestamps keeps created_at and updated_at; updated_at moves on every update. An entity opts in with Mixin(), and the fields stay out of the GraphQL API unless it says inAPI.
type timestamps struct {
	mixin.Schema
	inAPI bool
}

func (t timestamps) Fields() []ent.Field {
	return []ent.Field{
		field.Time("created_at").
			SchemaType(timestamptz()).
			Default(time.Now).
			Immutable().
			Annotations(t.annotations("CREATED_AT")...),
		field.Time("updated_at").
			SchemaType(timestamptz()).
			Default(time.Now).
			UpdateDefault(time.Now).
			Annotations(t.annotations("UPDATED_AT")...),
	}
}

func (t timestamps) annotations(orderField string) []schema.Annotation {
	annotations := []schema.Annotation{entsql.DefaultExpr("CURRENT_TIMESTAMP")}
	if !t.inAPI {
		return append(annotations, entgql.Skip(entgql.SkipAll))
	}

	return append(annotations, entgql.OrderField(orderField))
}
