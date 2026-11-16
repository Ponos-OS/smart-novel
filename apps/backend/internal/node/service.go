// Package node answers the Global Object Identification queries, node and nodes: any entity by its ID alone. What the API hides stays hidden:
// an ID that is unknown, or that the viewer may not see, answers null, and the two cannot be told apart.
package node

import (
	"context"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

type Service struct {
	repo *repository
}

func NewService(client *ent.Client) *Service {
	return &Service{repo: newRepository(client)}
}

// Get returns the entity with the ID, or nil.
func (s *Service) Get(ctx context.Context, viewer auth.Viewer, id uuid.UUID) (ent.Noder, error) {
	nodes, err := s.Nodes(ctx, viewer, []uuid.UUID{id})
	if err != nil {
		return nil, err
	}

	return nodes[0], nil
}

// Nodes returns the entities of the IDs in the order of the IDs, nil for each one that is unknown or hidden from the viewer.
func (s *Service) Nodes(ctx context.Context, viewer auth.Viewer, ids []uuid.UUID) ([]ent.Noder, error) {
	nodes := make([]ent.Noder, len(ids))
	tables, err := s.repo.tablesOf(ctx, ids)
	if err != nil {
		return nil, err
	}
	loaded, err := s.repo.load(ctx, tables)
	if err != nil {
		return nil, err
	}
	for index, id := range ids {
		if node, found := loaded[id]; found && canSee(viewer, node) {
			nodes[index] = node
		}
	}

	return nodes, nil
}

// canSee holds what each entity shows to whom, the same as the field of the API that lists or reads it: novels and chapters are public, a
// finished license is, a draft is its writer's, an approved tag is, a writer is themselves and the admins, and the statistics are the admins'.
func canSee(viewer auth.Viewer, node ent.Noder) bool {
	switch node := node.(type) {
	case *ent.License:
		return !node.IsDraft || viewer.IsAdmin() || node.OwnerID == viewer.Subject
	case *ent.Tag:
		return node.Status == tag.StatusAPPROVED || viewer.IsAdmin()
	case *ent.Writer:
		return viewer.IsAdmin() || node.UserID == viewer.Subject
	case *ent.StatsSnapshot:
		return viewer.IsAdmin()
	default:
		return true
	}
}
