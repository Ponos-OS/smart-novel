import { withPseudoIds } from './pseudo-id';

describe(withPseudoIds.name, () => {
  it('gives the same turn the same id every time', () => {
    // Arrange
    const turns = [
      { role: 'USER', content: 'Can others remix my novel?' },
    ];

    // Act
    const first = withPseudoIds(turns);
    const second = withPseudoIds([...turns]);

    // Assert
    expect(first[0].id).toBe(second[0].id);
  });

  it('keeps the ids of the turns that stay when the conversation grows or is condensed', () => {
    // Arrange
    const kept = { role: 'ASSISTANT', content: 'Yes, with credit.' };

    // Act
    const before = withPseudoIds([
      { role: 'USER', content: 'Can others remix my novel?' },
      kept,
    ]);
    const after = withPseudoIds([
      {
        role: 'ASSISTANT',
        content: 'Summary of the earlier conversation:',
      },
      kept,
    ]);

    // Assert
    expect(after[1].id).toBe(before[1].id);
  });

  it.each([
    ['another text', { role: 'USER', content: 'And sell it?' }],
    [
      'another author',
      { role: 'ASSISTANT', content: 'Can others remix my novel?' },
    ],
  ])('gives %s another id', (_, other) => {
    // Act
    const [a, b] = withPseudoIds([
      { role: 'USER', content: 'Can others remix my novel?' },
      other,
    ]);

    // Assert
    expect(a.id).not.toBe(b.id);
  });

  it('tells apart two turns that say the same thing', () => {
    // Act
    const ids = withPseudoIds([
      { role: 'USER', content: 'Yes' },
      { role: 'ASSISTANT', content: 'Sure?' },
      { role: 'USER', content: 'Yes' },
    ]).map(({ id }) => id);

    // Assert
    expect(new Set(ids).size).toBe(3);
  });

  it('keeps the rest of each turn as it was', () => {
    // Act
    const [turn] = withPseudoIds([
      { role: 'USER', content: 'Hello' },
    ]);

    // Assert
    expect(turn).toEqual({
      id: expect.any(String),
      role: 'USER',
      content: 'Hello',
    });
  });
});
