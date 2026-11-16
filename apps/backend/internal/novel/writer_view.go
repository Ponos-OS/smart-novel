package novel

import (
	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	writerpkg "github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

// ViewWriter returns what the viewer may see of the writer; nil when they may see nothing.
func ViewWriter(owner *ent.Writer, admin bool) (*model.NovelWriter, error) {
	if !admin {
		if owner.Status != writer.StatusAPPROVED {
			return nil, nil
		}

		return &model.NovelWriter{UserID: owner.UserID, PenName: owner.PenName}, nil
	}
	applications, err := writerpkg.ViewApplications(owner.Applications)
	if err != nil {
		return nil, err
	}

	return &model.NovelWriter{
		UserID:       owner.UserID,
		PenName:      owner.PenName,
		Name:         &owner.Name,
		Email:        &owner.Email,
		Status:       &owner.Status,
		CreatedAt:    &owner.CreatedAt,
		Applications: applications,
	}, nil
}
