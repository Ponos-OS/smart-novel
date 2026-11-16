import { nodesOf } from './connection';

describe(nodesOf.name, () => {
  it('should give the nodes in order and skip what is null', () => {
    // Arrange
    const connection = {
      edges: [
        { node: { id: 'a' } },
        null,
        { node: null },
        { node: { id: 'b' } },
      ],
    };

    // Act
    const result = nodesOf(connection);

    // Assert
    expect(result).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('should give nothing for a connection without edges', () => {
    // Act
    const result = nodesOf({ edges: null });

    // Assert
    expect(result).toStrictEqual([]);
  });
});
