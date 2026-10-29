import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { join } from 'path';
import { Pool } from 'pg';

import { seedCategories } from './seeders/category.seeder';
import { seedLicenses } from './seeders/license.seeder';
import { seedNovels } from './seeders/novel.seeder';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const DATA_PATH = join(__dirname, '..', 'data');

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log(`📂 Data path: ${DATA_PATH}\n`);

  try {
    const categoryMap = await seedCategories(prisma, DATA_PATH);

    const licenses = await seedLicenses(prisma);

    await seedNovels(prisma, DATA_PATH, categoryMap, licenses);

    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Database seeding failed:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
