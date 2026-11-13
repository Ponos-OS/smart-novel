package chapter

// CreateInput is what createChapter takes; the schema directives on CreateChapterInput have cleaned and checked it.
type CreateInput struct {
	Title   string
	Content string
}

// UpdateInput is what updateChapter takes; a nil field stays as it is.
type UpdateInput struct {
	Title *string
}
