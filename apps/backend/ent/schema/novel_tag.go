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

// NovelTag is the join table of novels and tags.
type NovelTag struct {
	ent.Schema
}

func (NovelTag) Annotations() []schema.Annotation {
	return []schema.Annotation{
		field.ID("novel_id", "tag_id"),
		entgql.Skip(entgql.SkipAll),
	}
}

func (NovelTag) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("novel_id", uuid.UUID{}),
		field.UUID("tag_id", uuid.UUID{}),
		field.Time("created_at").
			SchemaType(timestamptz).
			Default(time.Now).
			Immutable().
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")).
			Comment("When the tag was put on the novel."),
	}
}

func (NovelTag) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("novel", Novel.Type).
			Unique().
			Required().
			Field("novel_id").
			Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("tag", Tag.Type).
			Unique().
			Required().
			Field("tag_id").
			Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (NovelTag) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("novel_id").StorageKey("IDX_novel_tags_novel"),
		index.Fields("tag_id").StorageKey("IDX_novel_tags_tag"),
	}
}
