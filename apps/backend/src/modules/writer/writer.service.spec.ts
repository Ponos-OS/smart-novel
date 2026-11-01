import type { ConfigType } from '@nestjs/config';

import { NotFoundException } from '@nestjs/common';
import { Prisma, WriterStatus } from '@prisma/client';
import {
  PEN_NAME_TAKEN,
  Role,
  WRITER_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';

import { appConfigs } from '../../app/configs/app.config';
import { buildAudience } from '../../shared';
import { type IAuthUser, ZitadelManagementClient } from '../auth';
import { CursorCodec } from '../cursor';
import { PrismaService } from '../prisma';
import { StoredWriterApplication } from './writer-application';
import { WriterService } from './writer.service';

const userId = '364554362883670018';
const note = 'I have been writing serialized fantasy for six years.';
const penName = 'Mina_Ardalan';
const requestId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
const adminId = '364554362732740610';
const appliedAt = '2026-10-31T09:00:00.000Z';
const application: StoredWriterApplication = {
  note,
  appliedAt,
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
};
const pendingRow = {
  id: requestId,
  userId,
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
  penName,
  status: WriterStatus.PENDING,
  applications: [application],
  createdAt: new Date('2026-10-31T09:00:00.000Z'),
};
const pendingWriter = {
  id: requestId,
  userId,
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
  penName,
  status: WriterStatus.PENDING,
  createdAt: new Date('2026-10-31T09:00:00.000Z'),
  applications: [
    {
      note,
      appliedAt: new Date(appliedAt),
      rejectionReason: null,
      reviewedAt: null,
    },
  ],
};

const buildUser = (roles: Role[]): IAuthUser => ({
  sub: userId,
  name: 'Mina Ardalan',
  givenName: 'Mina',
  familyName: 'Ardalan',
  preferredUsername: 'mina.ardalan',
  email: 'mina.ardalan@example.com',
  emailVerified: true,
  roles,
  metadata: {},
});

const cursorCodec = new CursorCodec({
  CURSOR_SIGNING_SECRET: 'b7e1f0c2a94d4c1f8d3e6a5b09c27f41',
} as ConfigType<typeof appConfigs>);

describe(WriterService.name, () => {
  let uut: WriterService;
  let prisma: {
    writer: Record<
      'findUnique' | 'findMany',
      ReturnType<typeof vi.fn>
    >;
    $transaction: ReturnType<typeof vi.fn>;
  };
  let tx: {
    $queryRaw: ReturnType<typeof vi.fn>;
    writer: Record<
      'findUnique' | 'create' | 'update',
      ReturnType<typeof vi.fn>
    >;
  };
  let zitadelManagementClient: {
    setUserProjectRole: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tx = {
      $queryRaw: vi.fn(),
      writer: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    prisma = {
      writer: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    zitadelManagementClient = { setUserProjectRole: vi.fn() };
    uut = new WriterService(
      prisma as unknown as PrismaService,
      zitadelManagementClient as unknown as ZitadelManagementClient,
      cursorCodec,
    );
  });

  describe('request', () => {
    beforeEach(() => {
      tx.writer.findUnique.mockResolvedValue(null);
      tx.writer.create.mockResolvedValue(pendingRow);
    });

    it('should store the caller, their name and email, the pen name as typed, and the first application', async () => {
      const result = await uut.request(
        buildUser([Role.user]),
        note,
        penName,
      );

      expect(result).toStrictEqual(pendingWriter);
      expect(tx.writer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId,
            name: 'Mina Ardalan',
            email: 'mina.ardalan@example.com',
            penName,
            applications: [
              {
                note,
                appliedAt: expect.any(String),
                rejectionReason: null,
                reviewedBy: null,
                reviewedAt: null,
              },
            ],
          },
        }),
      );
    });

    it('should fall back to the username when the token has no name', async () => {
      await uut.request(
        { ...buildUser([Role.user]), name: '' },
        note,
        penName,
      );

      expect(tx.writer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'mina.ardalan' }),
        }),
      );
    });

    it.each([[Role.writer], [Role.admin]])(
      'should refuse a caller whose highest role is %s',
      async (role) => {
        const result = uut.request(buildUser([role]), note, penName);

        await expect(result).rejects.toThrow(
          'You already have writer access',
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('should refuse a note over the limit', async () => {
      const result = uut.request(
        buildUser([Role.user]),
        'a'.repeat(WRITER_NOTE_MAX_LENGTH + 1),
        penName,
      );

      await expect(result).rejects.toThrow(
        `at most ${WRITER_NOTE_MAX_LENGTH} characters`,
      );
    });

    it.each([
      { penName: 'ab', message: 'at least 3 characters' },
      { penName: 'a'.repeat(51), message: 'at most 50 characters' },
      { penName: 'Mina2', message: 'English letters' },
      { penName: 'Mina Ardalan', message: 'English letters' },
      { penName: 'Мина_Ардалан', message: 'English letters' },
    ])(
      'should refuse the pen name "$penName" before touching the database',
      async ({ penName: invalid, message }) => {
        const result = uut.request(
          buildUser([Role.user]),
          note,
          invalid,
        );

        await expect(result).rejects.toThrow(message);
        expect(prisma.writer.findUnique).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('should answer PEN_NAME_TAKEN, whatever the case, when another writer has the pen name', async () => {
      prisma.writer.findUnique.mockResolvedValue({
        userId: '364554362732740610',
      });

      const result = uut.request(
        buildUser([Role.user]),
        note,
        'MINA_ARDALAN',
      );

      await expect(result).rejects.toMatchObject({
        extensions: { code: PEN_NAME_TAKEN, status: 409 },
      });
      expect(prisma.writer.findUnique).toHaveBeenCalledWith({
        where: { penName: 'MINA_ARDALAN' },
        select: { userId: true },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should not treat the caller's own pen name as taken", async () => {
      prisma.writer.findUnique.mockResolvedValue({ userId });

      const result = await uut.request(
        buildUser([Role.user]),
        note,
        penName,
      );

      expect(result).toStrictEqual(pendingWriter);
    });

    it('should lock the row of the caller before reading it', async () => {
      await uut.request(buildUser([Role.user]), note, penName);

      expect(tx.$queryRaw).toHaveBeenCalledOnce();
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.writer.findUnique.mock.invocationCallOrder[0],
      );
    });

    it.each([
      {
        status: WriterStatus.PENDING,
        message: 'You already have a pending writer request',
      },
      {
        status: WriterStatus.APPROVED,
        message: 'You already have writer access',
      },
    ])(
      'should refuse a user whose row is $status',
      async ({ status, message }) => {
        tx.writer.findUnique.mockResolvedValue({
          ...pendingRow,
          status,
        });

        const result = uut.request(
          buildUser([Role.user]),
          note,
          penName,
        );

        await expect(result).rejects.toThrow(message);
        expect(tx.writer.update).not.toHaveBeenCalled();
      },
    );

    it('should append a new application to the row of a rejected user and put it back to PENDING', async () => {
      const rejected: StoredWriterApplication = {
        ...application,
        rejectionReason: 'Please add writing samples',
        reviewedBy: adminId,
        reviewedAt: '2026-11-01T10:30:00.000Z',
      };
      tx.writer.findUnique.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.REJECTED,
        applications: [rejected],
      });
      tx.writer.update.mockResolvedValue({
        ...pendingRow,
        applications: [
          rejected,
          { ...application, note: 'Here are my samples.' },
        ],
      });

      const result = await uut.request(
        buildUser([Role.user]),
        'Here are my samples.',
        'Mina_Two',
      );

      expect(tx.writer.create).not.toHaveBeenCalled();
      expect(tx.writer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requestId },
          data: expect.objectContaining({
            penName: 'Mina_Two',
            status: WriterStatus.PENDING,
            createdAt: expect.any(Date),
            applications: [
              rejected,
              {
                note: 'Here are my samples.',
                appliedAt: expect.any(String),
                rejectionReason: null,
                reviewedBy: null,
                reviewedAt: null,
              },
            ],
          }),
        }),
      );
      expect(
        result.applications.map(({ note }) => note),
      ).toStrictEqual([note, 'Here are my samples.']);
    });

    it('should refuse a row whose history is malformed instead of overwriting it', async () => {
      tx.writer.findUnique.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.REJECTED,
        applications: { note: 'not a list' },
      });

      const result = uut.request(
        buildUser([Role.user]),
        note,
        penName,
      );

      await expect(result).rejects.toThrow('malformed');
      expect(tx.writer.update).not.toHaveBeenCalled();
    });

    describe('when the unique index refuses the write', () => {
      const uniqueViolation = () =>
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint',
          {
            code: 'P2002',
            clientVersion: '7.0.0',
          },
        );

      it('should answer PEN_NAME_TAKEN when another writer took the pen name in the meantime', async () => {
        prisma.writer.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ userId: '364554362732740610' });
        prisma.$transaction.mockRejectedValue(uniqueViolation());

        const result = uut.request(
          buildUser([Role.user]),
          note,
          penName,
        );

        await expect(result).rejects.toMatchObject({
          extensions: { code: PEN_NAME_TAKEN },
        });
      });

      it('should answer that a request is already pending when the pen name is not what clashed', async () => {
        prisma.$transaction.mockRejectedValue(uniqueViolation());

        const result = uut.request(
          buildUser([Role.user]),
          note,
          penName,
        );

        await expect(result).rejects.toThrow(
          'You already have a pending writer request',
        );
      });
    });

    it('should let any other database error through', async () => {
      const error = new Error('connection lost');
      prisma.$transaction.mockRejectedValue(error);

      const result = uut.request(
        buildUser([Role.user]),
        note,
        penName,
      );

      await expect(result).rejects.toBe(error);
    });
  });

  describe('findByUserId', () => {
    it('should list every application, oldest first, with what was decided about each', async () => {
      prisma.writer.findUnique.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.REJECTED,
        applications: [
          { ...application, note: 'The first time.' },
          {
            ...application,
            rejectionReason: 'Please add writing samples',
            reviewedBy: adminId,
            reviewedAt: '2026-11-01T10:30:00.000Z',
          },
        ],
      });

      const result = await uut.findByUserId(userId);

      expect(prisma.writer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } }),
      );
      expect(result).toMatchObject({
        status: WriterStatus.REJECTED,
        applications: [
          {
            note: 'The first time.',
            appliedAt: new Date(appliedAt),
            rejectionReason: null,
            reviewedAt: null,
          },
          {
            note,
            appliedAt: new Date(appliedAt),
            rejectionReason: 'Please add writing samples',
            reviewedAt: new Date('2026-11-01T10:30:00.000Z'),
          },
        ],
      });
    });

    it('should give an empty list for a writer who never applied', async () => {
      prisma.writer.findUnique.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.APPROVED,
        applications: [],
      });

      const result = await uut.findByUserId(userId);

      expect(result?.applications).toStrictEqual([]);
    });

    it('should return null when the user has no row', async () => {
      const result = await uut.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('findConnection', () => {
    const second = {
      ...pendingRow,
      id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
    };

    it('should list pending writers oldest first, with a default page', async () => {
      prisma.writer.findMany.mockResolvedValue([pendingRow]);

      const result = await uut.findConnection({});

      expect(prisma.writer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: WriterStatus.PENDING },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 21,
        }),
      );
      expect(result.edges.map(({ node }) => node)).toStrictEqual([
        pendingWriter,
      ]);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should filter by the status asked for', async () => {
      await uut.findConnection(
        { first: 5 },
        { status: WriterStatus.REJECTED },
      );

      expect(prisma.writer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: WriterStatus.REJECTED },
        }),
      );
    });

    it('should match the pen name, case-insensitively, when asked to search', async () => {
      await uut.findConnection(
        { first: 5 },
        { status: WriterStatus.APPROVED, search: 'Mina' },
      );

      expect(prisma.writer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: WriterStatus.APPROVED,
            penName: { contains: 'Mina', mode: 'insensitive' },
          },
        }),
      );
    });

    it('should escape the LIKE wildcards of the search text', async () => {
      await uut.findConnection({ first: 5 }, { search: '100%_mina' });

      expect(prisma.writer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            penName: {
              contains: '100\\%\\_mina',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should ignore an empty search', async () => {
      await uut.findConnection({ first: 5 }, { search: '' });

      expect(prisma.writer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: WriterStatus.PENDING },
        }),
      );
    });

    it('should refuse a cursor issued for another search before querying', async () => {
      const after = cursorCodec.encode(
        buildAudience('writers', {
          where: { status: WriterStatus.PENDING },
        }),
        second.id,
      );

      const result = uut.findConnection(
        { first: 5, after },
        { search: 'mina' },
      );

      await expect(result).rejects.toThrow('Invalid cursor');
      expect(prisma.writer.findMany).not.toHaveBeenCalled();
    });

    it('should refuse a cursor issued for another status before querying', async () => {
      const after = cursorCodec.encode(
        buildAudience('writers', {
          where: { status: WriterStatus.APPROVED },
        }),
        second.id,
      );

      const result = uut.findConnection({ first: 5, after });

      await expect(result).rejects.toThrow('Invalid cursor');
      expect(prisma.writer.findMany).not.toHaveBeenCalled();
    });

    it('should flip the order and report more pages when paging backward', async () => {
      prisma.writer.findMany.mockResolvedValue([second, pendingRow]);

      const result = await uut.findConnection({ last: 1 });

      expect(prisma.writer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(result.edges.map(({ node }) => node.id)).toStrictEqual([
        second.id,
      ]);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should refuse a page over the cap', async () => {
      const result = uut.findConnection({ first: 101 });

      await expect(result).rejects.toThrow('at most 100');
    });
  });

  describe('approve', () => {
    beforeEach(() => {
      prisma.writer.findUnique.mockResolvedValue({
        userId,
        status: WriterStatus.PENDING,
      });
      tx.writer.findUnique.mockResolvedValue(pendingRow);
      tx.writer.update.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.APPROVED,
        applications: [
          {
            ...application,
            reviewedBy: adminId,
            reviewedAt: '2026-11-01T10:30:00.000Z',
          },
        ],
      });
    });

    it('should grant the writer role in ZITADEL before it marks the writer approved, and fill in the review of the last application', async () => {
      const result = await uut.approve(requestId, adminId);

      expect(
        zitadelManagementClient.setUserProjectRole,
      ).toHaveBeenCalledWith(userId, Role.writer);
      expect(
        zitadelManagementClient.setUserProjectRole.mock
          .invocationCallOrder[0],
      ).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
      expect(tx.$queryRaw).toHaveBeenCalledOnce();
      expect(tx.writer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requestId },
          data: {
            status: WriterStatus.APPROVED,
            applications: [
              {
                ...application,
                rejectionReason: null,
                reviewedBy: adminId,
                reviewedAt: expect.any(String),
              },
            ],
          },
        }),
      );
      expect(result.status).toBe(WriterStatus.APPROVED);
      expect(result.applications.at(-1)?.reviewedAt).toEqual(
        new Date('2026-11-01T10:30:00.000Z'),
      );
    });

    it('should leave the request pending when ZITADEL fails', async () => {
      zitadelManagementClient.setUserProjectRole.mockRejectedValue(
        new Error('ZITADEL management API request failed'),
      );

      const result = uut.approve(requestId, adminId);

      await expect(result).rejects.toThrow('ZITADEL');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should answer 404 for an unknown writer', async () => {
      prisma.writer.findUnique.mockResolvedValue(null);

      const result = uut.approve(requestId, adminId);

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      expect(
        zitadelManagementClient.setUserProjectRole,
      ).not.toHaveBeenCalled();
    });

    it.each([[WriterStatus.APPROVED], [WriterStatus.REJECTED]])(
      'should refuse a writer that is already %s without calling ZITADEL',
      async (status) => {
        prisma.writer.findUnique.mockResolvedValue({
          userId,
          status,
        });

        const result = uut.approve(requestId, adminId);

        await expect(result).rejects.toThrow('already reviewed');
        expect(
          zitadelManagementClient.setUserProjectRole,
        ).not.toHaveBeenCalled();
      },
    );

    it('should refuse when another admin reviewed it in the meantime', async () => {
      tx.writer.findUnique.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.REJECTED,
      });

      const result = uut.approve(requestId, adminId);

      await expect(result).rejects.toThrow('already reviewed');
      expect(tx.writer.update).not.toHaveBeenCalled();
    });

    it('should fail loudly for a pending writer without an application', async () => {
      tx.writer.findUnique.mockResolvedValue({
        ...pendingRow,
        applications: [],
      });

      const result = uut.approve(requestId, adminId);

      await expect(result).rejects.toThrow(
        'pending without an application',
      );
      expect(tx.writer.update).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    beforeEach(() => {
      prisma.writer.findUnique.mockResolvedValue({
        userId,
        status: WriterStatus.PENDING,
      });
      tx.writer.findUnique.mockResolvedValue(pendingRow);
      tx.writer.update.mockResolvedValue({
        ...pendingRow,
        status: WriterStatus.REJECTED,
      });
    });

    it.each([
      {
        scenario: 'the trimmed reason',
        reason: '  Please add writing samples ',
        stored: 'Please add writing samples',
      },
      { scenario: 'no reason', reason: undefined, stored: null },
      {
        scenario: 'a blank reason as none',
        reason: '   ',
        stored: null,
      },
    ])(
      'should store $scenario in the last application',
      async ({ reason, stored }) => {
        await uut.reject(requestId, adminId, reason);

        expect(tx.writer.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              status: WriterStatus.REJECTED,
              applications: [
                {
                  ...application,
                  rejectionReason: stored,
                  reviewedBy: adminId,
                  reviewedAt: expect.any(String),
                },
              ],
            },
          }),
        );
        expect(
          zitadelManagementClient.setUserProjectRole,
        ).not.toHaveBeenCalled();
      },
    );

    it('should refuse a reason over the limit without touching the writer', async () => {
      const result = uut.reject(
        requestId,
        adminId,
        'a'.repeat(WRITER_NOTE_MAX_LENGTH + 1),
      );

      await expect(result).rejects.toThrow(
        `at most ${WRITER_NOTE_MAX_LENGTH} characters`,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should refuse a writer that is already reviewed', async () => {
      prisma.writer.findUnique.mockResolvedValue({
        userId,
        status: WriterStatus.APPROVED,
      });

      const result = uut.reject(requestId, adminId);

      await expect(result).rejects.toThrow('already reviewed');
    });
  });
});
