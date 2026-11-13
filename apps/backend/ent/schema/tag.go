package schema

import (
	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

const (
	tagNameMaxLength        = 50
	tagDescriptionMaxLength = 650
)

type Tag struct {
	ent.Schema
}

func (Tag) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}, timestamps{}}
}

func (Tag) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			SchemaType(map[string]string{dialect.Postgres: "citext"}).
			Unique().
			MaxLen(tagNameMaxLength).
			Comment("Unique and compared without regard to case.").
			Annotations(entgql.OrderField("NAME")),
		field.String("description").
			Default("").
			MaxLen(tagDescriptionMaxLength),
		field.Enum("status").
			Values("APPROVED", "PENDING").
			Default("APPROVED").
			Annotations(entgql.Type("TagStatus")),
		field.String("requester_user_id").
			Optional().
			Nillable().
			Annotations(entgql.Skip(entgql.SkipAll)),
	}
}

func (Tag) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("novels", Novel.Type).
			Ref("tags").
			Through("novel_tags", NovelTag.Type).
			Annotations(entgql.Skip(entgql.SkipAll)),
	}
}

func (Tag) Indexes() []ent.Index {
	return []ent.Index{index.Fields("status", "name").StorageKey("IDX_tags_status_name")}
}

func (Tag) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entgql.QueryField().Directives(entgql.NewDirective("public")),
	}
}
