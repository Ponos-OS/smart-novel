import type { ConfigType } from '@nestjs/config';

import { NotFoundException } from '@nestjs/common';
import { NarrationStatus, NovelState } from '@prisma/client';

import type { LicenseService } from '../../license';
import type {
  IChapterRepository,
  INovelRepository,
} from '../interfaces';
import type { ChapterNarrationService } from './chapter-narration.service';

import { appConfigs } from '../../../app/configs/app.config';
import { buildAudience, OrderDirection } from '../../../shared';
import { CursorCodec } from '../../cursor';
import { ChapterOrderField, NovelOrderField } from '../enums';
import { Novel } from '../types';
import { NovelService } from './novel.service';

const cursorCodec = new CursorCodec({
  CURSOR_SIGNING_SECRET: 'b7e1f0c2a94d4c1f8d3e6a5b09c27f41',
} as ConfigType<typeof appConfigs>);

const chaptersAudience = (
  novelId: string,
  orderByField = ChapterOrderField.CHAPTER_NUMBER,
  orderByDirection = OrderDirection.ASC,
) =>
  buildAudience('chapters', {
    novelId,
    orderByField,
    orderByDirection,
    filters: {},
  });

describe(NovelService.name, () => {
  let uut: NovelService;
  let novelRepository: INovelRepository;
  let chapterRepository: IChapterRepository;
  let chapterNarrationService: ChapterNarrationService;
  let licenseService: LicenseService;

  beforeEach(() => {
    novelRepository = {
      findNovelsPage: vi.fn(),
      estimateChapterCounts: vi.fn(),
      findById: vi.fn(),
      createNovel: vi.fn(),
      updateNovel: vi.fn(),
      deleteNovel: vi.fn(),
    } as any;
    chapterRepository = {
      findChaptersPage: vi.fn(),
      getChapter: vi.fn(),
      getFirstChapter: vi.fn(),
      getLastChapter: vi.fn(),
    } as any;

    chapterNarrationService = {
      deleteAudio: vi.fn().mockResolvedValue(undefined),
    } as any;

    licenseService = {
      resolve: vi.fn(),
      getDefault: vi.fn(),
    } as any;

    uut = new NovelService(
      novelRepository,
      chapterRepository,
      chapterNarrationService,
      licenseService,
      cursorCodec,
    );
  });

  describe('findOne', () => {
    it('should return a novel when id exists', async () => {
      const novel: Novel = {
        author: `Great Calamity Of Fire`,
        tags: [
          'action',
          'comedy',
          'fantasy',
          'horror',
          'mystery',
          'psychological',
          'supernatural',
        ],
        ownerId: '224691739954204661',
        licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
        description: `Lin Jie is the owner of a bookstore in another world. He's kind and warm-hearted, often recommending healing books to customers who are going through a tough time. From time to time, he secretly promotes his own work too. Over time, these customers begin to respect him greatly, some even frequently bringing local specialties to repay his favor. They often seek his professional opinion when it comes to selecting books, and share their experiences with this ordinary bookstore owner to people around them. They respectfully and intimately refer to him using names such as the "Demon God's Lackey", "Propagator of the Flesh and Blood Gospel", "Corpse Devouring Sect's Rites and Customs' Author" and "Shepherd of the Stars".`,
        id: '3da6f099-50ad-4a57-8a03-188b76ed5e3f',
        name: "I'm Really Not The Demon God's Lackey",
        state: NovelState.ONGOING,
      };
      vi.mocked(novelRepository.findById).mockResolvedValue(novel);

      const result = await uut.findOne(
        '3da6f099-50ad-4a57-8a03-188b76ed5e3f',
      );

      expect(result).toEqual(novel);
      expect(novelRepository.findById).toHaveBeenCalledWith(
        '3da6f099-50ad-4a57-8a03-188b76ed5e3f',
      );
    });

    it('should throw NotFoundException when id does not exist', async () => {
      vi.mocked(novelRepository.findById).mockResolvedValue(null);

      await expect(uut.findOne('missing-uuid')).rejects.toThrow(
        new NotFoundException('Novel with id missing-uuid not found'),
      );
    });
  });

  describe('createNovel', () => {
    const defaultLicenseId = '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06';

    beforeEach(() => {
      vi.mocked(licenseService.getDefault).mockResolvedValue({
        id: defaultLicenseId,
      } as any);
    });

    it('should pass the caller as owner and the default license to the repository when none is chosen', async () => {
      const input = {
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
        tags: ['fantasy'],
      };
      const created = { id: '78981754-46c4-4521-9216-b9b27dafeab2' };
      vi.mocked(novelRepository.createNovel).mockResolvedValue(
        created as any,
      );

      const result = await uut.createNovel(
        '260311094522198751',
        input,
      );

      expect(novelRepository.createNovel).toHaveBeenCalledWith({
        ownerId: '260311094522198751',
        licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
        licenseId: defaultLicenseId,
        ...input,
      });
      expect(result).toBe(created);
    });

    it('should use the chosen license instead of the default', async () => {
      const licenseId = 'b2f4c6a8-1d3e-4f50-8a7b-9c0d1e2f3a4b';
      vi.mocked(licenseService.resolve).mockResolvedValue({
        id: licenseId,
      } as any);

      await uut.createNovel('260311094522198751', {
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
        licenseId,
      });

      expect(licenseService.resolve).toHaveBeenCalledWith(
        { licenseId, licenseDraft: undefined },
        '260311094522198751',
      );
      expect(licenseService.getDefault).not.toHaveBeenCalled();
      expect(novelRepository.createNovel).toHaveBeenCalledWith(
        expect.objectContaining({ licenseId }),
      );
    });
  });

  describe('updateNovel', () => {
    const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';

    it('should update the novel when it exists', async () => {
      const updated = { id: novelId, name: 'Renamed' };
      vi.mocked(novelRepository.findById).mockResolvedValue({
        id: novelId,
      } as any);
      vi.mocked(novelRepository.updateNovel).mockResolvedValue(
        updated as any,
      );

      const result = await uut.updateNovel(novelId, {
        name: 'Renamed',
      });

      expect(novelRepository.updateNovel).toHaveBeenCalledWith(
        novelId,
        {
          name: 'Renamed',
          licenseId: undefined,
        },
      );
      expect(result).toBe(updated);
    });

    it('should repoint the novel to the resolved license', async () => {
      const licenseId = 'b2f4c6a8-1d3e-4f50-8a7b-9c0d1e2f3a4b';
      vi.mocked(novelRepository.findById).mockResolvedValue({
        id: novelId,
        ownerId: '260311094522198751',
      } as any);
      vi.mocked(licenseService.resolve).mockResolvedValue({
        id: licenseId,
      } as any);

      await uut.updateNovel(novelId, { licenseId });

      expect(licenseService.resolve).toHaveBeenCalledWith(
        { licenseId, licenseDraft: undefined },
        '260311094522198751',
      );

      expect(novelRepository.updateNovel).toHaveBeenCalledWith(
        novelId,
        { licenseId },
      );
    });

    it('should throw NotFoundException without updating when the novel does not exist', async () => {
      vi.mocked(novelRepository.findById).mockResolvedValue(null);

      const result = uut.updateNovel(novelId, { name: 'Renamed' });

      await expect(result).rejects.toThrow(NotFoundException);
      expect(novelRepository.updateNovel).not.toHaveBeenCalled();
    });
  });

  describe('deleteNovel', () => {
    const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';

    it('should delete the audio of every chapter and the cover once the novel is gone', async () => {
      vi.mocked(novelRepository.deleteNovel).mockResolvedValue({
        id: novelId,
        coverUrl: `http://localhost:9000/smart-novel/covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
        narrationUrls: [
          'http://localhost:9000/smart-novel/narrations/0b6b3d0e-5d0e-4d58-9f0b-3f1c7d6a2e11.mp3',
          'http://localhost:9000/smart-novel/narrations/9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a.mp3',
        ],
      });

      const result = await uut.deleteNovel(novelId);

      expect(result).toEqual({ id: novelId });
      expect(
        chapterNarrationService.deleteAudio,
      ).toHaveBeenCalledTimes(3);
      expect(
        chapterNarrationService.deleteAudio,
      ).toHaveBeenCalledWith(
        `http://localhost:9000/smart-novel/covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
      );
    });

    it('should not touch object storage when there is nothing to delete', async () => {
      vi.mocked(novelRepository.deleteNovel).mockResolvedValue({
        id: novelId,
        narrationUrls: [],
      });

      await uut.deleteNovel(novelId);

      expect(
        chapterNarrationService.deleteAudio,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException and leave object storage alone when the novel does not exist', async () => {
      vi.mocked(novelRepository.deleteNovel).mockResolvedValue(null);

      const result = uut.deleteNovel(novelId);

      await expect(result).rejects.toThrow(NotFoundException);
      expect(
        chapterNarrationService.deleteAudio,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findNovelsConnection', () => {
    const novelOne = {
      tags: ['action', 'fantasy'],
      ownerId: '224691739954204673',
      writerId: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
      licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
      id: '15c0aaee-56e3-45cd-b159-b1fa33f52490',
      name: 'Novel One',
      state: NovelState.ONGOING,
      description: 'Description for Novel One',
    };
    const novelTwo = {
      ...novelOne,
      tags: ['romance', 'drama'],
      id: '6c439896-3c3b-5c57-a27e-026ebbf9e34c',
      name: 'Novel Two',
      state: NovelState.FINISHED,
    };
    const defaultOrder = {
      field: NovelOrderField.NAME,
      direction: OrderDirection.ASC,
    };
    const noFilters = {
      tagIn: undefined,
      tagNin: undefined,
      chapterCountMin: undefined,
      chapterCountMax: undefined,
      firstChapterCreatedFrom: undefined,
      firstChapterCreatedTo: undefined,
      state: undefined,
      ownerIds: undefined,
    };

    it('should list the novels by name with a default page of 20 when nothing is asked', async () => {
      vi.mocked(novelRepository.findNovelsPage).mockResolvedValue([
        novelOne,
        novelTwo,
      ]);

      const result = await uut.findNovelsConnection();

      expect(result.edges.map((edge) => edge.node.id)).toStrictEqual([
        novelOne.id,
        novelTwo.id,
      ]);
      expect(novelRepository.findNovelsPage).toHaveBeenCalledWith({
        page: { shouldReverse: false, take: 21 },
        filters: noFilters,
        order: defaultOrder,
      });
    });

    it('should hand every filter to the repository', async () => {
      vi.mocked(novelRepository.findNovelsPage).mockResolvedValue([]);
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-06-30T00:00:00.000Z');

      await uut.findNovelsConnection(
        undefined,
        undefined,
        undefined,
        undefined,
        {
          tags: { in: ['action'], nin: ['mystery'] },
          chapterCount: { min: 2, max: 40 },
          firstChapterCreatedAt: { from, to },
          state: NovelState.FINISHED,
          ownerIds: ['364554362883670018', '364554362732740610'],
        },
      );

      expect(novelRepository.findNovelsPage).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: {
            tagIn: ['action'],
            tagNin: ['mystery'],
            chapterCountMin: 2,
            chapterCountMax: 40,
            firstChapterCreatedFrom: from,
            firstChapterCreatedTo: to,
            state: NovelState.FINISHED,
            ownerIds: ['364554362883670018', '364554362732740610'],
          },
        }),
      );
    });

    it('should treat an empty list of owners as no filter', async () => {
      vi.mocked(novelRepository.findNovelsPage).mockResolvedValue([]);

      await uut.findNovelsConnection(
        undefined,
        undefined,
        undefined,
        undefined,
        { ownerIds: [] },
      );

      expect(novelRepository.findNovelsPage).toHaveBeenCalledWith(
        expect.objectContaining({ filters: noFilters }),
      );
    });

    it('should hand the order to the repository', async () => {
      vi.mocked(novelRepository.findNovelsPage).mockResolvedValue([]);

      await uut.findNovelsConnection(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          field: NovelOrderField.FIRST_CHAPTER_CREATED_AT,
          direction: OrderDirection.DESC,
        },
      );

      expect(novelRepository.findNovelsPage).toHaveBeenCalledWith(
        expect.objectContaining({
          order: {
            field: NovelOrderField.FIRST_CHAPTER_CREATED_AT,
            direction: OrderDirection.DESC,
          },
        }),
      );
    });

    it('should page after a cursor issued for the same query', async () => {
      vi.mocked(novelRepository.findNovelsPage).mockResolvedValue([
        novelTwo,
      ]);
      const afterCursor = cursorCodec.encode(
        buildAudience('novels', {
          filters: noFilters,
          order: defaultOrder,
        }),
        'afbc61b9-1ff7-4792-9e79-fb3ec55939a7',
      );

      const result = await uut.findNovelsConnection(
        1,
        undefined,
        afterCursor,
      );

      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
      expect(novelRepository.findNovelsPage).toHaveBeenCalledWith({
        page: {
          cursor: { id: 'afbc61b9-1ff7-4792-9e79-fb3ec55939a7' },
          skip: 1,
          take: 2,
          shouldReverse: false,
        },
        filters: noFilters,
        order: defaultOrder,
      });
    });

    it.each([
      {
        scenario: 'filter',
        filters: { state: NovelState.FINISHED },
        orderBy: undefined,
      },
      {
        scenario: 'sort',
        filters: undefined,
        orderBy: {
          field: NovelOrderField.NAME,
          direction: OrderDirection.DESC,
        },
      },
    ])(
      'should refuse a cursor issued for another $scenario before querying',
      async ({ filters, orderBy }) => {
        const afterCursor = cursorCodec.encode(
          buildAudience('novels', {
            filters: noFilters,
            order: defaultOrder,
          }),
          'afbc61b9-1ff7-4792-9e79-fb3ec55939a7',
        );

        const result = uut.findNovelsConnection(
          5,
          undefined,
          afterCursor,
          undefined,
          filters,
          orderBy,
        );

        await expect(result).rejects.toThrow('Invalid cursor');
        expect(novelRepository.findNovelsPage).not.toHaveBeenCalled();
      },
    );

    it('should refuse a page over the cap', async () => {
      const result = uut.findNovelsConnection(101);

      await expect(result).rejects.toThrow('at most 100');
    });

    it('should return an empty connection when no novels exist', async () => {
      vi.mocked(novelRepository.findNovelsPage).mockResolvedValue([]);

      const result = await uut.findNovelsConnection();

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo).toStrictEqual({
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });
  });

  describe('estimateChapterCounts', () => {
    it('should ask the repository', async () => {
      const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
      const counts = new Map([[novelId, 12]]);
      vi.mocked(
        novelRepository.estimateChapterCounts,
      ).mockResolvedValue(counts);

      const result = await uut.estimateChapterCounts([novelId]);

      expect(result).toBe(counts);
    });
  });

  describe('getChaptersConnection', () => {
    const novelId = '8d3ea510-2dee-4af0-b5c4-7709d15c606a';
    const chapterId = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';

    it.each([
      [
        'another novel',
        chaptersAudience('9d154762-d77f-42b4-add2-cf1d234d1a21'),
      ],
      [
        'another order',
        chaptersAudience(
          novelId,
          ChapterOrderField.CREATED_AT,
          OrderDirection.DESC,
        ),
      ],
      [
        'another filter',
        buildAudience('chapters', {
          novelId,
          orderByField: ChapterOrderField.CHAPTER_NUMBER,
          orderByDirection: OrderDirection.ASC,
          filters: { narrationStatus: NarrationStatus.READY },
        }),
      ],
      ['another connection', buildAudience('novels')],
    ])(
      'should refuse a cursor issued for %s before querying',
      async (_case, audience) => {
        const result = uut.getChaptersConnection(
          novelId,
          10,
          undefined,
          cursorCodec.encode(audience, chapterId),
        );

        await expect(result).rejects.toThrow('Invalid cursor');
        expect(
          chapterRepository.findChaptersPage,
        ).not.toHaveBeenCalled();
      },
    );

    it('should return a connection with edges and pageInfo', async () => {
      const novelId = '8d3ea510-2dee-4af0-b5c4-7709d15c606a';
      vi.mocked(chapterRepository.findChaptersPage).mockResolvedValue(
        [
          {
            id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
            novelId,
            contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
            title: 'Chapter 1: The Beginning',
            chapterNumber: 1,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
          {
            id: '904bf826-33be-4172-b63f-665bba9007b9',
            novelId,
            contentId: 'ddd63ad5-1ac4-46c2-a25f-6f62d245f44c',
            title: 'Chapter 2: The Journey',
            chapterNumber: 2,
            createdAt: '2024-01-03T00:00:00.000Z',
            updatedAt: '2024-01-04T00:00:00.000Z',
          },
        ],
      );

      const result = await uut.getChaptersConnection(novelId, 10);

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node.id).toBe(
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
      );
      expect(result.edges[0].cursor).toBe(
        cursorCodec.encode(
          chaptersAudience(novelId),
          'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        ),
      );
      expect(result.pageInfo.startCursor).toBe(
        result.edges[0].cursor,
      );
      expect(result.pageInfo.endCursor).toBe(result.edges[1].cursor);
    });

    it('should set _filterContext on the returned connection', async () => {
      const novelId = '8d3ea510-2dee-4af0-b5c4-7709d15c606a';
      vi.mocked(chapterRepository.findChaptersPage).mockResolvedValue(
        [],
      );

      const result = await uut.getChaptersConnection(
        novelId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { narrationStatus: { eq: NarrationStatus.READY } },
      );

      expect(result._filterContext).toStrictEqual({
        novelId,
        filters: {
          narrationStatus: NarrationStatus.READY,
        },
      });
    });

    it('should pass orderBy and filters to repository', async () => {
      vi.mocked(chapterRepository.findChaptersPage).mockResolvedValue(
        [],
      );
      const novelId = 'e9462d56-021f-40ed-85a0-e21f6cb2d66d';

      await uut.getChaptersConnection(
        novelId,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          field: ChapterOrderField.CREATED_AT,
          direction: OrderDirection.DESC,
        },
        { narrationStatus: { eq: NarrationStatus.READY } },
      );

      expect(chapterRepository.findChaptersPage).toHaveBeenCalledWith(
        {
          novelId,
          page: { shouldReverse: false },
          orderByField: ChapterOrderField.CREATED_AT,
          orderByDirection: OrderDirection.DESC,
          filters: { narrationStatus: NarrationStatus.READY },
        },
      );
    });

    it('should return empty connection when no chapters exist', async () => {
      vi.mocked(chapterRepository.findChaptersPage).mockResolvedValue(
        [],
      );
      const novelId = 'ed185f30-05a6-403c-bb35-f80b643e4202';

      const result = await uut.getChaptersConnection(novelId);

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo).toStrictEqual({
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });

    it('should default to CHAPTER_NUMBER ASC when no orderBy is provided', async () => {
      vi.mocked(chapterRepository.findChaptersPage).mockResolvedValue(
        [],
      );
      const novelId = 'cd8bce2c-922b-4b71-86fa-0b234a87e275';

      await uut.getChaptersConnection(novelId);

      expect(chapterRepository.findChaptersPage).toHaveBeenCalledWith(
        expect.objectContaining({
          orderByField: ChapterOrderField.CHAPTER_NUMBER,
          orderByDirection: OrderDirection.ASC,
        }),
      );
    });
  });
});
