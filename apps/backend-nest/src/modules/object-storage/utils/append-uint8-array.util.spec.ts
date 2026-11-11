import { appendUint8Array } from './append-uint8-array.util';

describe(appendUint8Array.name, () => {
  it('should append newData to non-empty data', () => {
    const data = new Uint8Array([1, 2, 3]);
    const newData = new Uint8Array([4, 5]);

    const result = appendUint8Array(data, newData);

    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should return a copy of newData when data is empty', () => {
    const data = new Uint8Array([]);
    const newData = new Uint8Array([9, 8]);

    const result = appendUint8Array(data, newData);

    expect(Array.from(result)).toEqual([9, 8]);
    // Ensure it’s a new Uint8Array instance, not the same reference
    expect(result).not.toBe(newData);
  });

  it('should work when newData is empty', () => {
    const data = new Uint8Array([7]);
    const newData = new Uint8Array([]);

    const result = appendUint8Array(data, newData);

    expect(Array.from(result)).toEqual([7]);
  });

  it('should NOT mutate the inputs', () => {
    const data = new Uint8Array([1, 2]);
    const newData = new Uint8Array([3]);

    appendUint8Array(data, newData);

    expect(Array.from(data)).toEqual([1, 2]);
    expect(Array.from(newData)).toEqual([3]);
  });
});
