package novel

import (
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	writerpkg "github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

// WriterView is what a viewer may see of the writer of a novel: everybody the pen name of an approved writer, admins the rest too.
type WriterView struct {
	UserID       string
	PenName      string
	Name         *string
	Email        *string
	Status       *writer.Status
	CreatedAt    *time.Time
	Applications []writerpkg.Application
}

// ViewWriter returns what the viewer may see of the writer; nil when they may see nothing.
func ViewWriter(owner *ent.Writer, admin bool) (*WriterView, error) {
	if !admin {
		if owner.Status != writer.StatusAPPROVED {
			return nil, nil
		}

		return &WriterView{UserID: owner.UserID, PenName: owner.PenName}, nil
	}
	applications, err := writerpkg.ViewApplications(owner.Applications)
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
