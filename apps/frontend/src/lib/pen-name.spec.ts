import cases from '../../../../spec/cases/pen-name.json';
import { getPenNameProblem } from './pen-name';

describe(getPenNameProblem.name, () => {
  it.each(cases.getPenNameProblem)(
    'should give $expected for "$penName"',
    ({ penName, expected }) => {
      const result = getPenNameProblem(penName);

      expect(result).toBe(expected);
    },
  );
});
