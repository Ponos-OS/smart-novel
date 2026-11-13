package novel

import (
	"fmt"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/schema"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
)

// WriterView is what a viewer may see of the writer of a novel: everybody the pen name of an approved writer, admins the rest too.
type WriterView struct {
	UserID       string
	PenName      string
	Name         *string
	Email        *string
	Status       *writer.Status
	CreatedAt    *time.Time
	Applications []WriterApplication
}

// WriterApplication is one application to become a writer, with what an admin decided about it.
type WriterApplication struct {
	Note            string
	AppliedAt       time.Time
	RejectionReason *string
	ReviewedAt      *time.Time
}

// ViewWriter returns what the viewer may see of the writer; nil when they may see nothing.
func ViewWriter(owner *ent.Writer, admin bool) (*WriterView, error) {
	if !admin {
		if owner.Status != writer.StatusAPPROVED {
			return nil, nil
		}

		return &WriterView{UserID: owner.UserID, PenName: owner.PenName}, nil
	}
	applications, err := viewApplications(owner.Applications)
	if err != nil {
		return nil, err
	}

	return &WriterView{
		UserID:       owner.UserID,
		PenName:      owner.PenName,
		Name:         &owner.Name,
		Email:        &owner.Email,
		Status:       &owner.Status,
		CreatedAt:    &owner.CreatedAt,
		Applications: applications,
	}, nil
}

func viewApplications(stored []schema.WriterApplication) ([]WriterApplication, error) {
	applications := make([]WriterApplication, len(stored))
	for index, application := range stored {
		appliedAt, err := time.Parse(time.RFC3339Nano, application.AppliedAt)
		if err != nil {
			return nil, fmt.Errorf("application %d has a bad appliedAt: %w", index, err)
		}
		applications[index] = WriterApplication{Note: application.Note, AppliedAt: appliedAt, RejectionReason: application.RejectionReason}
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
