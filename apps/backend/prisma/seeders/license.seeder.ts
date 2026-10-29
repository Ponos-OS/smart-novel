import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { join } from 'path';

import {
  computeLicenseTextHash,
  normalizeLicenseText,
} from '../../src/modules/license/utils';

const DEFAULT_LICENSE = {
  name: 'CC BY 4.0',
  canonicalId: 'CC-BY-4.0',
} as const;

export interface SeededLicenses {
  byCanonicalId: Map<string, string>;
  defaultId: string;
}

export async function seedLicenses(
  prisma: PrismaClient,
): Promise<SeededLicenses> {
  console.log('\n📜 Seeding licenses...');

  const text = await readFile(
    join(__dirname, 'licenses', `${DEFAULT_LICENSE.canonicalId}.txt`),
    'utf-8',
  );
  const license = await prisma.license.upsert({
    where: {
      ownerId_textHash: {
        ownerId: 'system',
        textHash: computeLicenseTextHash(text),
      },
    },
    update: {},
    create: {
      name: DEFAULT_LICENSE.name,
      text: normalizeLicenseText(text),
      textHash: computeLicenseTextHash(text),
      sourceType: 'CANONICAL',
      canonicalId: DEFAULT_LICENSE.canonicalId,
      isDefault: true,
    },
  });

  console.log(`✅ Seeded license "${license.name}" as the default`);

  return {
    byCanonicalId: new Map([
      [DEFAULT_LICENSE.canonicalId, license.id],
    ]),
    defaultId: license.id,
  };
}
