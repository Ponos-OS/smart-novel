import { CategoryStatus } from '@prisma/client';

import { PrismaService } from '../../prisma';
import { CategoryService } from './category.service';

const fantasy = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'fantasy',
  status: CategoryStatus.APPROVED,
};
const mystery = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'mystery',
  status: CategoryStatus.APPROVED,
};
const romance = {
  id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
  name: 'romance',
  status: CategoryStatus.APPROVED,
};

const toCursor = (id: string) => Buffer.from(id).toString('base64');

describe(CategoryService.name, () => {
  let uut: CategoryService;
  let prisma: { category: { findMany: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prisma = {
      category: { findMany: vi.fn().mockResolvedValue([]) },
    };
    uut = new CategoryService(prisma as unknown as PrismaService);
  });

  describe('findConnection', () => {
    it('should return a page with cursors and hasNextPage when more exist', async () => {
      prisma.category.findMany.mockResolvedValue([
        fantasy,
        mystery,
        romance,
      ]);

      const result = await uut.findConnection(false, { first: 2 });

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { status: CategoryStatus.APPROVED },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, status: true },
        cursor: undefined,
        skip: undefined,
        take: 3,
      });
      expect(result.edges).toEqual([
        { cursor: toCursor(fantasy.id), node: fantasy },
        { cursor: toCursor(mystery.id), node: mystery },
      ]);
      expect(result.pageInfo).toEqual({
        startCursor: toCursor(fantasy.id),
        endCursor: toCursor(mystery.id),
        hasPreviousPage: false,
        hasNextPage: true,
      });
    });

    it('should continue after the cursor and report the last page', async () => {
      prisma.category.findMany.mockResolvedValue([romance]);

      const result = await uut.findConnection(false, {
        first: 2,
        after: toCursor(mystery.id),
      });

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: mystery.id },
          skip: 1,
          take: 3,
        }),
      );
      expect(result.pageInfo).toEqual({
        startCursor: toCursor(romance.id),
        endCursor: toCursor(romance.id),
        hasPreviousPage: true,
        hasNextPage: false,
      });
    });

    it('should return an empty connection with null cursors', async () => {
      const result = await uut.findConnection(false, { first: 10 });

      expect(result.edges).toBeEmpty();
      expect(result.pageInfo).toEqual({
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });

    it('should page backwards with last and before, keeping name order', async () => {
      prisma.category.findMany.mockResolvedValue([
        romance,
        mystery,
        fantasy,
      ]);

      const result = await uut.findConnection(false, {
        last: 2,
        before: toCursor(romance.id),
      });

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'desc' },
          cursor: { id: romance.id },
        }),
      );
      expect(result.edges.map(({ node }) => node.name)).toEqual([
        'mystery',
        'romance',
      ]);
    });

    it.each([
      { name: 'neither first nor last', pagination: {}, take: 21 },
      {
        name: 'the largest allowed first',
        pagination: { first: 100 },
        take: 101,
      },
    ])(
      'should bound the page when given $name',
      async ({ pagination, take }) => {
        await uut.findConnection(false, pagination);

        expect(prisma.category.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take }),
        );
      },
    );

    it.each([
      { name: 'first 0', pagination: { first: 0 } },
      { name: 'last -1', pagination: { last: -1 } },
      { name: 'first 101', pagination: { first: 101 } },
      { name: 'last 5000', pagination: { last: 5000 } },
    ])('should reject $name', async ({ pagination }) => {
      const result = uut.findConnection(false, pagination);

      await expect(result).rejects.toThrow(/first and last/);
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    it.each([
      { search: '100%', escaped: '100\\%' },
      { search: 'sci_fi', escaped: 'sci\\_fi' },
      { search: 'a\\b', escaped: 'a\\\\b' },
    ])(
      'should escape the LIKE wildcards of $search',
      async ({ search, escaped }) => {
        await uut.findConnection(false, { first: 10 }, { search });

        expect(prisma.category.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              name: { contains: escaped, mode: 'insensitive' },
            }),
          }),
        );
      },
    );

    it.each([
      {
        name: 'after',
        pagination: { first: 5, after: 'not-base64!!' },
      },
      {
        name: 'before',
        pagination: { last: 5, before: toCursor('not-a-uuid') },
      },
    ])(
      'should reject a malformed $name cursor',
      async ({ pagination }) => {
        const result = uut.findConnection(false, pagination);

        await expect(result).rejects.toThrow('Invalid cursor');
        expect(prisma.category.findMany).not.toHaveBeenCalled();
      },
    );

    it('should search the name case-insensitively', async () => {
      await uut.findConnection(
        false,
        { first: 10 },
        { search: 'FAN' },
      );

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: CategoryStatus.APPROVED,
            name: { contains: 'FAN', mode: 'insensitive' },
          },
        }),
      );
    });

    it.each([
      {
        role: 'an admin',
        isAdmin: true,
        expected: CategoryStatus.PENDING,
      },
      {
        role: 'a non-admin',
        isAdmin: false,
        expected: CategoryStatus.APPROVED,
      },
    ])(
      'should give $role the status $expected when PENDING is asked for',
      async ({ isAdmin, expected }) => {
        await uut.findConnection(
          isAdmin,
          { first: 10 },
          { status: CategoryStatus.PENDING },
        );

        expect(prisma.category.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { status: expected } }),
        );
      },
    );

    it('should default an admin to APPROVED', async () => {
      await uut.findConnection(true, { first: 10 });

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CategoryStatus.APPROVED },
        }),
      );
    });
  });
});
