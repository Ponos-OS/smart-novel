import { getPenNameProblem } from './writer.constants';

describe(getPenNameProblem.name, () => {
  it.each([
    'Mina',
    'Mina_Ardalan',
    'mina-ardalan',
    '_-_',
    'a'.repeat(3),
    'a'.repeat(50),
  ])('should accept %s', (penName) => {
    const result = getPenNameProblem(penName);

    expect(result).toBeNull();
  });

  it.each([
    { penName: '', problem: 'EMPTY' },
    { penName: 'ab', problem: 'TOO_SHORT' },
    { penName: 'a'.repeat(51), problem: 'TOO_LONG' },
    { penName: 'Mina2', problem: 'INVALID_CHARACTERS' },
    { penName: 'Mina Ardalan', problem: 'INVALID_CHARACTERS' },
    { penName: 'Mína', problem: 'INVALID_CHARACTERS' },
    { penName: 'Мина', problem: 'INVALID_CHARACTERS' },
    { penName: 'Mina.Ardalan', problem: 'INVALID_CHARACTERS' },
    { penName: 'a'.repeat(51) + '1', problem: 'INVALID_CHARACTERS' },
  ])(
    'should name the problem of "$penName"',
    ({ penName, problem }) => {
      const result = getPenNameProblem(penName);

      expect(result).toBe(problem);
    },
  );
});
