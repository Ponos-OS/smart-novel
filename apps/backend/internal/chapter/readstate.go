package chapter

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
)

// MarkRead records that the user read the chapters, ignoring the ones they already read and the ones that do not exist, and returns how many were new.
func (s *Service) MarkRead(
	ctx context.Context,
	userID string,
	chapterIDs []uuid.UUID,
) (int, error) {
	if len(chapterIDs) == 0 {
		return 0, nil
	}

	return s.repo.markRead(ctx, userID, chapterIDs)
}

// DeleteHistory forgets everything the user read and returns how many records that was.
func (s *Service) DeleteHistory(
	ctx context.Context,
	userID string,
) (int, error) {
	return s.repo.deleteReadHistory(ctx, userID)
}

// ReadAt returns, for the chapters the user read, when they first read them.
func (s *Service) ReadAt(
	ctx context.Context,
	userID string,
	chapterIDs []uuid.UUID,
) (map[uuid.UUID]time.Time, error) {
	states, err := s.repo.readStates(ctx, userID, chapterIDs)
	if err != nil {
		return nil, err
	}
	readAt := make(map[uuid.UUID]time.Time, len(states))
	for _, state := range states {
		readAt[state.ChapterID] = state.FirstReadAt
	}

	return readAt, nil
}

// Adjacent is the chapter next to the given one in its novel: offset 1 for the next, -1 for the previous. It is nil at either end.
func (s *Service) Adjacent(
	ctx context.Context,
	novelID uuid.UUID,
	number, offset int,
) (*ent.Chapter, error) {
	return s.repo.chapterAt(ctx, novelID, number+offset)
}
