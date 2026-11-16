/**
 * @description The items of a Relay connection. The schema lets an edge, and the node of an edge, be null, which the backend never sends; this leaves out any that is.
 */
export function nodesOf<T>(connection: {
  edges?: ReadonlyArray<{ node?: T | null } | null> | null;
}): T[] {
  return (connection.edges ?? []).flatMap((edge) =>
    edge?.node ? [edge.node] : [],
  );
}

/**
 * @description The type of the items of a connection, as `nodesOf` gives them.
 */
export type NodeOf<
  T extends {
    edges?: ReadonlyArray<{ node?: unknown } | null> | null;
  },
> = NonNullable<NonNullable<NonNullable<T['edges']>[number]>['node']>;
