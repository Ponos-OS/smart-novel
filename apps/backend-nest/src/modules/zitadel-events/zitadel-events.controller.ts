import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@smart-novel/shared';

import { Public, ZitadelManagementClient } from '../auth';
import { ZitadelSignatureGuard } from './zitadel-signature.guard';

@Controller('zitadel-events')
export class ZitadelEventsController {
  constructor(
    private readonly managementClient: ZitadelManagementClient,
  ) {}

  /**
   * @description Called by ZITADEL on `user.human.added`; the event's `aggregateID` is the new user's ID. Everyone starts as a `user`; users that already hold a role (the seeded ones) are left alone.
   */
  @Public()
  @UseGuards(ZitadelSignatureGuard)
  @Post('user-added')
  @HttpCode(HttpStatus.NO_CONTENT)
  async userAdded(
    @Body('aggregateID') userId: string,
  ): Promise<void> {
    await this.managementClient.grantProjectRoleIfAbsent(
      userId,
      Role.user,
    );
  }
}
