package graph

import (
	"log/slog"

	"github.com/99designs/gqlgen/graphql"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/llm"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/narration"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/node"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

func Module() fx.Option {
	return fx.Module(
		"graph",
		fx.Provide(
			newResolver,
			func(resolver *Resolver) graphql.ExecutableSchema {
				return NewExecutableSchema(Config{
					Resolvers:  resolver,
					Directives: Directives(),
				})
			},
			server.AsExtension(NewLoaderExtension),
		),
	)
}

type resolverParams struct {
	fx.In

	Client           *ent.Client
	Logger           *slog.Logger
	TagService       *tag.Service
	NovelService     *novel.Service
	LicenseService   *license.Service
	ChapterService   *chapter.Service
	StatsService     *stats.Service
	LLMService       *llm.Service
	NarrationService *narration.Service
	NodeService      *node.Service
	WriterService    *writer.Service
	TermsService     *platformterms.Service
	Management       *zitadel.Management
}

func newResolver(p resolverParams) *Resolver {
	return &Resolver{
		Client:           p.Client,
		Logger:           p.Logger,
		TagService:       p.TagService,
		NovelService:     p.NovelService,
		LicenseService:   p.LicenseService,
		ChapterService:   p.ChapterService,
		StatsService:     p.StatsService,
		LLMService:       p.LLMService,
		NarrationService: p.NarrationService,
		NodeService:      p.NodeService,
		WriterService:    p.WriterService,
		TermsService:     p.TermsService,
		Management:       p.Management,
	}
}
