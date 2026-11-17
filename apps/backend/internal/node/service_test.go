package node

import (
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

func TestCanSee(t *testing.T) {
	owner := auth.Viewer{
		Subject: "399193312025837589",
		Roles:   []string{string(auth.RoleWriter)},
	}
	stranger := auth.Viewer{
		Subject: "399193312025837591",
		Roles:   []string{string(auth.RoleUser)},
	}
	admin := auth.Viewer{
		Subject: "399193312025837590",
		Roles:   []string{string(auth.RoleAdmin)},
	}
	cases := []struct {
		name   string
		viewer auth.Viewer
		node   ent.Noder
		want   bool
	}{
		{"a novel is public", stranger, &ent.Novel{}, true},
		{"a chapter is public", stranger, &ent.Chapter{}, true},
		{
			"a finished license is public",
			stranger,
			&ent.License{OwnerID: owner.Subject},
			true,
		},
		{
			"a draft is its writer's",
			owner,
			&ent.License{IsDraft: true, OwnerID: owner.Subject},
			true,
		},
		{
			"a draft is hidden from others",
			stranger,
			&ent.License{IsDraft: true, OwnerID: owner.Subject},
			false,
		},
		{
			"a draft is open to an admin",
			admin,
			&ent.License{IsDraft: true, OwnerID: owner.Subject},
			true,
		},
		{
			"an approved tag is public",
			stranger,
			&ent.Tag{Status: tag.StatusAPPROVED},
			true,
		},
		{
			"a pending tag is hidden from others",
			owner,
			&ent.Tag{Status: tag.StatusPENDING},
			false,
		},
		{
			"a pending tag is open to an admin",
			admin,
			&ent.Tag{Status: tag.StatusPENDING},
			true,
		},
		{
			"a writer is themselves",
			owner,
			&ent.Writer{UserID: owner.Subject},
			true,
		},
		{
			"a writer is hidden from others",
			stranger,
			&ent.Writer{UserID: owner.Subject},
			false,
		},
		{
			"a writer is open to an admin",
			admin,
			&ent.Writer{UserID: owner.Subject},
			true,
		},
		{
			"statistics are hidden from a writer",
			owner,
			&ent.StatsSnapshot{},
			false,
		},
		{"statistics are open to an admin", admin, &ent.StatsSnapshot{}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := canSee(c.viewer, c.node)

			if got != c.want {
				t.Errorf("canSee = %v, want %v", got, c.want)
			}
		})
	}
}
