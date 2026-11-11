import { NovelWriterDataLoader } from './novel-writer.dataloader';

const novelId = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
const otherNovelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';
const writerId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
const missingWriterId = '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93';
const minaWriter = {
  userId: '364554362883670018',
  penName: 'Mina_Ardalan',
};

describe(NovelWriterDataLoader.name, () => {
  let uut: NovelWriterDataLoader;
  let writerService: { findForNovels: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    writerService = {
      findForNovels: vi
        .fn()
        .mockResolvedValue(new Map([[writerId, minaWriter]])),
    };
    logger = { error: vi.fn() };
    uut = new NovelWriterDataLoader(
      writerService as never,
      logger as never,
    );
  });

  it('should ask once for all the writers of a page, each writer only once', async () => {
    const results = await Promise.all([
      uut.load({ novelId, writerId }, false),
      uut.load({ novelId: otherNovelId, writerId }, false),
    ]);

    expect(results).toStrictEqual([minaWriter, minaWriter]);
    expect(
      writerService.findForNovels,
    ).toHaveBeenCalledExactlyOnceWith([writerId], false);
  });

  it('should keep what an admin may see apart from what everybody else may see', async () => {
    await uut.load({ novelId, writerId }, false);
    await uut.load({ novelId, writerId }, true);

    expect(writerService.findForNovels).toHaveBeenNthCalledWith(
      1,
      [writerId],
      false,
    );
    expect(writerService.findForNovels).toHaveBeenNthCalledWith(
      2,
      [writerId],
      true,
    );
  });

  it('should give null for a writer the viewer may not see', async () => {
    writerService.findForNovels.mockResolvedValue(
      new Map([[writerId, null]]),
    );

    const result = await uut.load({ novelId, writerId }, false);

    expect(result).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should fail loudly and log it for a writer id that has no row', async () => {
    const result = uut.load(
      { novelId, writerId: missingWriterId },
      false,
    );

    await expect(result).rejects.toThrow('Writer integrity error');
    expect(logger.error).toHaveBeenCalledWith(
      `Writer integrity error: novel ${novelId} references writer ${missingWriterId} that does not exist`,
    );
  });
});
