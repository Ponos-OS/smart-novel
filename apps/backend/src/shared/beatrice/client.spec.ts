import axios from 'axios';
import { parse } from 'graphql';

import { runOperation } from './client';

vi.mock('axios');

describe(runOperation.name, () => {
  const mockMutation = parse(
    'mutation Foo($foo: String!) { foo(foo: $foo) { bar } }',
  ) as any;
  const mockVariables = { foo: 'bar' };

  it('should return the data payload when the request is successful', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        data: {
          someField: 'someValue',
        },
      },
    });

    const result = await runOperation(mockMutation, mockVariables, {
      url: 'http://mock-url',
      timeoutMs: 1000,
    });

    expect(result).toEqual({
      someField: 'someValue',
    });
  });

  it('should serialize the AST document to a GraphQL query string', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { data: {} },
    });

    await runOperation(mockMutation, mockVariables, {
      url: 'http://mock-url',
      timeoutMs: 1000,
    });

    const [, body] = vi.mocked(axios.post).mock.calls[0];
    expect(body).toMatchObject({
      variables: mockVariables,
    });
    expect((body as { query: string }).query).toContain(
      'mutation Foo',
    );
  });

  it('should forward the authorization header when provided', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { data: {} },
    });

    await runOperation(mockMutation, mockVariables, {
      url: 'http://mock-url',
      timeoutMs: 1000,
      authorization: 'Bearer some-jwt',
    });

    const [, , config] = vi.mocked(axios.post).mock.calls.at(-1)!;
    expect(
      (config as { headers: Record<string, string> }).headers,
    ).toMatchObject({ authorization: 'Bearer some-jwt' });
  });

  it('should omit the authorization header when not provided', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { data: {} },
    });

    await runOperation(mockMutation, mockVariables, {
      url: 'http://mock-url',
      timeoutMs: 1000,
    });

    const [, , config] = vi.mocked(axios.post).mock.calls.at(-1)!;
    expect(
      (config as { headers: Record<string, string> }).headers,
    ).not.toHaveProperty('authorization');
  });

  it('should throw BeatriceRequestError when the request returns errors', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        errors: [{ message: 'Error 1' }, { message: 'Error 2' }],
      },
    });

    await expect(
      runOperation(mockMutation, mockVariables, {
        url: 'http://mock-url',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow('Error 1; Error 2');
  });
});
