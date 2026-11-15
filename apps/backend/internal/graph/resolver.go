package graph

import (
	"log/slog"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

// Resolver holds what the resolvers call; it is built once in cmd/server.
type Resolver struct {
	Client         *ent.Client
	Logger         *slog.Logger
	TagService     *tag.Service
	NovelService   *novel.Service
	LicenseService *license.Service
	ChapterService *chapter.Service
	StatsService   *stats.Service
	WriterService  *writer.Service
	TermsService   *platformterms.Service
}
