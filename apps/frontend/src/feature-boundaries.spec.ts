import { ESLint } from 'eslint';
import { resolve } from 'node:path';

const featuresDir = resolve(__dirname, 'features');

async function restrictedImports(
  feature: string,
  importPath: string,
): Promise<string[]> {
  const eslint = new ESLint({ cwd: resolve(__dirname, '../../..') });
  const [result] = await eslint.lintText(
    `import { value } from '${importPath}';\nexport const used = value;\n`,
    { filePath: resolve(featuresDir, feature, 'Probe.ts') },
  );

  return result.messages
    .filter(({ ruleId }) => ruleId === 'no-restricted-imports')
    .map(({ message }) => message);
}

describe('feature boundaries', () => {
  it.each([
    ['license-assistant', '../novel-license/LicenseTextEditor'],
    [
      'license-assistant',
      '../../features/platform-terms/PlatformTermsModal',
    ],
    ['admin-licenses', '../license-assistant/use-license-assistant'],
  ])(
    'should refuse %s importing the internals %s',
    async (feature, importPath) => {
      const result = await restrictedImports(feature, importPath);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("another feature's internals");
    },
  );

  it.each([
    ['license-assistant', '../novel-license/OfficialLicenseLink'],
    ['license-assistant', '../novel-license/license-notice'],
    ['admin-licenses', '../novel-license/LicenseField'],
    ['license-assistant', './StartPanel'],
    ['license-assistant', '../../components/Dialog'],
  ])('should let %s import %s', async (feature, importPath) => {
    const result = await restrictedImports(feature, importPath);

    expect(result).toEqual([]);
  });
});
