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

// ChapterUserState records that a user read a chapter. The viewer sees it as Chapter.isRead, never as an entity.
type ChapterUserState struct {
	ent.Schema
}

func (ChapterUserState) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}}
}

func (ChapterUserState) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id"),
		field.UUID("novel_id", uuid.UUID{}),
		field.UUID("chapter_id", uuid.UUID{}),
		field.Time("first_read_at").
			SchemaType(timestamptz).
			Default(time.Now).
			Immutable().
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")),
	}
}

func (ChapterUserState) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("novel", Novel.Type).
			Ref("chapter_user_states").
			Field("novel_id").
			Unique().
			Required(),
		edge.From("chapter", Chapter.Type).
			Ref("user_states").
			Field("chapter_id").
			Unique().
			Required(),
	}
}

func (ChapterUserState) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "chapter_id").
			Unique().
			StorageKey("UQ_chapter_user_states_user_chapter"),
		index.Fields("novel_id").
			StorageKey("IDX_chapter_user_states_novel"),
		index.Fields("user_id", "novel_id").
			StorageKey("IDX_chapter_user_states_user_novel"),
		index.Fields("novel_id", "chapter_id").
			StorageKey("IDX_chapter_user_states_novel_chapter"),
	}
}

func (ChapterUserState) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.Skip(
			entgql.SkipAll,
		), // Instead of exposing this I Have ChapterViewerState in mt GraphQL API
	}
}
