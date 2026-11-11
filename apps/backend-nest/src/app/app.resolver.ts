import { Query, Resolver } from '@nestjs/graphql';
import { CustomLoggerService } from 'nestjs-backend-common';

import { Public } from '../modules/auth';

@Resolver()
export class AppResolver {
  constructor(private readonly logger: CustomLoggerService) {}

  @Public()
  @Query(() => String, { description: 'Health check endpoint' })
  health(): string {
    this.logger.verbose('Health check requested', {
      context: AppResolver.name,
    });

    return 'OK';
  }
}
