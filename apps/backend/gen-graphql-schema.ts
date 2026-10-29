import { NestFactory } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { writeFileSync } from 'fs';
import { printSchema } from 'graphql';
import { join } from 'path';

import { AppResolver } from './src/app/app.resolver';
import { AuthResolver } from './src/modules/auth/auth.resolver';
import { LicenseResolver } from './src/modules/license/license.resolver';
import { LlmResolver } from './src/modules/llm/llm.resolver';
import {
  ChapterConnectionFieldResolver,
  ChapterFieldResolver,
  ChapterNarrationResolver,
  ChapterResolver,
  ChapterUserStateResolver,
  NovelConnectionFieldResolver,
  NovelResolver,
} from './src/modules/novel/resolvers';

async function generateSchema() {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, {
    logger: false,
  });
  await app.init();

  const gqlSchemaFactory = app.get(GraphQLSchemaFactory);
  const schema = await gqlSchemaFactory.create([
    AppResolver,
    AuthResolver,
    LicenseResolver,
    LlmResolver,
    NovelResolver,
    NovelConnectionFieldResolver,
    ChapterResolver,
    ChapterConnectionFieldResolver,
    ChapterFieldResolver,
    ChapterNarrationResolver,
    ChapterUserStateResolver,
  ]);

  const sdl = printSchema(schema);
  const outputPath = join(__dirname, 'schema.gql');

  writeFileSync(outputPath, sdl + '\n');
  console.log(`✅ GraphQL schema written to ${outputPath}`);

  await app.close();
}

generateSchema().catch((error) => {
  console.error('Failed to generate GraphQL schema:', error);
  process.exit(1);
});
