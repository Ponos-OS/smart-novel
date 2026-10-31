import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';

import { RequiredStringPipe } from '../../shared';
import { CurrentUser, type IAuthUser, RequireRole } from '../auth';
import { WriterRequest } from './types';
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
}
