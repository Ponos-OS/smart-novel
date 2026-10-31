import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  hasMinimumRole,
  Role,
  WRITER_REQUEST_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';
import { retryAsync } from 'nestjs-backend-common';

import { type IAuthUser } from '../auth';
import { PrismaService } from '../prisma';
import { WriterRequest } from './types';

const WRITER_REQUEST_SELECT = {
  id: true,
  note: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  reviewedAt: true,
} satisfies Prisma.WriterRequestSelect;

@Injectable()
export class WriterRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async request(
    user: IAuthUser,
    note: string,
  ): Promise<WriterRequest> {
    if (hasMinimumRole(user.roles, Role.writer)) {
      throw new BadRequestException('You already have writer access');
    }
    if (note.length > WRITER_REQUEST_NOTE_MAX_LENGTH) {
      throw new BadRequestException(
        `The note can have at most ${WRITER_REQUEST_NOTE_MAX_LENGTH} characters`,
      );
    }

    const [error, writerRequest] = await retryAsync(
      () =>
        this.prisma.writerRequest.create({
          data: {
            userId: user.sub,
            requesterName: user.name || user.preferredUsername,
            requesterEmail: user.email,
            note,
          },
          select: WRITER_REQUEST_SELECT,
        }),
      { retry: 0 },
    );

    if (error) {
      throw this.toKnownError(error);
    }

    return writerRequest;
  }

  async findLatest(userId: string): Promise<WriterRequest | null> {
    return this.prisma.writerRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: WRITER_REQUEST_SELECT,
    });
  }

  private toKnownError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new BadRequestException(
        'You already have a pending writer request',
      );
    }

    return error;
  }
}
