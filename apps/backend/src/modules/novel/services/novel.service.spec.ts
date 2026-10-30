import { NotFoundException } from '@nestjs/common';
import { NarrationStatus, NovelState } from '@prisma/client';

import type { LicenseService } from '../../license';
import type {
  IChapterRepository,
  INovelRepository,
} from '../interfaces';
import type { ChapterNarrationService } from './chapter-narration.service';

import { OrderDirection } from '../../../shared';
import { ChapterOrderField } from '../enums';
import { Novel } from '../types';
import { NovelService } from './novel.service';

describe(NovelService.name, () => {
  let uut: NovelService;
  let novelRepository: INovelRepository;
  let chapterRepository: IChapterRepository;
  let chapterNarrationService: ChapterNarrationService;
  let licenseService: LicenseService;

  beforeEach(() => {
    novelRepository = {
      findNovelsConnection: vi.fn(),
      findById: vi.fn(),
      createNovel: vi.fn(),
      updateNovel: vi.fn(),
      deleteNovel: vi.fn(),
    } as any;
    chapterRepository = {
      findChaptersConnection: vi.fn(),
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
    );
  });

  describe('findOne', () => {
    it('should return a novel when id exists', async () => {
      const novel: Novel = {
        author: `Great Calamity Of Fire`,
        category: [
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
        categories: ['fantasy'],
      };
      const created = { id: '78981754-46c4-4521-9216-b9b27dafeab2' };
      vi.mocked(novelRepository.createNovel).mockResolvedValue(
        created as any,
      );

      const result = await uut.createNovel(
        '260311094522198751',
        'Jane Doe',
        input,
      );

      expect(novelRepository.createNovel).toHaveBeenCalledWith({
        ownerId: '260311094522198751',
        author: 'Jane Doe',
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

      await uut.createNovel('260311094522198751', 'Jane Doe', {
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
    it('should return novels as edges when no filters or pagination are provided', async () => {
      vi.mocked(
        novelRepository.findNovelsConnection,
      ).mockResolvedValue({
        items: [
          {
            author: 'Author 1',
            category: ['action', 'fantasy'],
            ownerId: '224691739954204673',
            licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
            id: '15c0aaee-56e3-45cd-b159-b1fa33f52490',
            name: 'Novel One',
            state: NovelState.ONGOING,
            description: 'Description for Novel One',
          },
          {
            author: 'Author 2',
            category: ['romance', 'drama'],
            ownerId: '224691739954204674',
            licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
            id: '6c439896-3c3b-5c57-a27e-026ebbf9e34c',
            name: 'Novel Two',
            state: NovelState.FINISHED,
            description: 'Description for Novel Two',
          },
        ],
        hasMore: false,
      });

      const result = await uut.findNovelsConnection();

      expect(result.edges).toHaveLength(2);
      expect(result.edges.map((edge) => edge.node.id)).toStrictEqual([
        '15c0aaee-56e3-45cd-b159-b1fa33f52490',
        '6c439896-3c3b-5c57-a27e-026ebbf9e34c',
      ]);
      expect(
        novelRepository.findNovelsConnection,
      ).toHaveBeenCalledWith({
        pagination: {
          first: undefined,
          last: undefined,
          after: undefined,
          before: undefined,
        },
        filters: {
          categoryIn: undefined,
          categoryNin: undefined,
        },
      });
    });

    it('should set _filterContext on the returned connection', async () => {
      vi.mocked(
        novelRepository.findNovelsConnection,
      ).mockResolvedValue({ items: [], hasMore: false });

      const result = await uut.findNovelsConnection(
        undefined,
        undefined,
        undefined,
        undefined,
        {
          category: {
            in: ['action'],
            nin: ['mystery'],
          },
        },
      );

      expect(result._filterContext).toStrictEqual({
        categoryIn: ['action'],
        categoryNin: ['mystery'],
      });
    });

    it('should pass category filters to repository', async () => {
      vi.mocked(
        novelRepository.findNovelsConnection,
      ).mockResolvedValue({ items: [], hasMore: false });

      await uut.findNovelsConnection(
        undefined,
        undefined,
        undefined,
        undefined,
        {
          category: {
            in: ['action'],
            nin: ['mystery'],
          },
        },
      );

      expect(
        novelRepository.findNovelsConnection,
      ).toHaveBeenCalledWith({
        pagination: {
          first: undefined,
          last: undefined,
          after: undefined,
          before: undefined,
        },
        filters: {
          categoryIn: ['action'],
          categoryNin: ['mystery'],
        },
      });
    });

    it('should pass pagination args to repository', async () => {
      vi.mocked(
        novelRepository.findNovelsConnection,
      ).mockResolvedValue({
        items: [
          {
            author: 'Author 2',
            category: ['romance', 'drama'],
            ownerId: '224691739954204681',
            licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
            id: '9d154762-d77f-42b4-add2-cf1d234d1a21',
            name: 'Novel Two',
            state: NovelState.FINISHED,
            description: 'Description for Novel Two',
          },
        ],
        hasMore: false,
      });
      const afterCursor =
        'YWZiYzYxYjktMWZmNy00NzkyLTllNzktZmIzZWM1NTkzOWE3'; // Base64 for 'afbc61b9-1ff7-4792-9e79-fb3ec55939a7'

      const result = await uut.findNovelsConnection(
        1,
        undefined,
        afterCursor,
      );

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node.id).toBe(
        '9d154762-d77f-42b4-add2-cf1d234d1a21',
      );
      expect(result.pageInfo.hasPreviousPage).toBe(true);
      expect(
        novelRepository.findNovelsConnection,
      ).toHaveBeenCalledWith({
        pagination: {
          first: 1,
          last: undefined,
          after: afterCursor,
          before: undefined,
        },
        filters: {
          categoryIn: undefined,
          categoryNin: undefined,
        },
      });
    });

    it('should return empty connection when no novels exist', async () => {
      vi.mocked(
        novelRepository.findNovelsConnection,
      ).mockResolvedValue({ items: [], hasMore: false });

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

  describe('getChaptersConnection', () => {
    it('should return a connection with edges and pageInfo', async () => {
      const novelId = '8d3ea510-2dee-4af0-b5c4-7709d15c606a';
      vi.mocked(
        chapterRepository.findChaptersConnection,
      ).mockResolvedValue({
        items: [
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
        hasMore: false,
      });

      const result = await uut.getChaptersConnection(novelId, 10);

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node.id).toBe(
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
      );
      expect(result.edges[0].cursor).toBe(
        'YmI1NjNhZDUtMWFjNC00NmMyLWEyNWYtNmY2MmQyNDVmNDRj',
      );
      expect(result.pageInfo.startCursor).toBe(
        result.edges[0].cursor,
      );
      expect(result.pageInfo.endCursor).toBe(result.edges[1].cursor);
    });

    it('should set _filterContext on the returned connection', async () => {
      const novelId = '8d3ea510-2dee-4af0-b5c4-7709d15c606a';
      vi.mocked(
        chapterRepository.findChaptersConnection,
      ).mockResolvedValue({ items: [], hasMore: false });

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
      vi.mocked(
        chapterRepository.findChaptersConnection,
      ).mockResolvedValue({ items: [], hasMore: false });
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

      expect(
        chapterRepository.findChaptersConnection,
      ).toHaveBeenCalledWith({
        novelId,
        pagination: {
          first: undefined,
          last: undefined,
          after: undefined,
          before: undefined,
        },
        orderByField: ChapterOrderField.CREATED_AT,
        orderByDirection: OrderDirection.DESC,
        filters: { narrationStatus: NarrationStatus.READY },
      });
    });

    it('should return empty connection when no chapters exist', async () => {
      vi.mocked(
        chapterRepository.findChaptersConnection,
      ).mockResolvedValue({ items: [], hasMore: false });
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
      vi.mocked(
        chapterRepository.findChaptersConnection,
      ).mockResolvedValue({ items: [], hasMore: false });
      const novelId = 'cd8bce2c-922b-4b71-86fa-0b234a87e275';

      await uut.getChaptersConnection(novelId);

      expect(
        chapterRepository.findChaptersConnection,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orderByField: ChapterOrderField.CHAPTER_NUMBER,
          orderByDirection: OrderDirection.ASC,
        }),
      );
    });
  });
});
