import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WriterStatus } from '@prisma/client';
import {
  hasMinimumRole,
  Role,
  WRITER_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';
import { retryAsync } from 'nestjs-backend-common';

import {
  boundPagination,
  buildAudience,
  escapeLikePattern,
  paginateConnection,
  PaginationArgs,
} from '../../shared';
import { type IAuthUser, ZitadelManagementClient } from '../auth';
import { CursorCodec } from '../cursor';
import { PrismaService } from '../prisma';
import {
  WRITERS_PAGE_SIZE_DEFAULT,
  WRITERS_PAGE_SIZE_MAX,
} from './constants';
import { WriterFiltersInput } from './inputs';
import { Writer, WriterConnection } from './types';

const WRITER_SELECT = {
  id: true,
  userId: true,
  name: true,
  email: true,
  note: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  reviewedAt: true,
} satisfies Prisma.WriterSelect;

@Injectable()
export class WriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zitadelManagementClient: ZitadelManagementClient,
    private readonly cursorCodec: CursorCodec,
  ) {}

  async request(user: IAuthUser, note: string): Promise<Writer> {
    if (hasMinimumRole(user.roles, Role.writer)) {
      throw new BadRequestException('You already have writer access');
    }
    if (note.length > WRITER_NOTE_MAX_LENGTH) {
      throw new BadRequestException(
        `The note can have at most ${WRITER_NOTE_MAX_LENGTH} characters`,
      );
    }

    const [error, writer] = await retryAsync(
      () =>
        this.prisma.writer.create({
          data: {
            userId: user.sub,
            name: user.name || user.preferredUsername,
            email: user.email,
            note,
          },
          select: WRITER_SELECT,
        }),
      { retry: 0 },
    );

    if (error) {
      throw this.toKnownError(error);
    }

    return writer;
  }

  async findLatest(userId: string): Promise<Writer | null> {
    return this.prisma.writer.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: WRITER_SELECT,
    });
  }

  async findConnection(
    pagination: PaginationArgs,
    filters?: WriterFiltersInput,
  ): Promise<WriterConnection> {
    const page = boundPagination(pagination, {
      defaultSize: WRITERS_PAGE_SIZE_DEFAULT,
      maxSize: WRITERS_PAGE_SIZE_MAX,
    });
    const search =
      filters?.search && escapeLikePattern(filters.search);
    const where: Prisma.WriterWhereInput = {
      status: filters?.status ?? WriterStatus.PENDING,
      ...(search && {
        OR: [
          {
            name: { contains: search, mode: 'insensitive' },
          },
          {
            email: { contains: search, mode: 'insensitive' },
          },
        ],
      }),
    };
    const { edges, pageInfo } = await paginateConnection({
      codec: this.cursorCodec,
      audience: buildAudience('writers', { where }),
      pagination: page,
      findMany: ({ cursor, skip, take, shouldReverse }) => {
        const direction = shouldReverse ? 'desc' : 'asc';

        return this.prisma.writer.findMany({
          where,
          orderBy: [{ createdAt: direction }, { id: direction }],
          select: WRITER_SELECT,
          cursor,
          skip,
          take,
        });
      },
      toNode: (row) => row,
    });

    return Object.assign(new WriterConnection(), {
      edges,
      pageInfo,
    });
  }

  /**
   * @description ZITADEL is called first and the status changed second, so a ZITADEL failure leaves the request PENDING for a retry. Setting the grant is idempotent, so a failed database write is safe to retry too.
   */
  async approve(id: string, adminId: string): Promise<Writer> {
    const { userId } = await this.findPending(id);

    await this.zitadelManagementClient.setUserProjectRole(
      userId,
      Role.writer,
    );

    return this.review(id, {
      status: WriterStatus.APPROVED,
      reviewedBy: adminId,
    });
  }

  async reject(
    id: string,
    adminId: string,
    reason?: string,
  ): Promise<Writer> {
    const rejectionReason = reason?.trim() || null;

    if (
      rejectionReason &&
      rejectionReason.length > WRITER_NOTE_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `The reason can have at most ${WRITER_NOTE_MAX_LENGTH} characters`,
      );
    }

    await this.findPending(id);

    return this.review(id, {
      status: WriterStatus.REJECTED,
      rejectionReason,
      reviewedBy: adminId,
    });
  }

  private async findPending(id: string): Promise<{ userId: string }> {
    const writer = await this.prisma.writer.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!writer) {
      throw new NotFoundException('Writer request not found');
    }
    if (writer.status !== WriterStatus.PENDING) {
      throw this.toAlreadyReviewed();
    }

    return writer;
  }

  /**
   * @description The status in the filter makes two admins reviewing the same request at once end with one winner and one 400.
   */
  private async review(
    id: string,
    data: Prisma.WriterUpdateManyMutationInput,
  ): Promise<Writer> {
    const { count } = await this.prisma.writer.updateMany({
      where: { id, status: WriterStatus.PENDING },
      data: { ...data, reviewedAt: new Date() },
    });

    if (count === 0) {
      throw this.toAlreadyReviewed();
    }

    return this.prisma.writer.findUniqueOrThrow({
      where: { id },
      select: WRITER_SELECT,
    });
  }

  private toAlreadyReviewed(): BadRequestException {
    return new BadRequestException(
      'This writer request was already reviewed',
    );
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
