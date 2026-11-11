// Command genshared turns spec/shared.json into the constants both apps use.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	specPath := flag.String("spec", "spec/shared.json", "the spec to read")
	tsPaths := flag.String("ts", "", "TypeScript files to write, comma separated")
	goPath := flag.String("go", "", "Go file to write")
	goPackage := flag.String("go-package", "shared", "package name of the Go file")
	flag.Parse()

	if err := run(*specPath, *tsPaths, *goPath, *goPackage); err != nil {
		fmt.Fprintln(os.Stderr, "genshared:", err)
		os.Exit(1)
	}
}

func run(specPath, tsPaths, goPath, goPackage string) error {
	s, err := loadSpec(specPath)
	if err != nil {
		return err
	}

	for _, tsPath := range strings.Split(tsPaths, ",") {
		if tsPath == "" {
			continue
		}
		if err := write(tsPath, renderTypeScript(s)); err != nil {
			return err
		}
	}
	if goPath != "" {
		source, err := renderGo(s, goPackage)
		if err != nil {
			return err
		}
		if err := write(goPath, source); err != nil {
			return err
		}
	}

	return nil
}

func write(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	return os.WriteFile(path, []byte(content), 0o644)
}
