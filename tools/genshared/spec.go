package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type integer struct {
	Name        string `json:"name"`
	Value       int    `json:"value"`
	Description string `json:"description"`
}

type apiError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	Description string `json:"description"`
}

type entry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type stringMap struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Entries     []entry `json:"entries"`
}

type roleLevel struct {
	Name  string `json:"name"`
	Level int    `json:"level"`
}

type roles struct {
	Description string      `json:"description"`
	Levels      []roleLevel `json:"levels"`
}

type spec struct {
	Integers   []integer   `json:"integers"`
	Errors     []apiError  `json:"errors"`
	StringMaps []stringMap `json:"stringMaps"`
	Roles      roles       `json:"roles"`
}

func loadSpec(path string) (*spec, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var s spec
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&s); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}

	return &s, s.validate()
}

func (s *spec) validate() error {
	seen := map[string]string{}
	claim := func(name, kind string) error {
		if previous, ok := seen[name]; ok {
			return fmt.Errorf("%s %q is already declared as %s", kind, name, previous)
		}
		seen[name] = kind

		return nil
	}

	for _, i := range s.Integers {
		if err := claim(i.Name, "integer"); err != nil {
			return err
		}
	}
	for _, e := range s.Errors {
		if err := claim(e.Code, "error"); err != nil {
			return err
		}
		if e.Message == "" {
			continue
		}
		if err := claim(e.Code+"_MESSAGE", "error message"); err != nil {
			return err
		}
	}
	for _, m := range s.StringMaps {
		if err := claim(m.Name, "stringMap"); err != nil {
			return err
		}
	}
	return nil
}
