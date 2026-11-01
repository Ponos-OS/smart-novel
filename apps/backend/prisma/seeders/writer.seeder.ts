import { PrismaClient, WriterStatus } from '@prisma/client';
import { getPenNameProblem } from '@smart-novel/shared';

export interface SeededWriter {
  userId: string;
  name: string;
  email: string;
  penName: string;
}

const REQUIRED_FIELDS = [
  'userId',
  'name',
  'email',
  'penName',
] as const;

/**
 * @description
 * The accounts of the local stack whose role comes from Terraform instead of a writer request (the writers and the admin). Terraform hands them over as one JSON setting; it is checked here so that a wrong value stops the seeding with a clear message.
 */
export function parseSeededWriters(
  raw: string | undefined,
): SeededWriter[] {
  if (!raw?.trim()) {
    throw new Error('SEEDED_WRITERS is not set');
  }

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('SEEDED_WRITERS is not valid JSON');
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('SEEDED_WRITERS must be a non-empty JSON array');
  }

  return value.map((entry, index) => {
    const seeded = entry as Record<string, unknown>;

    for (const field of REQUIRED_FIELDS) {
      if (typeof seeded?.[field] !== 'string' || !seeded[field]) {
        throw new Error(
          `SEEDED_WRITERS[${index}].${field} must be a non-empty string`,
        );
      }
    }

    const penNameProblem = getPenNameProblem(
      seeded.penName as string,
    );

    if (penNameProblem) {
      throw new Error(
        `SEEDED_WRITERS[${index}].penName is not a valid pen name (${penNameProblem})`,
      );
    }

    return seeded as unknown as SeededWriter;
  });
}

/**
 * @returns The `Writer` row id of each seeded account, by user id
 */
export async function seedWriters(
  prisma: PrismaClient,
): Promise<Map<string, string>> {
  console.log('\n✍️  Processing writers...');

  const writers = parseSeededWriters(process.env.SEEDED_WRITERS);
  const writerIds = new Map<string, string>();

  for (const { userId, name, email, penName } of writers) {
    const writer = await prisma.writer.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        name,
        email,
        penName,
        status: WriterStatus.APPROVED,
        applications: [],
      },
      select: { id: true },
    });

    writerIds.set(userId, writer.id);
    console.log(`   ✅ Writer "${penName}"`);
  }

  return writerIds;
}
