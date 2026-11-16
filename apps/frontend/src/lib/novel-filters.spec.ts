import { NovelState } from '../generated/graphql';
import { novelQuery } from './novel-filters';

describe('novelQuery', () => {
  it('should ask for nothing when there are no filters', () => {
    // Act
    const result = novelQuery(undefined);

    // Assert
    expect(result).toStrictEqual({});
  });

  it('should turn tags into the tags a novel has and has not', () => {
    // Arrange
    const filters = { tags: { in: ['Fantasy'], nin: ['Mystery'] } };

    // Act
    const result = novelQuery(filters);

    // Assert
    expect(result).toStrictEqual({
      where: {
        hasTagsWith: [{ nameIn: ['Fantasy'] }],
        not: { hasTagsWith: [{ nameIn: ['Mystery'] }] },
      },
      chapterCount: undefined,
      ownerIDs: undefined,
    });
  });

  it('should keep the range of the first chapter, the state, the chapter count and the writers apart from `where`', () => {
    // Arrange
    const filters = {
      chapterCount: { min: 2 },
      firstChapterCreatedAt: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
      },
      state: NovelState.Ongoing,
      ownerIds: ['399193312025837589'],
    };

    // Act
    const result = novelQuery(filters);

    // Assert
    expect(result).toStrictEqual({
      where: {
        firstChapterCreatedAtGTE: '2026-01-01T00:00:00.000Z',
        firstChapterCreatedAtLTE: '2026-01-31T23:59:59.999Z',
        state: NovelState.Ongoing,
      },
      chapterCount: { min: 2 },
      ownerIDs: ['399193312025837589'],
    });
  });

  it('should leave out empty lists', () => {
    // Act
    const result = novelQuery({
      tags: { in: [], nin: [] },
      ownerIds: [],
    });

    // Assert
    expect(result).toStrictEqual({
      where: undefined,
      chapterCount: undefined,
      ownerIDs: undefined,
    });
  });
});
