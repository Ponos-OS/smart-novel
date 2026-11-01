import {
  Args,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';

import { ParseUuidPipe, RequiredStringPipe } from '../../shared';
import { CurrentUser, type IAuthUser, RequireRole } from '../auth';
import { RequireAcceptedTerms } from '../platform-terms';
import { WriterFiltersInput } from './inputs';
import { Writer, WriterConnection } from './types';
import { WriterService } from './writer.service';

@Resolver()
export class WriterResolver {
  constructor(private readonly writerService: WriterService) {}

  @RequireRole(Role.user)
  @Mutation(() => Writer, {
    description:
      'Ask to become a writer, with the pen name the writer will be known by. A 400 when the caller is already a writer or admin, already has a pending request, sends an empty or too long note, or a pen name that is not 3 to 50 English letters, hyphens and underscores. A 409 with the code `PEN_NAME_TAKEN` when another writer has the pen name, in any case. A rejected user may ask again and keeps a history of their applications.',
  })
  async requestWriterAccess(
    @Args('note', { type: () => String }, RequiredStringPipe)
    note: string,
    @Args('penName', { type: () => String }, RequiredStringPipe)
    penName: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<Writer> {
    return this.writerService.request(user, note, penName);
  }

  @RequireRole(Role.user)
  @Query(() => Writer, {
    nullable: true,
    description:
      "The caller's writer record (their latest request), or null",
  })
  async myWriter(
    @CurrentUser() user: IAuthUser,
  ): Promise<Writer | null> {
    return this.writerService.findByUserId(user.sub);
  }

  @RequireRole(Role.admin)
  @Query(() => WriterConnection, {
    description:
      'Admin only. Writer requests, oldest first, PENDING unless `filters.status` says otherwise, narrowed by `filters.search` (the pen name contains it). Without `first` or `last` a page of 20 is returned, at most 100 are allowed.',
  })
  async writersConnection(
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => WriterFiltersInput,
      nullable: true,
    })
    filters?: WriterFiltersInput,
  ): Promise<WriterConnection> {
    return this.writerService.findConnection(
      { first, last, after, before },
      filters,
    );
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Writer, {
    description:
      'Admin only. Grant the writer role to the requester in ZITADEL, then mark the request APPROVED. A 400 when it was already reviewed, a 404 when it does not exist. When ZITADEL fails the request stays PENDING and the mutation fails, so it can be retried. The user gets the role in their token after signing in again.',
  })
  async approveWriter(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the writer request' },
      ParseUuidPipe,
    )
    id: string,
    @CurrentUser() admin: IAuthUser,
  ): Promise<Writer> {
    return this.writerService.approve(id, admin.sub);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Writer, {
    description:
      'Admin only. Mark a pending request REJECTED, with a reason the requester sees. A 400 when it was already reviewed, a 404 when it does not exist. The user may file a new request afterwards.',
  })
  async rejectWriter(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the writer request' },
      ParseUuidPipe,
    )
    id: string,
    @CurrentUser() admin: IAuthUser,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string,
  ): Promise<Writer> {
    return this.writerService.reject(id, admin.sub, reason);
  }
}
