import { Prisma, WriterRequestStatus } from '@prisma/client';
import {
  Role,
  WRITER_REQUEST_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';

import { type IAuthUser } from '../auth';
import { PrismaService } from '../prisma';
import { WriterRequestService } from './writer-request.service';

const userId = '364554362883670018';
const note = 'I have been writing serialized fantasy for six years.';
const pendingRequest = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
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
      'create' | 'findFirst',
      ReturnType<typeof vi.fn>
    >;
  };

  beforeEach(() => {
    prisma = {
      writerRequest: { create: vi.fn(), findFirst: vi.fn() },
    };
    uut = new WriterRequestService(
      prisma as unknown as PrismaService,
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
});
