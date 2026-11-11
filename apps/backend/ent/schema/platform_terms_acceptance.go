package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// PlatformTermsAcceptance records the version of the platform terms a user accepted.
type PlatformTermsAcceptance struct {
	ent.Schema
}

func (PlatformTermsAcceptance) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}}
}

func (PlatformTermsAcceptance) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id"),
		field.Int("terms_version"),
		field.Time("accepted_at").
			SchemaType(timestamptz).
			Default(time.Now).
			Immutable().
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")),
	}
}

func (PlatformTermsAcceptance) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "terms_version").
			Unique().
			StorageKey("platform_terms_acceptances_user_id_terms_version_key"),
		index.Fields("user_id").
			StorageKey("IDX_platform_terms_acceptances_user"),
	}
}

func (PlatformTermsAcceptance) Annotations() []schema.Annotation {
	return []schema.Annotation{entgql.Skip(entgql.SkipAll)}
}
