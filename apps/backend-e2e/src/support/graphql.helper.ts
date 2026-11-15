import axios from 'axios';

/**
 * @description Posts one operation to the backend and returns the whole GraphQL answer, `data` and `errors`, without throwing on a GraphQL
 * error. Leave `authorization` out for an anonymous caller.
 */
export async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    {
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}
