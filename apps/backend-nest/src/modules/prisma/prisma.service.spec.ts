import type { ConfigType } from '@nestjs/config';

import { appConfigs } from '../../app/configs/app.config';
import { PrismaService } from './prisma.service';

vi.mock('pg', () => {
  const Pool = vi.fn(function (this: any) {
    this.connect = vi.fn();
    this.end = vi.fn();
    this.query = vi.fn();
  });
  return { Pool };
});
vi.mock('@prisma/adapter-pg', () => {
  const PrismaPg = vi.fn(function (this: any) {
    this.provider = 'postgres';
    this.startTransaction = vi.fn();
    this.getConnectionInfo = vi.fn();
  });
  return { PrismaPg };
});

describe(PrismaService.name, () => {
  let uut: PrismaService;
  let mockAppConfig: ConfigType<typeof appConfigs>;

  beforeEach(async () => {
    mockAppConfig = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    } as ConfigType<typeof appConfigs>;

    uut = new PrismaService(mockAppConfig);

    // Mock the PrismaClient methods
    uut.$connect = vi.fn().mockResolvedValue(undefined);
    uut.$disconnect = vi.fn().mockResolvedValue(undefined);
  });

  it('should connect to the database on module init', async () => {
    await uut.onModuleInit();

    expect(uut.$connect).toHaveBeenCalledTimes(1);
  });

  it('should disconnect from the database on module destroy', async () => {
    await uut.onModuleDestroy();

    expect(uut.$disconnect).toHaveBeenCalledTimes(1);
  });
});
