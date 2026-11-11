package main

import (
	"fmt"
	"go/format"
	"strconv"
	"strings"
)

func goDoc(name, description string) string {
	if description == "" {
		return ""
	}

	return fmt.Sprintf("// %s %s\n", name, description)
}

func renderGo(s *spec, pkg string) (string, error) {
	var b strings.Builder
	fmt.Fprintf(&b, "// %s\n\npackage %s\n\nimport \"regexp\"\n", header, pkg)

	for _, i := range s.Integers {
		name := pascalCase(i.Name)
		fmt.Fprintf(&b, "\n%sconst %s = %d\n", goDoc(name, i.Description), name, i.Value)
	}
	for _, e := range s.Errors {
		name := pascalCase(e.Code)
		fmt.Fprintf(&b, "\n%sconst %s = %s\n", goDoc(name, e.Description), name, strconv.Quote(e.Code))
		if e.Message != "" {
			fmt.Fprintf(&b, "\nconst %sMessage = %s\n", name, strconv.Quote(e.Message))
		}
	}
	for _, m := range s.StringMaps {
		name := pascalCase(m.Name)
		fmt.Fprintf(&b, "\n%svar %s = map[string]string{\n", goDoc(name, m.Description), name)
		for _, e := range m.Entries {
			fmt.Fprintf(&b, "\t%s: %s,\n", strconv.Quote(e.Key), strconv.Quote(e.Value))
		}
		b.WriteString("}\n")
	}

	b.WriteString("\n// Role is an application role.\ntype Role string\n\nconst (\n")
	for _, r := range s.Roles.Levels {
		fmt.Fprintf(&b, "\tRole%s Role = %s\n", pascalCase(r.Name), strconv.Quote(r.Name))
	}
	b.WriteString(")\n\n// RoleHierarchy maps a role to its level; a higher number means more privileges.\nvar RoleHierarchy = map[Role]int{\n")
	for _, r := range s.Roles.Levels {
		fmt.Fprintf(&b, "\tRole%s: %d,\n", pascalCase(r.Name), r.Level)
	}
	b.WriteString("}\n")

	for _, p := range s.Patterns {
		name := pascalCase(p.Name)
		fmt.Fprintf(&b, "\n%svar %s = regexp.MustCompile(%s)\n", goDoc(name, p.Description), name, strconv.Quote(p.Source))
	}

	b.WriteString("\n// PenNameProblem names what is wrong with a pen name.\ntype PenNameProblem string\n\nconst (\n")
	for _, p := range s.PenNameProblems {
		fmt.Fprintf(&b, "\tPenNameProblem%s PenNameProblem = %s\n", pascalCase(p.Code), strconv.Quote(p.Code))
	}
	b.WriteString(")\n\n// PenNameProblemMessages are the texts shown for each problem.\nvar PenNameProblemMessages = map[PenNameProblem]string{\n")
	for _, p := range s.PenNameProblems {
		fmt.Fprintf(&b, "\tPenNameProblem%s: %s,\n", pascalCase(p.Code), strconv.Quote(p.Message))
	}
	b.WriteString("}\n")

	formatted, err := format.Source([]byte(b.String()))
	if err != nil {
		return "", fmt.Errorf("generated Go does not parse: %w", err)
	}

	return string(formatted), nil
}
