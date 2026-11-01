import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WriterStatus } from '@prisma/client';
import {
  getPenNameProblem,
  hasMinimumRole,
  PEN_NAME_PROBLEM_MESSAGES,
  PEN_NAME_TAKEN,
  Role,
  WRITER_NOTE_MAX_LENGTH,
} from '@smart-novel/shared';
import { GraphQLError } from 'graphql';
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
import { PrismaService, PrismaTransactionClient } from '../prisma';
import {
  WRITERS_PAGE_SIZE_DEFAULT,
  WRITERS_PAGE_SIZE_MAX,
} from './constants';
import { WriterFiltersInput } from './inputs';
import { Writer, WriterConnection } from './types';
import {
  parseApplications,
  StoredWriterApplication,
} from './writer-application';

const WRITER_SELECT = {
  id: true,
  userId: true,
  name: true,
  email: true,
  penName: true,
  status: true,
  applications: true,
  createdAt: true,
} satisfies Prisma.WriterSelect;

type WriterRow = Prisma.WriterGetPayload<{
  select: typeof WRITER_SELECT;
}>;

function toJson(
  applications: StoredWriterApplication[],
): Prisma.InputJsonValue {
  return applications as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class WriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zitadelManagementClient: ZitadelManagementClient,
    private readonly cursorCodec: CursorCodec,
  ) {}

  /**
   * @description
   * A user has one row for life: the first request creates it, and a rejected user who asks again gets a new entry in the history and the status back to PENDING. The pen name is checked here, with no separate availability query, and the unique index settles two requests that race for it.
   */
  async request(
    user: IAuthUser,
    note: string,
    penName: string,
  ): Promise<Writer> {
    if (hasMinimumRole(user.roles, Role.writer)) {
      throw new BadRequestException('You already have writer access');
    }
    if (note.length > WRITER_NOTE_MAX_LENGTH) {
      throw new BadRequestException(
        `The note can have at most ${WRITER_NOTE_MAX_LENGTH} characters`,
      );
    }

    const penNameProblem = getPenNameProblem(penName);

    if (penNameProblem) {
      throw new BadRequestException(
        PEN_NAME_PROBLEM_MESSAGES[penNameProblem],
      );
    }

    if (await this.isPenNameTakenByAnother(penName, user.sub)) {
      throw this.toPenNameTaken();
    }

    const [error, row] = await retryAsync(
      () =>
        this.prisma.$transaction((tx) =>
          this.apply(tx, user, note, penName),
        ),
      { retry: 0 },
    );

    if (error) {
      throw await this.toKnownError(error, user.sub, penName);
    }

    return this.toWriter(row);
  }

  async findByUserId(userId: string): Promise<Writer | null> {
    const row = await this.prisma.writer.findUnique({
      where: { userId },
      select: WRITER_SELECT,
    });

    return row && this.toWriter(row);
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
        penName: { contains: search, mode: 'insensitive' },
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
      toNode: (row) => this.toWriter(row),
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

    return this.review(id, adminId, {
      status: WriterStatus.APPROVED,
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

    return this.review(id, adminId, {
      status: WriterStatus.REJECTED,
      rejectionReason,
    });
  }

  private async apply(
    tx: PrismaTransactionClient,
    user: IAuthUser,
    note: string,
    penName: string,
  ): Promise<WriterRow> {
    await tx.$queryRaw`SELECT id FROM writers WHERE user_id = ${user.sub} FOR UPDATE`;

    const existing = await tx.writer.findUnique({
      where: { userId: user.sub },
      select: WRITER_SELECT,
    });
    const application: StoredWriterApplication = {
      note,
      appliedAt: new Date().toISOString(),
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    };
    const identity = {
      name: user.name || user.preferredUsername,
      email: user.email,
      penName,
    };

    if (!existing) {
      return tx.writer.create({
        data: {
          userId: user.sub,
          ...identity,
          applications: toJson([application]),
        },
        select: WRITER_SELECT,
      });
    }
    if (existing.status === WriterStatus.PENDING) {
      throw this.toAlreadyPending();
    }
    if (existing.status === WriterStatus.APPROVED) {
      throw new BadRequestException('You already have writer access');
    }

    return tx.writer.update({
      where: { id: existing.id },
      data: {
        ...identity,
        status: WriterStatus.PENDING,
        createdAt: new Date(),
        applications: toJson([
          ...parseApplications(existing.applications),
          application,
        ]),
      },
      select: WRITER_SELECT,
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
   * @description The row is locked and its status read again, so two admins reviewing the same request at once end with one winner and one 400. Filling in the review fields of the last entry is the only time an entry of the history changes.
   */
  private async review(
    id: string,
    adminId: string,
    outcome: {
      status: WriterStatus;
      rejectionReason?: string | null;
    },
  ): Promise<Writer> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM writers WHERE id = ${id}::uuid FOR UPDATE`;

      const writer = await tx.writer.findUnique({
        where: { id },
        select: WRITER_SELECT,
      });

      if (!writer) {
        throw new NotFoundException('Writer request not found');
      }
      if (writer.status !== WriterStatus.PENDING) {
        throw this.toAlreadyReviewed();
      }

      const applications = parseApplications(writer.applications);
      const latest = applications.at(-1);

      if (!latest) {
        throw new Error(
          `Writer ${id} is pending without an application`,
        );
      }

      return tx.writer.update({
        where: { id },
        data: {
          status: outcome.status,
          applications: toJson([
            ...applications.slice(0, -1),
            {
              ...latest,
              rejectionReason: outcome.rejectionReason ?? null,
              reviewedBy: adminId,
              reviewedAt: new Date().toISOString(),
            },
          ]),
        },
        select: WRITER_SELECT,
      });
    });

    return this.toWriter(row);
  }

  private toWriter(row: WriterRow): Writer {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      penName: row.penName,
      status: row.status,
      createdAt: row.createdAt,
      applications: parseApplications(row.applications).map(
        (application) => ({
          note: application.note,
          appliedAt: new Date(application.appliedAt),
          rejectionReason: application.rejectionReason,
          reviewedAt: application.reviewedAt
            ? new Date(application.reviewedAt)
            : null,
        }),
      ),
    };
  }

  /**
   * @description `pen_name` is `citext`, so the lookup and the unique index both ignore case.
   */
  private async isPenNameTakenByAnother(
    penName: string,
    userId: string,
  ): Promise<boolean> {
    const owner = await this.prisma.writer.findUnique({
      where: { penName },
      select: { userId: true },
    });

    return owner !== null && owner.userId !== userId;
  }

  private toAlreadyReviewed(): BadRequestException {
    return new BadRequestException(
      'This writer request was already reviewed',
    );
  }

  private toAlreadyPending(): BadRequestException {
    return new BadRequestException(
      'You already have a pending writer request',
    );
  }

  private toPenNameTaken(): GraphQLError {
    return new GraphQLError(
      'That pen name is already taken, please choose another one',
      {
        extensions: {
          code: PEN_NAME_TAKEN,
          status: HttpStatus.CONFLICT,
        },
      },
    );
  }

  /**
   * @description A unique violation is either the pen name another request just took or this user's own pending row; asking again tells them apart without relying on the driver's error details.
   */
  private async toKnownError(
    error: unknown,
    userId: string,
    penName: string,
  ): Promise<unknown> {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return error;
    }

    return (await this.isPenNameTakenByAnother(penName, userId))
      ? this.toPenNameTaken()
      : this.toAlreadyPending();
  }
}
