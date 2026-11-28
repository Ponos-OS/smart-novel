package schema

import (
	"time"

	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// WriterApplication is one entry of the append-only history of a writer's applications. The review fields stay nil until an admin decides, and that is the only time an entry changes.
type WriterApplication struct {
	Note            string  `json:"note"`
	AppliedAt       string  `json:"appliedAt"`
	RejectionReason *string `json:"rejectionReason"`
	ReviewedBy      *string `json:"reviewedBy"`
	ReviewedAt      *string `json:"reviewedAt"`
}

// Writer is a writer, or a user who applied to become one.
type Writer struct {
	ent.Schema
}

func (Writer) Mixin() []ent.Mixin {
	return []ent.Mixin{uuidID{}}
}

func (Writer) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").
			Comment("The ID of the user in the identity provider."),
		field.String("name"),
		field.String("email"),
		field.String("pen_name").
			SchemaType(map[string]string{dialect.Postgres: "citext"}).
			Comment("Unique and compared without regard to case, and keeps the case the writer typed."),
		field.Enum("status").
			Values("PENDING", "APPROVED", "REJECTED").
			Default("PENDING").
			Comment("PENDING waits for an admin; a REJECTED user may apply again.").
			Annotations(entgql.Type("WriterStatus")),
		field.JSON("applications", []WriterApplication{}).
			Default([]WriterApplication{}).
			Annotations(entsql.Default("[]"), entgql.Skip(entgql.SkipAll)),
		field.Time("created_at").
			Comment("When the current request was filed; a rejected user who asks again will be appended in the applications list and this field will still point to the first time user initiated the request.").
			SchemaType(timestamptz()).
			Default(time.Now).
			Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP"), entgql.OrderField("CREATED_AT")),
	}
}

func (Writer) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("novels", Novel.Type).
			Annotations(entsql.OnDelete(entsql.Restrict), entgql.Skip(entgql.SkipAll)),
	}
}

func (Writer) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id").
			Unique().
			StorageKey("UQ_writers_user"),
		index.Fields("pen_name").
			Unique().
			StorageKey("UQ_writers_pen_name"),
		index.Fields("status", "created_at").
			StorageKey("IDX_writers_status_created_at"),
	}
}

func (Writer) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entgql.RelayConnection(),
		entsql.Checks(map[string]string{
			"writers_applications_is_array_of_objects": `jsonb_typeof("applications") = 'array' AND NOT jsonb_path_exists("applications", '$[*] ? (@.type() != "object")')`,
		}),
	}
}
