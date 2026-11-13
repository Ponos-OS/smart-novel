package novel

import (
	"entgo.io/ent/dialect/sql"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/predicate"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

// Predicates are the conditions of a novel list that ent's where input cannot express: the exact number of chapters and the writers by their identity provider ID.
func Predicates(chapterCount *ChapterCountRange, ownerUserIDs []string) ([]predicate.Novel, error) {
	var check validation.Checker
	if chapterCount != nil {
		chapterCount.check(&check)
	}
	if err := check.Err(); err != nil {
		return nil, err
	}

	var predicates []predicate.Novel
	if chapterCount != nil && chapterCount.Min != nil {
		predicates = append(predicates, chaptersCount(">=", *chapterCount.Min))
	}
	if chapterCount != nil && chapterCount.Max != nil {
		predicates = append(predicates, chaptersCount("<=", *chapterCount.Max))
	}
	if len(ownerUserIDs) > 0 {
		predicates = append(predicates, novel.HasWriterWith(writer.UserIDIn(ownerUserIDs...)))
	}

	return predicates, nil
}

func chaptersCount(operator string, count int) predicate.Novel {
	return func(selector *sql.Selector) {
		selector.Where(sql.P(func(builder *sql.Builder) {
			builder.WriteString("(SELECT COUNT(*) FROM ").Ident(chapter.Table).
				WriteString(" WHERE ").Ident(chapter.Table).WriteByte('.').Ident(chapter.FieldNovelID).
				WriteString(" = ").WriteString(selector.C(novel.FieldID)).
				WriteString(") " + operator + " ").Arg(count)
		}))
	}
}
