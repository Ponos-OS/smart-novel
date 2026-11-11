import { escapeLikePattern } from './like-pattern.util';

describe(escapeLikePattern.name, () => {
  it.each([
    { text: '100%', expected: '100\\%' },
    { text: 'mina_ardalan', expected: 'mina\\_ardalan' },
    { text: 'C:\\temp', expected: 'C:\\\\temp' },
    { text: 'Mina Ardalan', expected: 'Mina Ardalan' },
  ])('should escape the wildcards of $text', ({ text, expected }) => {
    const result = escapeLikePattern(text);

    expect(result).toBe(expected);
  });
});
