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
var timestamptz = map[string]string{dialect.Postgres: "timestamptz"}

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
			SchemaType(timestamptz).
			Default(time.Now).
			Immutable().
			Annotations(append(t.annotations(), entsql.DefaultExpr("CURRENT_TIMESTAMP"))...),
		field.Time("updated_at").
			SchemaType(timestamptz).
			Default(time.Now).
			UpdateDefault(time.Now).
			Annotations(append(t.annotations(), entsql.DefaultExpr("CURRENT_TIMESTAMP"))...),
	}
}

func (t timestamps) annotations() []schema.Annotation {
	if t.inAPI {
		return nil
	}

	return []schema.Annotation{entgql.Skip(entgql.SkipAll)}
}
