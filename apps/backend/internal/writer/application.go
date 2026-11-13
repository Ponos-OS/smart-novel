// Package writer holds the rules for writers: asking for writer access, the review of a request and the pen name.
package writer

import (
	"fmt"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent/schema"
)

// Application is one application to become a writer, with what an admin decided about it.
type Application struct {
	Note            string
	AppliedAt       time.Time
	RejectionReason *string
	ReviewedAt      *time.Time
}

// ViewApplications reads the stored history of applications, oldest first.
func ViewApplications(stored []schema.WriterApplication) ([]Application, error) {
	applications := make([]Application, len(stored))
	for index, application := range stored {
		appliedAt, err := time.Parse(time.RFC3339Nano, application.AppliedAt)
		if err != nil {
			return nil, fmt.Errorf("application %d has a bad appliedAt: %w", index, err)
		}
		applications[index] = Application{Note: application.Note, AppliedAt: appliedAt, RejectionReason: application.RejectionReason}
		if application.ReviewedAt != nil {
			reviewedAt, err := time.Parse(time.RFC3339Nano, *application.ReviewedAt)
			if err != nil {
				return nil, fmt.Errorf("application %d has a bad reviewedAt: %w", index, err)
			}
			applications[index].ReviewedAt = &reviewedAt
		}
	}

	return applications, nil
}
