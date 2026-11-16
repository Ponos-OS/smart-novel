package narration

import "testing"

func TestIsKnown(t *testing.T) {
	for status, want := range map[string]bool{"queued": true, "generating": true, "uploading": true, "completed": true, "failed": true, "transcoding": false} {
		if got := isKnown(status); got != want {
			t.Errorf("isKnown(%q) = %v, want %v", status, got, want)
		}
	}
}
