package schema

import (
	"entgo.io/contrib/entgql"
	"entgo.io/ent"
	"entgo.io/ent/schema"
)

// Placeholder exists because ent refuses to generate without a schema. Step 4 removes it.
type Placeholder struct {
	ent.Schema
}

func (Placeholder) Annotations() []schema.Annotation {
	return []schema.Annotation{entgql.Skip(entgql.SkipAll)}
}
