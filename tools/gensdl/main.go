// Command gensdl reads the validation directives of the hand-written GraphQL schema and writes the limits as TypeScript constants, so the frontend takes them from the schema, which is where the rule lives.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	schemaDir := flag.String("schema", "", "directory with the hand-written *.graphql files")
	out := flag.String("out", "", "TypeScript file to write")
	flag.Parse()
	if *schemaDir == "" || *out == "" {
		flag.Usage()
		os.Exit(2)
	}
	if err := run(*schemaDir, *out); err != nil {
		fmt.Fprintln(os.Stderr, "gensdl:", err)
		os.Exit(1)
	}
}

func run(schemaDir, out string) error {
	limits, err := readLimits(schemaDir)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil { //nolint:gosec // a source directory, not a secret
		return err
	}

	return os.WriteFile(out, []byte(render(limits)), 0o644) //nolint:gosec // a generated source file, not a secret
}
