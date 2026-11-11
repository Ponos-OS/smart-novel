package schema

import (
	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Novel struct {
	ent.Schema
}

func (Novel) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}, timestamps{}}
}

func (Novel) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("writer_id", uuid.UUID{}),
		field.UUID("license_id", uuid.UUID{}),
		field.String("name").
			Annotations(entgql.OrderField("NAME")),
		field.Text("description"),
		field.Enum("state").
			Values("ONGOING", "FINISHED").
			Default("ONGOING").
			Annotations(entgql.Type("NovelState")),
		field.String("cover_url").
			Optional().
			Nillable(),
		field.Time("first_chapter_created_at").
			SchemaType(timestamptz).
			Optional().
			Nillable().
			Comment("The created_at of the earliest chapter, kept by the chapter service.").
			Annotations(entgql.OrderField("FIRST_CHAPTER_CREATED_AT")),
	}
}

func (Novel) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("writer", Writer.Type).
			Ref("novels").
			Field("writer_id").
			Unique().
			Required(),
		edge.From("license", License.Type).
			Ref("novels").
			Field("license_id").
			Unique().
			Required(),
		edge.To("chapters", Chapter.Type).
			Annotations(entsql.OnDelete(entsql.Cascade), entgql.RelayConnection()),
		edge.To("tags", Tag.Type).
			Through("novel_tags", NovelTag.Type),
		edge.To("chapter_user_states", ChapterUserState.Type).
			Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Novel) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("writer_id").
			StorageKey("IDX_novels_writer"),
		index.Fields("license_id").
			StorageKey("IDX_novels_license"),
		index.Fields("first_chapter_created_at", "id").
			StorageKey("IDX_novels_first_chapter_created_at"),
	}
}

func (Novel) Annotations() []schema.Annotation {
	return []schema.Annotation{entgql.RelayConnection()}
}
