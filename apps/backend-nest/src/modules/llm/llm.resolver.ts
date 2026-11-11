import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { RequiredStringPipe } from '../../shared';
import { Public } from '../auth';
import { LlmService } from './llm.service';
import { WordExplanation } from './types';

@Public()
@Resolver()
export class LlmResolver {
  constructor(private readonly llmService: LlmService) {}

  @Mutation(() => WordExplanation)
  async explain(
    @Args('word', RequiredStringPipe) word: string,
    @Args('context', RequiredStringPipe) context: string,
  ): Promise<WordExplanation> {
    return this.llmService.explainWord(word, context);
  }
}
