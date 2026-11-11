import { UseGuards } from '@nestjs/common';

import { PlatformTermsGuard } from '../platform-terms.guard';

/**
 * @description For writer mutations. `PlatformTermsModule` is global, so no import is needed.
 */
export const RequireAcceptedTerms = () =>
  UseGuards(PlatformTermsGuard);
