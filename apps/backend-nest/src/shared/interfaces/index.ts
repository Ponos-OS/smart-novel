export interface PaginationArgs {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

/**
 * @internal
 * - Stores filter context for lazy field resolvers (e.g. `totalCount`).
 * - **Not** exposed in GraphQL: used to pass query filters from the parent resolver to field resolvers without re-parsing arguments.
 *
 * @why
 * - Easy to test and pragmatic.
 * - This is type-safe (`FilterContextHolder<T>`), not exposed in the schema (no `@Field()`), explicitly documented (`@internal` JSDoc).
 * - GraphQL's `@Parent()` is the **intended** mechanism for parent-to-child resolver communication. Attaching `_filterContext` to the connection object is just using that mechanism.
 * - The key advantage over GraphQL context (or CLS): **it's instance-scoped**. If a single query returns two different `ChapterConnection` instances (e.g., two novels each with `chaptersConnection`), each one carries its own filter context. With request-scoped GraphQL context, we'd need complex keying to avoid collisions.
 */
export interface FilterContextHolder<Ts> {
  _filterContext?: Ts;
}
