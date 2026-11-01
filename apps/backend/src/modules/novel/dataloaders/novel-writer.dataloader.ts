import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { CustomLoggerService } from 'nestjs-backend-common';

import {
  type NovelWriter,
  writerIntegrityError,
  WriterService,
} from '../../writer';

interface NovelWriterKey {
  novelId: string;
  writerId: string;
}

/**
 * @description
 * One query per page for the writers of its novels. What a viewer may see differs between an admin and everybody else, so each gets its own loader. A writer id without a row cannot happen (the foreign key forbids it) and fails the request with a logged fault.
 */
@Injectable({ scope: Scope.REQUEST })
export class NovelWriterDataLoader {
  private readonly loaders = new Map<
    boolean,
    DataLoader<NovelWriterKey, NovelWriter | null, string>
  >();

  constructor(
    private readonly writerService: WriterService,
    private readonly logger: CustomLoggerService,
  ) {}

  load(
    key: NovelWriterKey,
    isAdmin: boolean,
  ): Promise<NovelWriter | null> {
    return this.loaderFor(isAdmin).load(key);
  }

  private loaderFor(isAdmin: boolean) {
    const existing = this.loaders.get(isAdmin);

    if (existing) {
      return existing;
    }

    const loader = new DataLoader<
      NovelWriterKey,
      NovelWriter | null,
      string
    >(
      async (keys) => {
        const writers = await this.writerService.findForNovels(
          keys.map(({ writerId }) => writerId),
          isAdmin,
        );

        return keys.map(({ novelId, writerId }) =>
          writers.has(writerId)
            ? (writers.get(writerId) ?? null)
            : writerIntegrityError(
                this.logger,
                `novel ${novelId} references writer ${writerId} that does not exist`,
              ),
        );
      },
      { cacheKeyFn: ({ writerId }) => writerId },
    );

    this.loaders.set(isAdmin, loader);

    return loader;
  }
}
