package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Chapter struct {
	ent.Schema // Recognizes Chapter as a schema. Provides the internal methods ent uses during code generation (e.g. Fields(), Edges(), Config()).
}

// Mixin is a method without a receiver name.
// When code generation runs (go generate ./...), ent calls Mixin() on Chapter and applies the returned mixins to the generated code.
func (Chapter) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}}
}

func (Chapter) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("novel_id", uuid.UUID{}),
		field.UUID("content_id", uuid.UUID{}).
			Unique(),
		field.String("title"),
		field.Enum("narration_status").
			Values("PROCESSING", "READY", "FAILED").
			Optional().
			Nillable().
			Annotations(entgql.Type("NarrationStatus")),
		field.String("narration_url").
			Optional().
			Nillable(),
		field.Int("chapter_number").
			Annotations(entgql.OrderField("CHAPTER_NUMBER")),
		field.Time("created_at").
			SchemaType(timestamptz).
			Default(time.Now).
			Immutable().
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP"), entgql.OrderField("CREATED_AT")),
		field.Time("updated_at").
			SchemaType(timestamptz).
			Default(time.Now).
			UpdateDefault(time.Now).
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP"), entgql.OrderField("UPDATED_AT")),
	}
}

// Edges represent the relationships between entities, modeled as a graph of nodes and edges.
func (Chapter) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("novel", Novel.Type).
			Ref("chapters").Field("novel_id").
			Unique().
			Required().
			Annotations(entgql.Skip(entgql.SkipAll)),
		edge.From("content", ChapterContent.Type).
			Ref("chapter").
			Field("content_id").
			Unique().
			Required(),
		edge.To("user_states", ChapterUserState.Type).
			Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Chapter) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("novel_id").StorageKey("IDX_chapters_novel"),
	}
}

// Annotations are used to attach arbitrary metadata to schema objects (fields, edges, or the entire schema) to configure code generation or external integrations.
func (Chapter) Annotations() []schema.Annotation {
	return []schema.Annotation{entgql.RelayConnection()}
}
