import http from 'k6/http';
import { Rate } from 'k6/metrics';

import { operation } from './operations.ts';

export const graphqlFailures = new Rate('graphql_failures');

const baseUrl = __ENV.BASE_URL ?? 'http://localhost:8080';

export interface GraphqlResult {
  data: Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  errors?: { message: string }[];
}

/**
 * @description Sends one frontend operation. The HTTP status of a GraphQL error is 200, so an `errors` array is what counts as a failure.
 */
export function send(
  name: string,
  variables: Record<string, unknown>,
  token: string,
): GraphqlResult {
  const response = http.post(
    `${baseUrl}/graphql`,
    JSON.stringify({ query: operation(name), variables }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      tags: { operation: name },
    },
  );
  const body: GraphqlResult =
    response.status === 200
      ? (response.json() as unknown as GraphqlResult)
      : {
          data: null,
          errors: [
            { message: `HTTP ${response.status}: ${response.body}` },
          ],
        };

  graphqlFailures.add(Boolean(body.errors), { operation: name });

  return body;
}

export type Call = (
  name: string,
  variables: Record<string, unknown>,
) => GraphqlResult;

/**
 * @description Like `send`, but a rejected operation throws with its name, for `setup()`: a UI change that breaks an operation is then reported as that, not as slowness.
 */
export function sendStrict(token: string): Call {
  return (name, variables) => {
    const result = send(name, variables, token);

    if (result.errors) {
      throw new Error(
        `operation ${name} rejected: ${result.errors[0].message}`,
      );
    }

    return result;
  };
}
