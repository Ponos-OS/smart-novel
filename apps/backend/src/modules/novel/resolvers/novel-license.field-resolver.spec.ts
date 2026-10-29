import { NovelState } from '@prisma/client';

import type { LicenseDataLoader } from '../../license';
import type { Novel } from '../types';

import { NovelLicenseFieldResolver } from './novel-license.field-resolver';

describe(NovelLicenseFieldResolver.name, () => {
  it('loads the license of the novel by its license id', async () => {
    // Arrange
    const license = {
      id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
      name: 'CC BY 4.0',
    };
    const licenseDataLoader = {
      load: vi.fn().mockResolvedValue(license),
    } as unknown as LicenseDataLoader;
    const uut = new NovelLicenseFieldResolver(licenseDataLoader);
    const novel: Novel = {
      id: '78981754-46c4-4521-9216-b9b27dafeab2',
      name: 'The Journey Begins',
      author: 'Jane Doe',
      category: ['fantasy'],
      state: NovelState.ONGOING,
      description: 'A young hero leaves home.',
      ownerId: '260311094522198751',
      licenseId: license.id,
    };

    // Act
    const result = await uut.license(novel);

    // Assert
    expect(result).toBe(license);
    expect(licenseDataLoader.load).toHaveBeenCalledExactlyOnceWith(
      license.id,
    );
  });
});
