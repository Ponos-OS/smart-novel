import { NotFoundException } from '@nestjs/common';
import { Prisma, WriterRequestStatus } from '@prisma/client';
import {
  Role,
  WRITER_REQUEST_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';

import { type IAuthUser, ZitadelManagementClient } from '../auth';
import { PrismaService } from '../prisma';
import { WriterRequestService } from './writer-request.service';

const userId = '364554362883670018';
const note = 'I have been writing serialized fantasy for six years.';
const requestId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
const adminId = '364554362732740610';
const pendingRequest = {
  id: requestId,
  requesterName: 'Mina Ardalan',
  requesterEmail: 'mina.ardalan@example.com',
  note,
  status: WriterRequestStatus.PENDING,
  rejectionReason: null,
  createdAt: new Date('2026-10-31T09:00:00.000Z'),
  reviewedAt: null,
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

describe(WriterRequestService.name, () => {
  let uut: WriterRequestService;
  let prisma: {
    writerRequest: Record<
      | 'create'
      | 'findFirst'
      | 'findMany'
      | 'findUnique'
      | 'findUniqueOrThrow'
      | 'updateMany',
      ReturnType<typeof vi.fn>
    >;
  };
  let zitadelManagementClient: {
    setUserProjectRole: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      writerRequest: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    zitadelManagementClient = { setUserProjectRole: vi.fn() };
    uut = new WriterRequestService(
      prisma as unknown as PrismaService,
      zitadelManagementClient as unknown as ZitadelManagementClient,
    );
  });

  describe('request', () => {
    it('should store the caller, their name and email, and the note', async () => {
      prisma.writerRequest.create.mockResolvedValue(pendingRequest);

      const result = await uut.request(buildUser([Role.user]), note);

      expect(result).toStrictEqual(pendingRequest);
      expect(prisma.writerRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId,
            requesterName: 'Mina Ardalan',
            requesterEmail: 'mina.ardalan@example.com',
            note,
          },
        }),
      );
    });

    it('should fall back to the username when the token has no name', async () => {
      prisma.writerRequest.create.mockResolvedValue(pendingRequest);

      await uut.request(
        { ...buildUser([Role.user]), name: '' },
        note,
      );

      expect(prisma.writerRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requesterName: 'mina.ardalan',
          }),
        }),
      );
    });

    it.each([[Role.writer], [Role.admin]])(
      'should refuse a caller whose highest role is %s',
      async (role) => {
        const promise = uut.request(
          buildUser([Role.user, role]),
          note,
        );

        await expect(promise).rejects.toThrow(
          'You already have writer access',
        );
        expect(prisma.writerRequest.create).not.toHaveBeenCalled();
      },
    );

    it('should refuse a note over the limit', async () => {
      const promise = uut.request(
        buildUser([Role.user]),
        'a'.repeat(WRITER_REQUEST_NOTE_MAX_LENGTH + 1),
      );

      await expect(promise).rejects.toThrow(
        `at most ${WRITER_REQUEST_NOTE_MAX_LENGTH} characters`,
      );
      expect(prisma.writerRequest.create).not.toHaveBeenCalled();
    });

    it('should map the unique index violation to a 400', async () => {
      prisma.writerRequest.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint',
          {
            code: 'P2002',
            clientVersion: '7.7.0',
          },
        ),
      );

      const promise = uut.request(buildUser([Role.user]), note);

      await expect(promise).rejects.toThrow(
        'You already have a pending writer request',
      );
    });

    it('should let any other database error through', async () => {
      const error = new Error('connection lost');
      prisma.writerRequest.create.mockRejectedValue(error);

      const promise = uut.request(buildUser([Role.user]), note);

      await expect(promise).rejects.toBe(error);
    });
  });

  describe('findLatest', () => {
    it('should return the newest request of the user', async () => {
      prisma.writerRequest.findFirst.mockResolvedValue(
        pendingRequest,
      );

      const result = await uut.findLatest(userId);

      expect(result).toStrictEqual(pendingRequest);
      expect(prisma.writerRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return null when the user never asked', async () => {
      prisma.writerRequest.findFirst.mockResolvedValue(null);

      const result = await uut.findLatest(userId);

      expect(result).toBeNull();
    });
  });

  describe('findConnection', () => {
    const second = {
      ...pendingRequest,
      id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
    };

    it('should list pending requests oldest first, with a default page', async () => {
      prisma.writerRequest.findMany.mockResolvedValue([
        pendingRequest,
      ]);

      const result = await uut.findConnection({});

      expect(prisma.writerRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: WriterRequestStatus.PENDING },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 21,
        }),
      );
      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should filter by the status asked for', async () => {
      await uut.findConnection(
        { first: 5 },
        { status: WriterRequestStatus.REJECTED },
      );

      expect(prisma.writerRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: WriterRequestStatus.REJECTED },
        }),
      );
    });

    it('should flip the order and report more pages when paging backward', async () => {
      prisma.writerRequest.findMany.mockResolvedValue([
        second,
        pendingRequest,
      ]);

      const result = await uut.findConnection({ last: 1 });

      expect(prisma.writerRequest.findMany).toHaveBeenCalledWith(
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
      const promise = uut.findConnection({ first: 101 });

      await expect(promise).rejects.toThrow('at most 100');
    });
  });

  describe('approve', () => {
    beforeEach(() => {
      prisma.writerRequest.findUnique.mockResolvedValue({
        userId,
        status: WriterRequestStatus.PENDING,
      });
      prisma.writerRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.writerRequest.findUniqueOrThrow.mockResolvedValue({
        ...pendingRequest,
        status: WriterRequestStatus.APPROVED,
      });
    });

    it('should grant the writer role in ZITADEL before it marks the request approved', async () => {
      const result = await uut.approve(requestId, adminId);

      expect(result.status).toBe(WriterRequestStatus.APPROVED);
      expect(
        zitadelManagementClient.setUserProjectRole,
      ).toHaveBeenCalledWith(userId, Role.writer);
      expect(prisma.writerRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: WriterRequestStatus.PENDING },
        data: {
          status: WriterRequestStatus.APPROVED,
          reviewedBy: adminId,
          reviewedAt: expect.any(Date),
        },
      });
      expect(
        zitadelManagementClient.setUserProjectRole.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        prisma.writerRequest.updateMany.mock.invocationCallOrder[0],
      );
    });

    it('should leave the request pending when ZITADEL fails', async () => {
      zitadelManagementClient.setUserProjectRole.mockRejectedValue(
        new Error(
          'ZITADEL management API request failed with status 503',
        ),
      );

      const promise = uut.approve(requestId, adminId);

      await expect(promise).rejects.toThrow('status 503');
      expect(prisma.writerRequest.updateMany).not.toHaveBeenCalled();
    });

    it('should answer 404 for an unknown request', async () => {
      prisma.writerRequest.findUnique.mockResolvedValue(null);

      const promise = uut.approve(requestId, adminId);

      await expect(promise).rejects.toThrow(NotFoundException);
      expect(
        zitadelManagementClient.setUserProjectRole,
      ).not.toHaveBeenCalled();
    });

    it.each([
      [WriterRequestStatus.APPROVED],
      [WriterRequestStatus.REJECTED],
    ])(
      'should refuse a request that is already %s',
      async (status) => {
        prisma.writerRequest.findUnique.mockResolvedValue({
          userId,
          status,
        });

        const promise = uut.approve(requestId, adminId);

        await expect(promise).rejects.toThrow('already reviewed');
        expect(
          zitadelManagementClient.setUserProjectRole,
        ).not.toHaveBeenCalled();
      },
    );

    it('should refuse when another admin reviewed it in the meantime', async () => {
      prisma.writerRequest.updateMany.mockResolvedValue({ count: 0 });

      const promise = uut.approve(requestId, adminId);

      await expect(promise).rejects.toThrow('already reviewed');
    });
  });

  describe('reject', () => {
    beforeEach(() => {
      prisma.writerRequest.findUnique.mockResolvedValue({
        userId,
        status: WriterRequestStatus.PENDING,
      });
      prisma.writerRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.writerRequest.findUniqueOrThrow.mockResolvedValue({
        ...pendingRequest,
        status: WriterRequestStatus.REJECTED,
      });
    });

    it.each([
      [
        '  Please share a sample chapter.  ',
        'Please share a sample chapter.',
      ],
      ['   ', null],
      [undefined, null],
    ])('should store the reason %j as %j', async (reason, stored) => {
      await uut.reject(requestId, adminId, reason);

      expect(prisma.writerRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestId, status: WriterRequestStatus.PENDING },
        data: {
          status: WriterRequestStatus.REJECTED,
          rejectionReason: stored,
          reviewedBy: adminId,
          reviewedAt: expect.any(Date),
        },
      });
      expect(
        zitadelManagementClient.setUserProjectRole,
      ).not.toHaveBeenCalled();
    });

    it('should refuse a reason over the limit', async () => {
      const promise = uut.reject(
        requestId,
        adminId,
        'a'.repeat(WRITER_REQUEST_NOTE_MAX_LENGTH + 1),
      );

      await expect(promise).rejects.toThrow('at most');
      expect(prisma.writerRequest.updateMany).not.toHaveBeenCalled();
    });

    it('should answer 404 for an unknown request', async () => {
      prisma.writerRequest.findUnique.mockResolvedValue(null);

      const promise = uut.reject(requestId, adminId);

      await expect(promise).rejects.toThrow(NotFoundException);
    });

    it('should refuse a request that is already reviewed', async () => {
      prisma.writerRequest.findUnique.mockResolvedValue({
        userId,
        status: WriterRequestStatus.APPROVED,
      });

      const promise = uut.reject(requestId, adminId);

      await expect(promise).rejects.toThrow('already reviewed');
    });
  });
});
