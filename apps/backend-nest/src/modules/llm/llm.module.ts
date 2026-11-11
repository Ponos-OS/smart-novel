import { Global, Module } from '@nestjs/common';

import { LlmClient } from './llm.client';
import { LlmResolver } from './llm.resolver';
import { LlmService } from './llm.service';

@Global()
@Module({
  providers: [LlmResolver, LlmService, LlmClient],
  exports: [LlmService, LlmClient],
})
export class LlmModule {}
