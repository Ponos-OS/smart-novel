import { parseSeededWriters } from './writer.seeder';

const writer = {
  userId: '364554362883670018',
  name: 'Writer User',
  email: 'writer@test.com',
  penName: 'Writer_User',
};

describe(parseSeededWriters.name, () => {
  it('should read the writers and the admin that Terraform hands over', () => {
    const admin = {
      ...writer,
      userId: '364554362732740610',
      name: 'Admin User',
      email: 'admin@test.com',
      penName: 'Admin_User',
    };

    const result = parseSeededWriters(
      JSON.stringify([admin, writer]),
    );

    expect(result).toStrictEqual([admin, writer]);
  });

  it.each([
    { scenario: 'unset', raw: undefined, message: 'is not set' },
    { scenario: 'blank', raw: '  ', message: 'is not set' },
    { scenario: 'not JSON', raw: '{oops', message: 'not valid JSON' },
    {
      scenario: 'not an array',
      raw: '{}',
      message: 'non-empty JSON array',
    },
    {
      scenario: 'an empty list',
      raw: '[]',
      message: 'non-empty JSON array',
    },
    {
      scenario: 'missing a field',
      raw: JSON.stringify([{ ...writer, email: undefined }]),
      message: 'SEEDED_WRITERS[0].email',
    },
    {
      scenario: 'a pen name with a digit',
      raw: JSON.stringify([{ ...writer, penName: 'Writer_2' }]),
      message: 'not a valid pen name (INVALID_CHARACTERS)',
    },
  ])(
    'should refuse a value that is $scenario',
    ({ raw, message }) => {
      const result = () => parseSeededWriters(raw);

      expect(result).toThrow(message);
    },
  );
});
