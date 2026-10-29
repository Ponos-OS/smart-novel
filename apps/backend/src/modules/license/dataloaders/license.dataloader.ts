import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import { LicenseService } from '../services';
import { License } from '../types';

@Injectable({ scope: Scope.REQUEST })
export class LicenseDataLoader {
  private readonly loader: DataLoader<string, License>;

  constructor(licenseService: LicenseService) {
    this.loader = new DataLoader<string, License>(async (ids) => {
      const licenses = await licenseService.findByIds([...ids]);

      return ids.map(
        (id) =>
          licenses.get(id) ??
          new Error(`License with id ${id} not found`),
      );
    });
  }

  load(licenseId: string): Promise<License> {
    return this.loader.load(licenseId);
  }
}
