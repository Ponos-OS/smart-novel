package novel

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/entx"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

const (
	// CoverMaxBytes is the largest cover a writer may upload.
	CoverMaxBytes  = 5 * 1024 * 1024
	coverKeyPrefix = "covers"
	coverUploadTTL = 5 * time.Minute

	logKeyURL   = "url"
	logKeyError = "error"
)

// coverExtensions maps the allowed content types to the extension their key ends with.
func coverExtensions() map[string]string {
	return map[string]string{
		"image/jpeg": "jpg",
		"image/png":  "png",
		"image/webp": "webp",
	}
}

// CreateCoverUpload signs the upload of a cover. The key is ours, never the client's, so an upload can only land under this novel's prefix.
func (s *Service) CreateCoverUpload(
	ctx context.Context,
	viewer auth.Viewer,
	novelID uuid.UUID,
	contentType string,
	contentLength int,
) (model.NovelCoverUpload, error) {
	if _, err := authorizedNovel(
		ctx,
		s.repo,
		viewer,
		auth.Update,
		novelID,
		false,
	); err != nil {
		return model.NovelCoverUpload{}, err
	}
	extension, ok := coverExtensions()[contentType]
	if !ok {
		return model.NovelCoverUpload{}, apperr.BadRequest(
			"A cover must be one of: " + strings.Join(
				allowedCoverTypes(),
				", ",
			),
		)
	}
	var check validation.Checker
	check.AtLeast("contentLength", contentLength, 1)
	check.AtMost("contentLength", contentLength, CoverMaxBytes)
	if err := check.Err(); err != nil {
		return model.NovelCoverUpload{}, err
	}
	key := fmt.Sprintf(
		"%s/%s/%s.%s",
		coverKeyPrefix,
		novelID,
		uuid.New(),
		extension,
	)
	url, err := s.storage.PresignPublicUpload(
		ctx,
		key,
		contentType,
		int64(contentLength),
		coverUploadTTL,
	)
	if err != nil {
		return model.NovelCoverUpload{}, err
	}

	return model.NovelCoverUpload{UploadURL: url, ObjectKey: key}, nil
}

// SetCover makes an uploaded object the cover of the novel and removes the previous cover from the bucket.
func (s *Service) SetCover(
	ctx context.Context,
	viewer auth.Viewer,
	novelID uuid.UUID,
	objectKey string,
) (*ent.Novel, error) {
	if _, err := authorizedNovel(
		ctx,
		s.repo,
		viewer,
		auth.Update,
		novelID,
		false,
	); err != nil {
		return nil, err
	}
	if err := s.checkUploadedCover(ctx, novelID, objectKey); err != nil {
		return nil, err
	}
	coverURL := s.storage.URLOf(objectKey)
	var previous *string
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		locked, lockErr := authorizedNovel(
			ctx,
			repo,
			viewer,
			auth.Update,
			novelID,
			true,
		)
		if lockErr != nil {
			return lockErr
		}
		previous = locked.CoverURL

		return repo.setCover(ctx, novelID, coverURL)
	})
	if err != nil {
		return nil, err
	}
	if previous != nil && *previous != coverURL {
		s.removeObject(ctx, *previous)
	}

	return s.Get(ctx, novelID)
}

// checkUploadedCover accepts only a key this novel's upload URL made, with a file in the bucket that is an allowed type and size.
func (s *Service) checkUploadedCover(
	ctx context.Context,
	novelID uuid.UUID,
	objectKey string,
) error {
	if !isCoverKeyOf(novelID, objectKey) {
		return apperr.BadRequest(
			"The object key is not an upload URL key of this novel",
		)
	}
	object, found, err := s.storage.Head(ctx, objectKey)
	if err != nil {
		return err
	}
	if !found {
		return apperr.BadRequest("Nothing was uploaded to this key")
	}
	if _, allowed := coverExtensions()[object.ContentType]; !allowed ||
		object.ContentLength < 1 ||
		object.ContentLength > CoverMaxBytes {
		return apperr.BadRequest(
			"The uploaded file is not an allowed cover type or is too large",
		)
	}

	return nil
}

// removeObject deletes what the URL points to, after the write that made it useless was committed. A failure is logged and never fails that
// write: a leftover object costs a little space, a failed mutation costs the writer their change.
func (s *Service) removeObject(ctx context.Context, url string) {
	key, ours := s.storage.KeyOf(url)
	if !ours {
		return
	}
	if err := s.storage.Delete(ctx, key); err != nil {
		s.logger.WarnContext(
			ctx,
			"removing an object that is not used any more",
			slog.String(logKeyURL, url),
			slog.Any(logKeyError, err),
		)
	}
}

// isCoverKeyOf accepts only the keys CreateCoverUpload makes for this novel: covers/<novel>/<uuid>.<extension>.
func isCoverKeyOf(novelID uuid.UUID, key string) bool {
	name, found := strings.CutPrefix(
		key,
		fmt.Sprintf("%s/%s/", coverKeyPrefix, novelID),
	)
	if !found {
		return false
	}
	id, extension, hasExtension := strings.Cut(name, ".")
	if !hasExtension {
		return false
	}
	parsed, err := uuid.Parse(id)

	return err == nil && parsed.String() == id &&
		slices.Contains(coverExtensionList(), extension)
}

func coverExtensionList() []string {
	extensions := make([]string, 0, len(coverExtensions()))
	for _, extension := range coverExtensions() {
		extensions = append(extensions, extension)
	}

	return extensions
}

func allowedCoverTypes() []string {
	types := make([]string, 0, len(coverExtensions()))
	for contentType := range coverExtensions() {
		types = append(types, contentType)
	}
	slices.Sort(types)

	return types
}
