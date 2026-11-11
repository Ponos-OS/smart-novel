package main

import "strings"

func pascalCase(screamingSnake string) string {
	var out strings.Builder
	for _, word := range strings.Split(screamingSnake, "_") {
		if word == "" {
			continue
		}
		out.WriteString(strings.ToUpper(word[:1]) + strings.ToLower(word[1:]))
	}

	return out.String()
}
