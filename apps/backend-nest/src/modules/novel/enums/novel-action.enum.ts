import { registerEnumType } from '@nestjs/graphql';

export enum NovelAction {
  EDIT_CONTENT = 'EDIT_CONTENT',
  MANAGE_TTS = 'MANAGE_TTS',
}

registerEnumType(NovelAction, {
  name: 'NovelAction',
  description: 'Actions a user can perform on a novel',
});
