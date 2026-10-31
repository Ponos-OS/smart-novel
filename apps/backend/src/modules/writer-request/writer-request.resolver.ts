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
import { WriterRequestFiltersInput } from './inputs';
import { WriterRequest, WriterRequestConnection } from './types';
import { WriterRequestService } from './writer-request.service';

@Resolver()
export class WriterRequestResolver {
  constructor(
    private readonly writerRequestService: WriterRequestService,
  ) {}

  @RequireRole(Role.user)
  @Mutation(() => WriterRequest, {
    description:
      'Ask to become a writer. A 400 when the caller is already a writer or admin, already has a pending request, or sends an empty or too long note.',
  })
  async requestWriterAccess(
    @Args('note', { type: () => String }, RequiredStringPipe)
    note: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<WriterRequest> {
    return this.writerRequestService.request(user, note);
  }

  @RequireRole(Role.user)
  @Query(() => WriterRequest, {
    nullable: true,
    description: "The caller's latest writer request, or null",
  })
  async myWriterRequest(
    @CurrentUser() user: IAuthUser,
  ): Promise<WriterRequest | null> {
    return this.writerRequestService.findLatest(user.sub);
  }

  @RequireRole(Role.admin)
  @Query(() => WriterRequestConnection, {
    description:
      'Admin only. Writer requests, oldest first, PENDING unless `filters.status` says otherwise. Without `first` or `last` a page of 20 is returned, at most 100 are allowed.',
  })
  async writerRequestsConnection(
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => WriterRequestFiltersInput,
      nullable: true,
    })
    filters?: WriterRequestFiltersInput,
  ): Promise<WriterRequestConnection> {
    return this.writerRequestService.findConnection(
      { first, last, after, before },
      filters,
    );
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => WriterRequest, {
    description:
      'Admin only. Grant the writer role to the requester in ZITADEL, then mark the request APPROVED. A 400 when it was already reviewed, a 404 when it does not exist. When ZITADEL fails the request stays PENDING and the mutation fails, so it can be retried. The user gets the role in their token after signing in again.',
  })
  async approveWriterRequest(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the writer request' },
      ParseUuidPipe,
    )
    id: string,
    @CurrentUser() admin: IAuthUser,
  ): Promise<WriterRequest> {
    return this.writerRequestService.approve(id, admin.sub);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => WriterRequest, {
    description:
      'Admin only. Mark a pending request REJECTED, with a reason the requester sees. A 400 when it was already reviewed, a 404 when it does not exist. The user may file a new request afterwards.',
  })
  async rejectWriterRequest(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the writer request' },
      ParseUuidPipe,
    )
    id: string,
    @CurrentUser() admin: IAuthUser,
    @Args('reason', { type: () => String, nullable: true })
    reason?: string,
  ): Promise<WriterRequest> {
    return this.writerRequestService.reject(id, admin.sub, reason);
  }
}
