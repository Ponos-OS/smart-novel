package devdata_test

import (
	"reflect"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
)

func TestUniqueTags(t *testing.T) {
	novels := []devdata.Novel{
		{
			NovelDetails: devdata.NovelDetails{
				Tags: []string{"Fantasy", "adventure"},
			},
		},
		{
			NovelDetails: devdata.NovelDetails{
				Tags: []string{"fantasy", "Romance"},
			},
		},
	}

	tags := devdata.UniqueTags(novels)

	want := []string{"adventure", "fantasy", "romance"}
	if !reflect.DeepEqual(tags, want) {
		t.Errorf("tags = %v, want %v", tags, want)
	}
}
