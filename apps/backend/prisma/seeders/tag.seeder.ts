import { PrismaClient } from '@prisma/client';
import { isArray, isEmpty } from 'class-validator';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface NovelDetails {
  tags: string[];
}

export async function seedTags(
  prisma: PrismaClient,
  dataPath: string,
): Promise<Map<string, string>> {
  console.log('🔍 Scanning for tags...');

  const tagSet = new Set<string>();
  const novelDirs = await readdir(dataPath, { withFileTypes: true });

  for (const dir of novelDirs) {
    if (!dir.isDirectory()) {
      continue;
    }

    const detailsPath = join(dataPath, dir.name, 'details.json');

    try {
      const detailsContent = await readFile(detailsPath, 'utf-8');
      const details: NovelDetails = JSON.parse(detailsContent);

      if (isEmpty(details.tags) || !isArray(details.tags)) {
        continue;
      }

      for (const tag of details.tags) {
        tagSet.add(tag.toLowerCase());
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not read details.json for ${dir.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const uniqueTags = Array.from(tagSet);

  console.log(`📋 Found ${uniqueTags.length} unique tags.`);

  const tagMap = new Map<string, string>();

  if (uniqueTags.length === 0) {
    console.log('⏭️  No tags to seed');
    return tagMap;
  }

  try {
    await prisma.tag.createMany({
      data: uniqueTags.map((name) => ({ name })),
      skipDuplicates: true,
    });

    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    for (const tag of tags) {
      tagMap.set(tag.name, tag.id);
    }

    console.log(`✅ Seeded ${tags.length} tags successfully`);
  } catch (error) {
    console.error('❌ Error seeding tags:', error);
    throw error;
  }

  return tagMap;
}
