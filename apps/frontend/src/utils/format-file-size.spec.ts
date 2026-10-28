import { formatFileSize } from './format-file-size';

describe(formatFileSize.name, () => {
  it.each([
    { bytes: 70, expected: '70 B' },
    { bytes: 1024, expected: '1.0 KB' },
    { bytes: 204800, expected: '200.0 KB' },
    { bytes: 5 * 1024 * 1024, expected: '5.0 MB' },
  ])(
    'should format $bytes bytes as $expected',
    ({ bytes, expected }) => {
      const result = formatFileSize(bytes);

      expect(result).toBe(expected);
    },
  );
});
