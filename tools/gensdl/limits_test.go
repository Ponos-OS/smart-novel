package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestRunWritesTheGoldenFile(t *testing.T) {
	out := filepath.Join(t.TempDir(), "limits.ts")

	err := run("testdata/api", out)

	if err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(out)
	want, _ := os.ReadFile("testdata/limits.golden.ts")
	if string(got) != string(want) {
		t.Errorf("output differs from testdata/limits.golden.ts:\n%s", got)
	}
}

func TestScreamingSnake(t *testing.T) {
	cases := map[string]string{
		"description":         "DESCRIPTION",
		"penName":             "PEN_NAME",
		"CreateTagInput":      "CREATE_TAG_INPUT",
		"chapterIDs":          "CHAPTER_IDS",
		"novelID":             "NOVEL_ID",
		"markChaptersRead":    "MARK_CHAPTERS_READ",
		"requestWriterAccess": "REQUEST_WRITER_ACCESS",
	}
	for name, want := range cases {
		if got := screamingSnake(name); got != want {
			t.Errorf("screamingSnake(%q) = %q, want %q", name, got, want)
		}
	}
}

func writeSchema(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	return dir
}

func TestALimitThatIsNotAnIntegerLiteralFails(t *testing.T) {
	dir := writeSchema(t, map[string]string{
		"a.graphql": "input A {\n  name: String! @maxLength(max: \"fifty\")\n}\n",
	})

	_, err := readLimits(dir)

	if !errors.Is(err, errNotAnInteger) {
		t.Errorf("err = %v, want %v", err, errNotAnInteger)
	}
}

func TestTwoRulesWithTheSameNameFail(t *testing.T) {
	dir := writeSchema(t, map[string]string{
		"a.graphql": "input A {\n  name: String! @maxLength(max: 5)\n}\n",
		"b.graphql": "extend input A {\n  name: String! @maxLength(max: 6)\n}\n",
	})

	_, err := readLimits(dir)

	if !errors.Is(err, errDuplicate) {
		t.Errorf("err = %v, want %v", err, errDuplicate)
	}
}
