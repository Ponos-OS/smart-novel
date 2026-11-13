package novel_test

import (
	"testing"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/schema"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
)

func writerRow(status writer.Status) *ent.Writer {
	reason := "Needs a pen name"
	reviewed := "2026-02-03T10:00:00Z"

	return &ent.Writer{
		UserID:    "316784561234",
		Name:      "Mina Tanaka",
		Email:     "mina@smart-novel.localhost",
		PenName:   "Mina_T",
		Status:    status,
		CreatedAt: time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC),
		Applications: []schema.WriterApplication{
			{Note: "I write.", AppliedAt: "2026-01-02T03:04:05Z", RejectionReason: &reason, ReviewedAt: &reviewed},
		},
	}
}

func TestViewWriterShowsOnlyThePenNameOfAnApprovedWriterToReaders(t *testing.T) {
	view, err := novel.ViewWriter(writerRow(writer.StatusAPPROVED), false)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if view.UserID != "316784561234" || view.PenName != "Mina_T" {
		t.Errorf("view = %+v", view)
	}
	if view.Name != nil || view.Email != nil || view.Status != nil || view.CreatedAt != nil || view.Applications != nil {
		t.Errorf("a reader sees what only admins should: %+v", view)
	}
}

func TestViewWriterHidesAWriterThatIsNotApprovedFromReaders(t *testing.T) {
	for _, status := range []writer.Status{writer.StatusPENDING, writer.StatusREJECTED} {
		view, err := novel.ViewWriter(writerRow(status), false)

		if err != nil || view != nil {
			t.Errorf("%s: view = %+v, err = %v, want nothing", status, view, err)
		}
	}
}

func TestViewWriterGivesAdminsEverythingForAnyStatus(t *testing.T) {
	view, err := novel.ViewWriter(writerRow(writer.StatusREJECTED), true)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if *view.Name != "Mina Tanaka" || *view.Email != "mina@smart-novel.localhost" || *view.Status != writer.StatusREJECTED {
		t.Errorf("view = %+v", view)
	}
	if len(view.Applications) != 1 || view.Applications[0].ReviewedAt == nil || view.Applications[0].AppliedAt.Year() != 2026 {
		t.Errorf("applications = %+v", view.Applications)
	}
}

func TestViewWriterRefusesAnApplicationWithABadDate(t *testing.T) {
	row := writerRow(writer.StatusAPPROVED)
	row.Applications[0].AppliedAt = "yesterday"

	_, err := novel.ViewWriter(row, true)

	if err == nil {
		t.Error("err = nil, want an error")
	}
}
