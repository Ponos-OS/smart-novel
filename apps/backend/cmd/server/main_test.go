package main

import (
	"testing"

	"go.uber.org/fx"
)

func TestOptionsWireEveryDependency(t *testing.T) {
	err := fx.ValidateApp(options())
	if err != nil {
		t.Fatalf("the dependency graph is incomplete: %v", err)
	}
}
