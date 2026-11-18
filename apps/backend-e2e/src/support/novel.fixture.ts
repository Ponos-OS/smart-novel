import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from './auth.fixture';
import { graphql } from './graphql.helper';

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
    }
  }
`;

const CREATE_CHAPTER = `#graphql
  mutation CreateChapter($novelID: ID!, $input: CreateChapterInput!) {
    createChapter(novelID: $novelID, input: $input) {
      id
    }
  }
`;

const CREATE_TAG = `#graphql
  mutation CreateTag($name: String!, $description: String!) {
    createTag(input: { name: $name, description: $description }) {
      id
    }
  }
`;

const SEEDED_NOVELS = `#graphql
  query SeededNovels {
    novels(first: 50, where: { coverURLNotNil: true }) {
      edges {
        node {
          id
          allowedActions
          chapters(first: 10, orderBy: { field: CHAPTER_NUMBER, direction: ASC }) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`;

interface ChapterInput {
  title: string;
  content: string;
}

interface NovelFixtureOptions {
  /**
   * @description The chapters to create, in order. A number creates that many with a generated title and text.
   */
  chapters?: number | ChapterInput[];
  tags?: string[];
  /**
   * @description Owner of the novel; the seeded writer when left out.
   */
  authorization?: string;
}

export interface CreatedNovel {
  novelId: string;
  chapterIds: string[];
  authorization: string;
}

interface SeededArgs {
  /** @description ensures we really have at least this many chapter for the novel you are looking for */
  minChapters: number;
  /** @description is the index of the filtered novels whom has satisfy `minChapters` constrains */
  index: number;
  authorization: string;
}

export class NovelFixture {
  /**
   * @description Makes sure an approved tag of that name exists; the generated novels carry tags of their own, so a spec that needs a
   * given name creates it. An existing tag is left as it is.
   */
  static async ensureTag(name: string): Promise<void> {
    await graphql(
      CREATE_TAG,
      { name, description: `The ${name} tag of an e2e spec.` },
      await AuthorizationFixture.getAdminAuthorizationHeader(),
    );
  }

  /**
   * @description A novel the seeder generated (the only ones with a cover), whose chapters were never narrated, which `authorization` may manage. `index` picks another one, so two specs that narrate do not share chapters.
   */
  static async seeded({
    authorization,
    index = 0,
    minChapters = 1,
  }: SeededArgs): Promise<CreatedNovel> {
    const data = await graphql(SEEDED_NOVELS, {}, authorization);
    const candidates = (
      data.data.novels.edges as {
        node: {
          id: string;
          allowedActions: string[];
          chapters: { edges: { node: { id: string } }[] };
        };
      }[]
    )
      .map(({ node }) => node)
      .filter(
        (node) =>
          node.allowedActions.includes('MANAGE_TTS') &&
          node.chapters.edges.length >= minChapters,
      );
    const found = candidates[index];
    if (!found) {
      throw new Error(
        `no seeded novel number ${index} with ${minChapters} chapters: raise DEVDATA_NOVELS_COUNT and DEVDATA_CHAPTERS_COUNT_PER_NOVEL`,
      );
    }

    return {
      novelId: found.id,
      chapterIds: found.chapters.edges.map(({ node }) => node.id),
      authorization,
    };
  }

  /**
   * @description A novel of its own, so a spec never depends on what the seeder generated.
   */
  static async create({
    chapters = 0,
    tags,
    authorization,
  }: NovelFixtureOptions = {}): Promise<CreatedNovel> {
    for (const name of tags ?? []) {
      await NovelFixture.ensureTag(name);
    }
    const owner =
      authorization ??
      (await AuthorizationFixture.getWriterAuthorizationHeader());
    const created = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: `The Salt Road ${randomUUID().slice(0, 8)}`,
          description: 'A caravan crosses a dry sea bed.',
          ...(tags && { tags }),
        },
      },
      owner,
    );
    if (created.errors) {
      throw new Error(
        `createNovel: ${JSON.stringify(created.errors)}`,
      );
    }
    const novelId = created.data.createNovel.id as string;
    const chapterIds: string[] = [];

    for (const input of NovelFixture.chapterInputs(chapters)) {
      const chapter = await graphql(
        CREATE_CHAPTER,
        { novelID: novelId, input },
        owner,
      );
      if (chapter.errors) {
        throw new Error(
          `createChapter: ${JSON.stringify(chapter.errors)}`,
        );
      }
      chapterIds.push(chapter.data.createChapter.id);
    }

    return { novelId, chapterIds, authorization: owner };
  }

  private static chapterInputs(
    chapters: number | ChapterInput[],
  ): ChapterInput[] {
    if (typeof chapters !== 'number') {
      return chapters;
    }

    return Array.from({ length: chapters }, (_, index) => ({
      title: `Chapter ${index + 1}`,
      content: `# Chapter ${index + 1}\n\nThe caravan walked on, and the salt crunched under every step of day ${index + 1}.`,
    }));
  }
}
