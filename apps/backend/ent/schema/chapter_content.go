package schema

import (
	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ChapterContent is the text of a chapter, kept apart so listing chapters never loads it and when editing the chapter's metadata our database performance is better ompare to having a text field for each row.
type ChapterContent struct {
	ent.Schema
}

func (ChapterContent) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}, timestamps{}}
}

func (ChapterContent) Fields() []ent.Field {
	return []ent.Field{
		field.Text("content"),
		field.String("content_tsv").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "tsvector"}).
			Comment("Full-text search vector."),
		field.String("content_hash").
			Comment("Change detection for narration regeneration; distinct from updated_at so a save that changes nothing does not trigger text to speech again."),
	}
}

func (ChapterContent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("chapter", Chapter.Type).
			Unique().
			Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (ChapterContent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("content_tsv").
			Annotations(entsql.IndexType("GIN")).
			StorageKey("chapter_contents_content_tsv_idx"),
		index.Fields("content_hash").
			StorageKey("chapter_contents_content_hash_idx"),
	}
}

func (ChapterContent) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.Skip(
			entgql.SkipAll,
		), // No separate ChapterContent type so our Chapter.content and Chapter.contentUpdatedAt can have their custom field resolver
	}
}
