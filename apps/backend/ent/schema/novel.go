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
	"github.com/vektah/gqlparser/v2/ast"
)

// forceResolver is gqlgen's own `@goField(forceResolver: true)` directive: gqlgen calls a resolver we write (internal/graph) for the field, instead of reading
// the struct field or calling ent's generated method. That is the only place to fill in defaults, sanitize or compute at the boundary for a generated field.
// The argument name is gqlgen's, not ours: it must stay `forceResolver`.
func forceResolver() schema.Annotation {
	return entgql.Directives(
		entgql.NewDirective("goField", &ast.Argument{
			Name:  "forceResolver",
			Value: &ast.Value{Raw: "true", Kind: ast.BooleanValue},
		}),
	)
}

type Novel struct {
	ent.Schema
}

func (Novel) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}, timestamps{}}
}

func (Novel) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("writer_id", uuid.UUID{}).
			Annotations(entgql.Skip(entgql.SkipAll)),
		field.UUID("license_id", uuid.UUID{}).
			Annotations(entgql.Skip(entgql.SkipAll)),
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
			SchemaType(timestamptz()).
			Optional().
			Nillable().
			Comment("The created_at of the earliest chapter, kept by the chapter service.").
			Annotations(entgql.OrderField("FIRST_CHAPTER_CREATED_AT")),
	}
}

func (Novel) Edges() []ent.Edge {
	return []ent.Edge{
		// Hand-written as NovelWriter (api/novel.graphql): the generated Writer would hand out every writer's email.
		edge.From("writer", Writer.Type).
			Ref("novels").
			Field("writer_id").
			Unique().
			Required().
			Annotations(entgql.Skip(entgql.SkipAll)),
		edge.From("license", License.Type).
			Ref("novels").
			Field("license_id").
			Unique().
			Required().
			Annotations(forceResolver()),
		// Resolved by us (graph/ent.resolvers.go) to default the order to the chapter number (ent's is the ID) and to bound the page.
		// The price is that ent's reuse of chapters it preloaded for a list of novels is not used, so a list of novels that each select `chapters` runs one query per novel; calling ent's method from the resolver would not fix it, since ent preloads with the arguments the client sent, before the defaults exist.
		edge.To("chapters", Chapter.Type).
			Annotations(entsql.OnDelete(entsql.Cascade), entgql.RelayConnection(), forceResolver()),
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
