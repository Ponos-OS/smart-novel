import type { CustomLoggerService } from 'nestjs-backend-common';

import { CategoryStatus, Prisma } from '@prisma/client';

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
  let logger: { warn: ReturnType<typeof vi.fn> };
  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    category: Record<
      | 'findMany'
      | 'createMany'
      | 'findUniqueOrThrow'
      | 'findUnique'
      | 'updateMany'
      | 'update'
      | 'delete',
      ReturnType<typeof vi.fn>
    >;
  };

  beforeEach(() => {
    logger = { warn: vi.fn() };
    prisma = {
      $queryRaw: vi.fn(),
      category: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    uut = new CategoryService(
      prisma as unknown as PrismaService,
      logger as unknown as CustomLoggerService,
    );
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

  describe('request', () => {
    const requestedById = '300311094522198754';

    it('should store the normalized name as PENDING for the requester', async () => {
      const pending = {
        id: fantasy.id,
        name: 'slice of life',
        status: CategoryStatus.PENDING,
      };
      prisma.category.createMany.mockResolvedValue({ count: 1 });
      prisma.category.findUniqueOrThrow.mockResolvedValue(pending);

      const result = await uut.request(
        requestedById,
        '  Slice Of LIFE ',
      );

      expect(prisma.category.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'slice of life',
            status: CategoryStatus.PENDING,
            requestedById,
          },
        ],
        skipDuplicates: true,
      });
      expect(result).toBe(pending);
    });

    it('should reject a name longer than 50 characters', async () => {
      const result = uut.request(requestedById, 'a'.repeat(51));

      await expect(result).rejects.toThrow('at most 50 characters');
      expect(prisma.category.createMany).not.toHaveBeenCalled();
    });

    it('should reject a name that exists, naming its normalized form', async () => {
      prisma.category.createMany.mockResolvedValue({ count: 0 });

      const result = uut.request(requestedById, 'FANTASY');

      await expect(result).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('"fantasy"'),
        }),
      );
      expect(
        prisma.category.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should turn a pending category into an approved one', async () => {
      prisma.category.findUnique.mockResolvedValue(fantasy);

      const result = await uut.approve(fantasy.id);

      expect(prisma.category.updateMany).toHaveBeenCalledWith({
        where: { id: fantasy.id, status: CategoryStatus.PENDING },
        data: { status: CategoryStatus.APPROVED },
      });
      expect(result).toBe(fantasy);
    });

    it('should answer 404 when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      const result = uut.approve(fantasy.id);

      await expect(result).rejects.toThrow('Category not found');
    });
  });

  describe('rename', () => {
    const knownError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('boom', {
        code,
        clientVersion: 'test',
      });

    it('should store the normalized name', async () => {
      const renamed = { ...fantasy, name: 'high fantasy' };
      prisma.category.update.mockResolvedValue(renamed);

      const result = await uut.rename(fantasy.id, ' High Fantasy ');

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: fantasy.id },
        data: { name: 'high fantasy' },
        select: { id: true, name: true, status: true },
      });
      expect(result).toBe(renamed);
    });

    it('should reject a name longer than 50 characters', async () => {
      const result = uut.rename(fantasy.id, 'a'.repeat(51));

      await expect(result).rejects.toThrow('at most 50 characters');
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('should reject a name another category has, naming its normalized form', async () => {
      prisma.category.update.mockRejectedValue(knownError('P2002'));

      const result = uut.rename(fantasy.id, 'Mystery');

      await expect(result).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('"mystery"'),
        }),
      );
    });

    it('should answer 404 when the category does not exist', async () => {
      prisma.category.update.mockRejectedValue(knownError('P2025'));

      const result = uut.rename(fantasy.id, 'epic');

      await expect(result).rejects.toThrow('Category not found');
    });

    it('should let an unknown error through', async () => {
      prisma.category.update.mockRejectedValue(new Error('db down'));

      const result = uut.rename(fantasy.id, 'epic');

      await expect(result).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('should delete the category and return its id', async () => {
      prisma.category.delete.mockResolvedValue(fantasy);

      const result = await uut.delete(fantasy.id);

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: fantasy.id },
      });
      expect(result).toEqual({ id: fantasy.id });
    });

    it('should answer 404 when the category does not exist', async () => {
      prisma.category.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('boom', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      const result = uut.delete(fantasy.id);

      await expect(result).rejects.toThrow('Category not found');
    });
  });

  describe('estimateNovelCounts', () => {
    const plan = (rows: number) => [
      { 'QUERY PLAN': [{ Plan: { 'Plan Rows': rows } }] },
    ];

    it('should read the row estimate of the plan, one EXPLAIN per category', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce(plan(1203.4))
        .mockResolvedValueOnce(plan(7));

      const result = await uut.estimateNovelCounts([
        fantasy.id,
        mystery.id,
      ]);

      expect(result).toEqual(
        new Map([
          [fantasy.id, 1203],
          [mystery.id, 7],
        ]),
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const [statement] = prisma.$queryRaw.mock.calls[0];
      expect(statement.sql).toContain('EXPLAIN (FORMAT JSON)');
      expect(statement.sql).not.toMatch(/count\(/i);
      expect(statement.values).toEqual([fantasy.id]);
    });

    it.each([
      { name: 'no rows', plan: [] },
      {
        name: 'a plan without an estimate',
        plan: [{ 'QUERY PLAN': [{ Plan: {} }] }],
      },
      { name: 'a malformed plan', plan: [{ 'QUERY PLAN': 'nope' }] },
    ])('should answer 0 and log for $name', async ({ plan }) => {
      prisma.$queryRaw.mockResolvedValue(plan);

      const result = await uut.estimateNovelCounts([fantasy.id]);

      expect(result).toEqual(new Map([[fantasy.id, 0]]));
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('should answer 0 for the category whose EXPLAIN failed and keep the others', async () => {
      prisma.$queryRaw
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce(plan(12));

      const result = await uut.estimateNovelCounts([
        fantasy.id,
        mystery.id,
      ]);

      expect(result).toEqual(
        new Map([
          [fantasy.id, 0],
          [mystery.id, 12],
        ]),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
      );
    });
  });
});
