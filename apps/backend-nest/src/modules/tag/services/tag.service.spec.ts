import type { ConfigType } from '@nestjs/config';
import type { CustomLoggerService } from 'nestjs-backend-common';

import { Prisma, TagStatus } from '@prisma/client';

import { appConfigs } from '../../../app/configs/app.config';
import { buildAudience } from '../../../shared';
import { CursorCodec } from '../../cursor';
import { PrismaService } from '../../prisma';
import { TagService } from './tag.service';

const fantasy = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'fantasy',
  status: TagStatus.APPROVED,
};
const mystery = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'mystery',
  status: TagStatus.APPROVED,
};
const romance = {
  id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
  name: 'romance',
  status: TagStatus.APPROVED,
};

const cursorCodec = new CursorCodec({
  CURSOR_SIGNING_SECRET: 'b7e1f0c2a94d4c1f8d3e6a5b09c27f41',
} as ConfigType<typeof appConfigs>);
const approvedOnly = buildAudience('tags', {
  where: { status: { in: [TagStatus.APPROVED] } },
});
const toCursor = (id: string, audience = approvedOnly) =>
  cursorCodec.encode(audience, id);

describe(TagService.name, () => {
  let uut: TagService;
  let logger: { warn: ReturnType<typeof vi.fn> };
  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    tag: Record<
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
      tag: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    uut = new TagService(
      prisma as unknown as PrismaService,
      logger as unknown as CustomLoggerService,
      cursorCodec,
    );
  });

  describe('findConnection', () => {
    it('should return a page with cursors and hasNextPage when more exist', async () => {
      prisma.tag.findMany.mockResolvedValue([
        fantasy,
        mystery,
        romance,
      ]);

      const result = await uut.findConnection(false, { first: 2 });

      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { status: { in: [TagStatus.APPROVED] } },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          requesterUserId: true,
        },
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
      prisma.tag.findMany.mockResolvedValue([romance]);

      const result = await uut.findConnection(false, {
        first: 2,
        after: toCursor(mystery.id),
      });

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
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
      prisma.tag.findMany.mockResolvedValue([
        romance,
        mystery,
        fantasy,
      ]);

      const result = await uut.findConnection(false, {
        last: 2,
        before: toCursor(romance.id),
      });

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
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

        expect(prisma.tag.findMany).toHaveBeenCalledWith(
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
      expect(prisma.tag.findMany).not.toHaveBeenCalled();
    });

    it.each([
      { search: '100%', escaped: '100\\%' },
      { search: 'sci_fi', escaped: 'sci\\_fi' },
      { search: 'a\\b', escaped: 'a\\\\b' },
    ])(
      'should escape the LIKE wildcards of $search',
      async ({ search, escaped }) => {
        await uut.findConnection(false, { first: 10 }, { search });

        expect(prisma.tag.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                {
                  name: { startsWith: escaped, mode: 'insensitive' },
                },
                {
                  name: {
                    contains: ` ${escaped}`,
                    mode: 'insensitive',
                  },
                },
                {
                  name: {
                    contains: `-${escaped}`,
                    mode: 'insensitive',
                  },
                },
              ],
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
        expect(prisma.tag.findMany).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'another search',
        buildAudience('tags', {
          where: {
            status: { in: [TagStatus.APPROVED] },
            OR: [
              { name: { startsWith: 'fan', mode: 'insensitive' } },
            ],
          },
        }),
      ],
      [
        'other statuses',
        buildAudience('tags', {
          where: { status: { in: [TagStatus.PENDING] } },
        }),
      ],
    ])(
      'should refuse a cursor issued for %s',
      async (_case, audience) => {
        const result = uut.findConnection(false, {
          first: 5,
          after: toCursor(mystery.id, audience),
        });

        await expect(result).rejects.toThrow('Invalid cursor');
        expect(prisma.tag.findMany).not.toHaveBeenCalled();
      },
    );

    it('should match the start of the name or of one of its words, case-insensitively', async () => {
      await uut.findConnection(
        false,
        { first: 10 },
        { search: 'FAN' },
      );

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: [TagStatus.APPROVED] },
            OR: [
              { name: { startsWith: 'FAN', mode: 'insensitive' } },
              { name: { contains: ' FAN', mode: 'insensitive' } },
              { name: { contains: '-FAN', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it.each([
      {
        role: 'an admin',
        isAdmin: true,
        asked: [TagStatus.PENDING],
        expected: [TagStatus.PENDING],
      },
      {
        role: 'an admin',
        isAdmin: true,
        asked: [TagStatus.APPROVED, TagStatus.PENDING],
        expected: [TagStatus.APPROVED, TagStatus.PENDING],
      },
      {
        role: 'an admin',
        isAdmin: true,
        asked: [],
        expected: [TagStatus.APPROVED],
      },
      {
        role: 'a non-admin',
        isAdmin: false,
        asked: [TagStatus.PENDING],
        expected: [TagStatus.APPROVED],
      },
      {
        role: 'a non-admin',
        isAdmin: false,
        asked: [TagStatus.APPROVED, TagStatus.PENDING],
        expected: [TagStatus.APPROVED],
      },
    ])(
      'should filter $asked as $expected for $role',
      async ({ isAdmin, asked, expected }) => {
        await uut.findConnection(
          isAdmin,
          { first: 10 },
          { statuses: asked },
        );

        expect(prisma.tag.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { status: { in: expected } },
          }),
        );
      },
    );

    it('should default an admin to APPROVED', async () => {
      await uut.findConnection(true, { first: 10 });

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: [TagStatus.APPROVED] } },
        }),
      );
    });
  });

  describe('create', () => {
    it('should store the tag as APPROVED without a requester', async () => {
      const approved = {
        id: fantasy.id,
        name: 'Slice Of Life',
        status: TagStatus.APPROVED,
      };
      prisma.tag.createMany.mockResolvedValue({ count: 1 });
      prisma.tag.findUniqueOrThrow.mockResolvedValue(approved);

      const result = await uut.create({
        name: 'Slice Of Life',
        description: 'Quiet, everyday stories.',
      });

      expect(prisma.tag.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'Slice Of Life',
            description: 'Quiet, everyday stories.',
            status: TagStatus.APPROVED,
          },
        ],
        skipDuplicates: true,
      });
      expect(result).toBe(approved);
    });

    it('should reject a name that exists, naming it', async () => {
      prisma.tag.createMany.mockResolvedValue({ count: 0 });

      const result = uut.create({
        name: 'fantasy',
        description: 'Magic and quests.',
      });

      await expect(result).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('"fantasy"'),
        }),
      );
    });
  });

  describe('request', () => {
    const requesterUserId = '300311094522198754';

    it('should store the tag as PENDING for the requester', async () => {
      const pending = {
        id: fantasy.id,
        name: 'slice of life',
        status: TagStatus.PENDING,
      };
      prisma.tag.createMany.mockResolvedValue({ count: 1 });
      prisma.tag.findUniqueOrThrow.mockResolvedValue(pending);

      const result = await uut.request(requesterUserId, {
        name: 'slice of life',
        description: 'Quiet, everyday stories.',
      });

      expect(prisma.tag.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'slice of life',
            description: 'Quiet, everyday stories.',
            status: TagStatus.PENDING,
            requesterUserId,
          },
        ],
        skipDuplicates: true,
      });
      expect(result).toBe(pending);
    });

    it('should reject a name that exists, naming it', async () => {
      prisma.tag.createMany.mockResolvedValue({ count: 0 });

      const result = uut.request(requesterUserId, {
        name: 'fantasy',
        description: 'Magic and quests.',
      });

      await expect(result).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('"fantasy"'),
        }),
      );
      expect(prisma.tag.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should turn a pending tag into an approved one', async () => {
      prisma.tag.findUnique.mockResolvedValue(fantasy);

      const result = await uut.approve(fantasy.id);

      expect(prisma.tag.updateMany).toHaveBeenCalledWith({
        where: { id: fantasy.id, status: TagStatus.PENDING },
        data: { status: TagStatus.APPROVED },
      });
      expect(result).toBe(fantasy);
    });

    it('should answer 404 when the tag does not exist', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      const result = uut.approve(fantasy.id);

      await expect(result).rejects.toThrow('Tag not found');
    });
  });

  describe('update', () => {
    const select = {
      id: true,
      name: true,
      description: true,
      status: true,
      requesterUserId: true,
    };
    const knownError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('boom', {
        code,
        clientVersion: 'test',
      });

    it.each([
      {
        scenario: 'a name',
        changes: { name: 'high fantasy' },
      },
      {
        scenario: 'a description',
        changes: { description: 'Worlds with magic.' },
      },
      {
        scenario: 'both',
        changes: { name: 'epic', description: 'Grand stories.' },
      },
    ])('should store $scenario', async ({ changes }) => {
      const updated = { ...fantasy, ...changes };
      prisma.tag.update.mockResolvedValue(updated);

      const result = await uut.update(fantasy.id, changes);

      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: fantasy.id },
        data: changes,
        select,
      });
      expect(result).toBe(updated);
    });

    it('should reject nothing to change', async () => {
      const result = uut.update(fantasy.id, {});

      await expect(result).rejects.toThrow(
        'Provide a name, a description or both',
      );
      expect(prisma.tag.update).not.toHaveBeenCalled();
    });

    it('should reject a name another tag has, naming it', async () => {
      prisma.tag.update.mockRejectedValue(knownError('P2002'));

      const result = uut.update(fantasy.id, { name: 'mystery' });

      await expect(result).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining('"mystery"'),
        }),
      );
    });

    it('should answer 404 when the tag does not exist', async () => {
      prisma.tag.update.mockRejectedValue(knownError('P2025'));

      const result = uut.update(fantasy.id, { name: 'epic' });

      await expect(result).rejects.toThrow('Tag not found');
    });

    it('should let an unknown error through', async () => {
      prisma.tag.update.mockRejectedValue(new Error('db down'));

      const result = uut.update(fantasy.id, { name: 'epic' });

      await expect(result).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('should delete the tag and return its id', async () => {
      prisma.tag.delete.mockResolvedValue(fantasy);

      const result = await uut.delete(fantasy.id);

      expect(prisma.tag.delete).toHaveBeenCalledWith({
        where: { id: fantasy.id },
      });
      expect(result).toEqual({ id: fantasy.id });
    });

    it('should answer 404 when the tag does not exist', async () => {
      prisma.tag.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('boom', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      const result = uut.delete(fantasy.id);

      await expect(result).rejects.toThrow('Tag not found');
    });
  });

  describe('estimateNovelCounts', () => {
    const plan = (rows: number) => [
      { 'QUERY PLAN': [{ Plan: { 'Plan Rows': rows } }] },
    ];

    it('should read the row estimate of the plan, one EXPLAIN per tag', async () => {
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

    it('should answer 0 for the tag whose EXPLAIN failed and keep the others', async () => {
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
