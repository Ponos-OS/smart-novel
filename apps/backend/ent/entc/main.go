package main

import (
	"log"

	"entgo.io/contrib/entgql"
	"entgo.io/ent/entc"
	"entgo.io/ent/entc/gen"
)

func main() {
	extension, err := entgql.NewExtension(
		entgql.WithSchemaGenerator(),
		entgql.WithSchemaPath("api/ent.graphql"),
		entgql.WithConfigPath("gqlgen.yml"),
		entgql.WithWhereInputs(true),
	)
	if err != nil {
		log.Fatalf("creating entgql extension: %v", err)
	}
	if err := entc.Generate("./ent/schema", &gen.Config{Features: []gen.Feature{gen.FeatureVersionedMigration}}, entc.Extensions(extension)); err != nil {
		log.Fatalf("running ent codegen: %v", err)
	}
}
