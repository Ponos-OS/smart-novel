import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import type { ObjectStorageService } from '../../object-storage';
import type { INovelRepository } from '../interfaces';
import type { ChapterNarrationService } from './chapter-narration.service';

import { NovelCoverService } from './novel-cover.service';

describe(NovelCoverService.name, () => {
  const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
  const otherNovelId = '2f6e0c1a-9b7d-4c35-8a41-d3e5f6a7b8c9';
  const objectKey = `covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`;
  let uut: NovelCoverService;
  let novelRepository: INovelRepository;
  let objectStorageService: ObjectStorageService;
  let chapterNarrationService: ChapterNarrationService;

  beforeEach(() => {
    novelRepository = {
      findById: vi.fn().mockResolvedValue({ id: novelId }),
      setCoverUrl: vi.fn(),
    } as any;
    objectStorageService = {
      generateBrowserUploadUrl: vi
        .fn()
        .mockResolvedValue(
          'http://s3.localhost:8080/smart-novel/covers/x.png?X-Amz-Signature=abc',
        ),
      head: vi.fn(),
    } as any;
    chapterNarrationService = {
      deleteAudio: vi.fn().mockResolvedValue(undefined),
    } as any;

    uut = new NovelCoverService(
      novelRepository,
      objectStorageService,
      chapterNarrationService,
      {
        OBJECT_STORAGE_BUCKET: 'smart-novel',
        OBJECT_STORAGE_PUBLIC_URL: 'http://s3.localhost:8080',
      } as any,
    );
  });

  describe('createUploadUrl', () => {
    it.each([
      { contentType: 'image/jpeg', extension: 'jpg' },
      { contentType: 'image/png', extension: 'png' },
      { contentType: 'image/webp', extension: 'webp' },
    ])(
      'should sign a $extension key under the novel prefix for $contentType',
      async ({ contentType, extension }) => {
        const result = await uut.createUploadUrl(
          novelId,
          contentType,
          204800,
        );

        expect(result.objectKey).toMatch(
          new RegExp(
            `^covers/${novelId}/[0-9a-f-]{36}\\.${extension}$`,
          ),
        );
        expect(
          objectStorageService.generateBrowserUploadUrl,
        ).toHaveBeenCalledWith(
          'smart-novel',
          result.objectKey,
          contentType,
          300,
          204800,
        );
        expect(result.uploadUrl).toContain('X-Amz-Signature');
      },
    );

    it('should throw NotFoundException when the novel does not exist', async () => {
      vi.mocked(novelRepository.findById).mockResolvedValue(null);

      const result = uut.createUploadUrl(novelId, 'image/png', 1024);

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });

  describe('setCover', () => {
    beforeEach(() => {
      vi.mocked(objectStorageService.head).mockResolvedValue({
        contentType: 'image/png',
        contentLength: 204800,
      });
      vi.mocked(novelRepository.setCoverUrl).mockResolvedValue({
        novel: { id: novelId } as any,
      });
    });

    it('should store the public URL of the object and return the novel', async () => {
      const result = await uut.setCover(novelId, objectKey);

      expect(novelRepository.setCoverUrl).toHaveBeenCalledWith(
        novelId,
        `http://s3.localhost:8080/smart-novel/${objectKey}`,
      );
      expect(result).toEqual({ id: novelId });
      expect(
        chapterNarrationService.deleteAudio,
      ).not.toHaveBeenCalled();
    });

    it('should remove the previous cover from the bucket', async () => {
      const previousCoverUrl = `http://s3.localhost:8080/smart-novel/covers/${novelId}/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg`;
      vi.mocked(novelRepository.setCoverUrl).mockResolvedValue({
        novel: { id: novelId } as any,
        previousCoverUrl,
      });

      await uut.setCover(novelId, objectKey);

      expect(
        chapterNarrationService.deleteAudio,
      ).toHaveBeenCalledWith(previousCoverUrl);
    });

    it.each([
      {
        name: 'a key of another novel',
        key: `covers/${otherNovelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
      },
      {
        name: 'a narration key',
        key: 'narrations/0b6b3d0e-5d0e-4d58-9f0b-3f1c7d6a2e11.mp3',
      },
      {
        name: 'a key with a path traversal',
        key: `covers/${novelId}/../${otherNovelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
      },
      {
        name: 'a key with a bad extension',
        key: `covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.exe`,
      },
    ])(
      'should reject $name without touching storage',
      async ({ key }) => {
        const result = uut.setCover(novelId, key);

        await expect(result).rejects.toThrow(BadRequestException);
        expect(objectStorageService.head).not.toHaveBeenCalled();
        expect(novelRepository.setCoverUrl).not.toHaveBeenCalled();
      },
    );

    it('should reject a key that was never uploaded', async () => {
      vi.mocked(objectStorageService.head).mockResolvedValue(null);

      const result = uut.setCover(novelId, objectKey);

      await expect(result).rejects.toThrow(BadRequestException);
      expect(novelRepository.setCoverUrl).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'a wrong content type',
        metadata: { contentType: 'text/html', contentLength: 1024 },
      },
      {
        name: 'an oversized object',
        metadata: {
          contentType: 'image/png',
          contentLength: 5 * 1024 * 1024 + 1,
        },
      },
      { name: 'an object without metadata', metadata: {} },
    ])('should reject $name', async ({ metadata }) => {
      vi.mocked(objectStorageService.head).mockResolvedValue(
        metadata,
      );

      const result = uut.setCover(novelId, objectKey);

      await expect(result).rejects.toThrow(BadRequestException);
      expect(novelRepository.setCoverUrl).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the novel does not exist, even for a bad key', async () => {
      vi.mocked(novelRepository.findById).mockResolvedValue(null);

      const result = uut.setCover(novelId, 'narrations/anything.mp3');

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });
});
