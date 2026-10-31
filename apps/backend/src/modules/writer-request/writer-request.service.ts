import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WriterRequestStatus } from '@prisma/client';
import {
  hasMinimumRole,
  Role,
  WRITER_REQUEST_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';
import { retryAsync } from 'nestjs-backend-common';

import {
  boundPagination,
  paginateConnection,
  PaginationArgs,
} from '../../shared';
import { type IAuthUser, ZitadelManagementClient } from '../auth';
import { PrismaService } from '../prisma';
import {
  WRITER_REQUESTS_PAGE_SIZE_DEFAULT,
  WRITER_REQUESTS_PAGE_SIZE_MAX,
} from './constants';
import { WriterRequestFiltersInput } from './inputs';
import { WriterRequest, WriterRequestConnection } from './types';

const WRITER_REQUEST_SELECT = {
  id: true,
  requesterName: true,
  requesterEmail: true,
  note: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  reviewedAt: true,
} satisfies Prisma.WriterRequestSelect;

@Injectable()
export class WriterRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zitadelManagementClient: ZitadelManagementClient,
  ) {}

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

  async findConnection(
    pagination: PaginationArgs,
    filters?: WriterRequestFiltersInput,
  ): Promise<WriterRequestConnection> {
    const page = boundPagination(pagination, {
      defaultSize: WRITER_REQUESTS_PAGE_SIZE_DEFAULT,
      maxSize: WRITER_REQUESTS_PAGE_SIZE_MAX,
    });
    const where: Prisma.WriterRequestWhereInput = {
      status: filters?.status ?? WriterRequestStatus.PENDING,
    };
    const { edges, pageInfo } = await paginateConnection({
      pagination: page,
      findMany: ({ cursor, skip, take, shouldReverse }) => {
        const direction = shouldReverse ? 'desc' : 'asc';

        return this.prisma.writerRequest.findMany({
          where,
          orderBy: [{ createdAt: direction }, { id: direction }],
          select: WRITER_REQUEST_SELECT,
          cursor,
          skip,
          take,
        });
      },
      toNode: (row) => row,
    });

    return Object.assign(new WriterRequestConnection(), {
      edges,
      pageInfo,
    });
  }

  /**
   * @description ZITADEL is called first and the status changed second, so a ZITADEL failure leaves the request PENDING for a retry. Setting the grant is idempotent, so a failed database write is safe to retry too.
   */
  async approve(id: string, adminId: string): Promise<WriterRequest> {
    const { userId } = await this.findPending(id);

    await this.zitadelManagementClient.setUserProjectRole(
      userId,
      Role.writer,
    );

    return this.review(id, {
      status: WriterRequestStatus.APPROVED,
      reviewedBy: adminId,
    });
  }

  async reject(
    id: string,
    adminId: string,
    reason?: string,
  ): Promise<WriterRequest> {
    const rejectionReason = reason?.trim() || null;

    if (
      rejectionReason &&
      rejectionReason.length > WRITER_REQUEST_NOTE_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `The reason can have at most ${WRITER_REQUEST_NOTE_MAX_LENGTH} characters`,
      );
    }

    await this.findPending(id);

    return this.review(id, {
      status: WriterRequestStatus.REJECTED,
      rejectionReason,
      reviewedBy: adminId,
    });
  }

  private async findPending(id: string): Promise<{ userId: string }> {
    const writerRequest = await this.prisma.writerRequest.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!writerRequest) {
      throw new NotFoundException('Writer request not found');
    }
    if (writerRequest.status !== WriterRequestStatus.PENDING) {
      throw this.toAlreadyReviewed();
    }

    return writerRequest;
  }

  /**
   * @description The status in the filter makes two admins reviewing the same request at once end with one winner and one 400.
   */
  private async review(
    id: string,
    data: Prisma.WriterRequestUpdateManyMutationInput,
  ): Promise<WriterRequest> {
    const { count } = await this.prisma.writerRequest.updateMany({
      where: { id, status: WriterRequestStatus.PENDING },
      data: { ...data, reviewedAt: new Date() },
    });

    if (count === 0) {
      throw this.toAlreadyReviewed();
    }

    return this.prisma.writerRequest.findUniqueOrThrow({
      where: { id },
      select: WRITER_REQUEST_SELECT,
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
