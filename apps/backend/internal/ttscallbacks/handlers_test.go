package ttscallbacks_test

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

const jobID = "2bce49d6-6592-4ed3-b421-f913b9ecc3bd"

func TestAudioKey(t *testing.T) {
	result := ttscallbacks.AudioKey(jobID)

	if result != "narrations/2bce49d6-6592-4ed3-b421-f913b9ecc3bd.mp3" {
		t.Errorf("got %s", result)
	}
}

func TestParseUpdateAcceptsWhatBeatriceSends(t *testing.T) {
	bodies := map[string]string{
		"a completed job":                 `{"attempt":1,"fileSizeBytes":4,"jobId":"` + jobID + `","status":"completed"}`,
		"a job in progress":               `{"jobId":"` + jobID + `","status":"generating","progress":2,"clientContextId":"4769a024-6267-4abc-a412-5ab0241a8d0e"}`,
		"a failed job":                    `{"jobId":"` + jobID + `","status":"failed","failedAt":"2026-11-16T10:30:00Z","error":{"code":"TTS_UNAVAILABLE","message":"The model did not answer"}}`,
		"a status Beatrice may add":       `{"jobId":"` + jobID + `","status":"transcoding","progress":3}`,
		"a size of zero":                  `{"jobId":"` + jobID + `","status":"completed","fileSizeBytes":0}`,
		"a job id in capital letters":     `{"jobId":"2BCE49D6-6592-4ED3-B421-F913B9ECC3BD","status":"queued"}`,
		"a field the backend ignores":     `{"jobId":"` + jobID + `","status":"queued","somethingNew":true}`,
		"an update without a progress":    `{"jobId":"` + jobID + `","status":"uploading"}`,
		"a context that is not a chapter": `{"jobId":"` + jobID + `","status":"queued","clientContextId":"anything"}`,
	}
	for name, body := range bodies {
		t.Run(name, func(t *testing.T) {
			_, err := ttscallbacks.ParseUpdate([]byte(body))
			if err != nil {
				t.Errorf("got %v, want the update accepted", err)
			}
		})
	}
}

func TestParseUpdateRefusesWhatIsNotAnUpdate(t *testing.T) {
	bodies := map[string]string{
		"not JSON":                        `status=completed`,
		"nothing":                         `{}`,
		"a status without a job":          `{"status":"not-a-real-status"}`,
		"a job that is not a uuid":        `{"jobId":"../../x","status":"queued"}`,
		"no status":                       `{"jobId":"` + jobID + `"}`,
		"a blank status":                  `{"jobId":"` + jobID + `","status":"  "}`,
		"a progress of zero":              `{"jobId":"` + jobID + `","status":"queued","progress":0}`,
		"a negative size":                 `{"jobId":"` + jobID + `","status":"completed","fileSizeBytes":-1}`,
		"an attempt of zero":              `{"jobId":"` + jobID + `","status":"queued","attempt":0}`,
		"a date that is not a date":       `{"jobId":"` + jobID + `","status":"failed","failedAt":"yesterday"}`,
		"a progress that is not a number": `{"jobId":"` + jobID + `","status":"queued","progress":"soon"}`,
	}
	for name, body := range bodies {
		t.Run(name, func(t *testing.T) {
			_, err := ttscallbacks.ParseUpdate([]byte(body))

			if err == nil {
				t.Error("the update was accepted")
			}
		})
	}
}
