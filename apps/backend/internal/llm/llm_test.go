package llm_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/llm"
)

func TestCacheKey(t *testing.T) {
	const sentence = "The detective scrutinized the crime scene for clues."

	cases := map[string]struct {
		word, sentence, want string
	}{
		"a key made before the Go rewrite": {"scrutinize", sentence, "explain:scrutinize:44983f115f931a846573b791066de4184e2f8374876d29c55abdb318512a7ee9"},
		"a word in capitals":               {"  Scrutinize ", sentence, "explain:scrutinize:44983f115f931a846573b791066de4184e2f8374876d29c55abdb318512a7ee9"},
		"a sentence with other spacing":    {"scrutinize", "  The detective   scrutinized the crime\nscene for clues. ", "explain:scrutinize:44983f115f931a846573b791066de4184e2f8374876d29c55abdb318512a7ee9"},
		"a sentence in capitals":           {"scrutinize", "THE DETECTIVE SCRUTINIZED THE CRIME SCENE FOR CLUES.", "explain:scrutinize:44983f115f931a846573b791066de4184e2f8374876d29c55abdb318512a7ee9"},
	}
	for name, test := range cases {
		t.Run(name, func(t *testing.T) {
			result := llm.CacheKey(test.word, test.sentence)

			if result != test.want {
				t.Errorf("got %s, want %s", result, test.want)
			}
		})
	}
}

func TestCacheKeyIsAnotherOneForAnotherSentence(t *testing.T) {
	first := llm.CacheKey("bank", "She sat on the bank of the river.")
	second := llm.CacheKey("bank", "He kept his money in the bank.")

	if first == second {
		t.Error("two sentences share a key")
	}
}
