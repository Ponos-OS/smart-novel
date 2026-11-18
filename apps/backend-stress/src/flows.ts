import { type Call } from './client.ts';

export interface SampleNovel {
  id: string;
  chapterIds: string[];
}

export interface Sample {
  novels: SampleNovel[];
  tag: string;
}

const pick = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

/**
 * @description What a reader does: the home list, a search, the novel page, a chapter. A reader that is not a writer also marks it read.
 */
export function browseFlow(
  call: Call,
  sample: Sample,
  marksRead: boolean,
): void {
  const novel = pick(sample.novels);
  const chapterId = pick(novel.chapterIds);

  call('GetNovels', { first: 20, where: { coverURLNotNil: true } });
  call('FilterTags', { first: 20, search: sample.tag.slice(0, 3) });
  call('SearchNovels', {
    where: { hasTagsWith: [{ nameIn: [sample.tag] }] },
  });
  call('GetNovel', { id: novel.id });
  call('GetChapter', { novelId: novel.id, chapterId });

  if (marksRead) {
    call('MarkChaptersRead', { chapterIds: [chapterId] });
  }
}

/**
 * @description A writer creates a novel and a chapter, edits the text and deletes both again, so the run leaves nothing behind.
 */
export function writeFlow(call: Call, label: string): void {
  const created = call('CreateNovel', {
    input: {
      name: `Stress ${label}`,
      description: 'A novel made by the load test.',
    },
  });
  const novelId = created.data?.createNovel.id;
  if (!novelId) {
    return;
  }

  try {
    call('SearchTags', { first: 5, search: '' });

    const chapter = call('CreateChapter', {
      novelId,
      input: {
        title: 'Chapter 1',
        content: 'The caravan walked on, and the salt crunched.',
      },
    });
    const chapterId = chapter.data?.createChapter.id;
    if (!chapterId) {
      return;
    }

    const stored = call('GetChapter', { novelId, chapterId });

    call('UpdateNovel', {
      id: novelId,
      input: { description: 'The load test changed this.' },
    });
    call('UpdateContent', {
      id: chapterId,
      content: 'The caravan walked on, and the salt crunched louder.',
      expectedContentUpdatedAt:
        stored.data?.novel.chapter.contentUpdatedAt,
    });
    call('DeleteChapter', { id: chapterId });
  } finally {
    call('DeleteNovel', { id: novelId });
  }
}
