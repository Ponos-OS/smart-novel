package devdata

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrWritersNotSet    = errors.New("SEEDED_WRITERS is not set")
	ErrWritersNotJSON   = errors.New("SEEDED_WRITERS is not a valid JSON array of writers")
	ErrWritersEmpty     = errors.New("SEEDED_WRITERS must be a non-empty JSON array")
	ErrWriterFieldEmpty = errors.New("a seeded writer needs a non-empty string")
)

// Writer is an account of the local stack whose role comes from Terraform instead of a writer request: the writers and the admin.
type Writer struct {
	UserID  string `json:"userId"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	PenName string `json:"penName"`
}

// ParseWriters reads the SEEDED_WRITERS setting, a JSON array that Terraform hands over, and refuses a wrong one with a clear message.
func ParseWriters(raw string) ([]Writer, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, ErrWritersNotSet
	}
	var writers []Writer
	if err := json.Unmarshal([]byte(raw), &writers); err != nil {
		return nil, ErrWritersNotJSON
	}
	if len(writers) == 0 {
		return nil, ErrWritersEmpty
	}
	for index, writer := range writers {
		for field, value := range map[string]string{"userId": writer.UserID, "name": writer.Name, "email": writer.Email, "penName": writer.PenName} {
			if value == "" {
				return nil, fmt.Errorf("%w: SEEDED_WRITERS[%d].%s", ErrWriterFieldEmpty, index, field)
			}
		}
	}

	return writers, nil
}
