package license

import (
	"strings"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/predicate"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

// ListFilter builds the filter of the licenses list for a viewer: an admin sees every license, a writer the shared ones and their own
// licenses and drafts, never another writer's. scope narrows that, and a blank search is ignored.
func ListFilter(viewer auth.Viewer, where *ent.LicenseWhereInput, scope *Scope, search *string) func(*ent.LicenseQuery) (*ent.LicenseQuery, error) {
	predicates := []predicate.License{}
	if !viewer.IsAdmin() {
		predicates = append(predicates, entlicense.Or(entlicense.And(entlicense.IsDraft(false), entlicense.OwnerID(SystemOwner)), entlicense.OwnerID(viewer.Subject)))
	}
	if scope != nil {
		predicates = append(predicates, scopePredicate(*scope))
	}
	if search != nil && strings.TrimSpace(*search) != "" {
		predicates = append(predicates, entlicense.NameContainsFold(strings.TrimSpace(*search)))
	}

	return func(query *ent.LicenseQuery) (*ent.LicenseQuery, error) {
		query, err := where.Filter(query)
		if err != nil {
			return nil, err
		}

		return query.Where(predicates...), nil
	}
}

func scopePredicate(scope Scope) predicate.License {
	switch scope {
	case ScopeShared:
		return entlicense.And(entlicense.IsDraft(false), entlicense.OwnerID(SystemOwner))
	case ScopePersonal:
		return entlicense.And(entlicense.IsDraft(false), entlicense.OwnerIDNEQ(SystemOwner))
	case ScopeDraft:
	}

	return entlicense.IsDraft(true)
}
