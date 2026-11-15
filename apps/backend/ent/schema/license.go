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

const systemOwner = "system"

const (
	licenseNameMaxLength = 200
	// licenseTextMaxLength fits the longest canonical text (CC BY-NC-SA 4.0), about 20k characters.
	licenseTextMaxLength = 100000
)

type License struct {
	ent.Schema
}

func (License) Mixin() []ent.Mixin {
	return []ent.Mixin{
		uuidID{},
		timestamps{inAPI: true}, // Adds the timestamps fields to the GraphQL API for License, orderable by both
	}
}

func (License) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			MaxLen(licenseNameMaxLength).
			Comment("Empty only while the row is a draft."),
		field.String("text").
			MaxLen(licenseTextMaxLength).
			SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("text_hash").
			Optional().
			Nillable().
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("Null while the row is a draft: a draft changes on every save and is not deduplicated. Unique per owner."),
		field.Enum("source_type").
			Values("CANONICAL", "FORKED", "CUSTOM").
			Annotations(entgql.Type("LicenseSourceType")),
		field.String("canonical_id").
			Optional().
			Nillable(),
		field.Bool("is_default").
			Default(false),
		field.Bool("is_draft").
			Default(false).
			Annotations(entgql.Skip(entgql.SkipAll)).
			Comment("A license being worked on: mutable, private to its owner, never used by a novel."),
		field.String("owner_id").
			Default(systemOwner).
			Comment("The writer who owns the license or draft; \"system\" for the canonical and default licenses everybody may use."),
	}
}

func (License) Edges() []ent.Edge {
	return []ent.Edge{edge.To("novels", Novel.Type).Annotations(entsql.OnDelete(entsql.Restrict), entgql.Skip(entgql.SkipAll))}
}

func (License) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id", "text_hash").
			Unique().
			StorageKey("licenses_owner_id_text_hash_key"),
	}
}

func (License) Annotations() []schema.Annotation {
	return []schema.Annotation{entgql.RelayConnection()}
}
