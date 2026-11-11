import { registerEnumType } from '@nestjs/graphql';

export enum ChapterOrderField {
  CHAPTER_NUMBER = 'CHAPTER_NUMBER',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
}

registerEnumType(ChapterOrderField, {
  name: 'ChapterOrderField',
  description: 'Fields by which chapters can be ordered',
});
