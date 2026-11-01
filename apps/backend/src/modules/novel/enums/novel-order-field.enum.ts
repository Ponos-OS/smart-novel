import { registerEnumType } from '@nestjs/graphql';

export enum NovelOrderField {
  FIRST_CHAPTER_CREATED_AT = 'FIRST_CHAPTER_CREATED_AT',
  NAME = 'NAME',
}

registerEnumType(NovelOrderField, {
  name: 'NovelOrderField',
  description: 'What the list of novels can be ordered by',
});
