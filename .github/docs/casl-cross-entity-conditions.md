# CASL and cross-entity conditions (why Chapter ownership isn't a direct field)

Relevant upstream discussion: [stalniy/casl#8](https://github.com/stalniy/casl/issues/8).

## The problem

CASL rules are conditions matched against a single in-memory object:

```ts
can('update', 'Post', { authorId: user.id });
ability.can('update', somePost); // checks somePost.authorId
```

This works as long as the condition's field lives **on the object you hand CASL**. It breaks
down the moment the condition depends on a field of a _related_ entity. From the CASL
maintainer's own reply in issue #8, using an example almost identical to ours (checking a
post's author's email instead of a field on the post itself):

> "CASL doesn't provide a solution if you need to define permissions for one entity based on
> fields of another entity, and it doesn't matter which database you use. So, for such cases
> you will need to do some manual stuff."

His example rule, `can('update', 'Post', { 'author.email': { $regex: 'admin' } })`, checks fine
against a single already-loaded post object with an embedded `author`. The problem he's
actually describing is turning that rule into a **query** that fetches every post a user is
allowed to update — that requires knowing `author.email` refers to a joined table and emitting
a SQL `INNER JOIN`, which CASL's core condition matcher (originally `sift`, now
`@ucast/mongo2js`) has no concept of. It only matches conditions against a JS object tree
that's already in memory.

This is exactly our situation: a `Chapter`'s permissions depend on its **parent `Novel`'s**
`ownerId` — a field that doesn't exist on `Chapter` at all.

## Why this bites less in MongoDB

The issue's title context (postgres/sequelize support) matters: MongoDB documents are commonly
denormalized — a `Post` document often already embeds `{ author: { id, email } }` as a
subdocument. Checking `'author.email'` against a _loaded_ document needs no join; the field is
just... there, nested, on the same document. The pain in the issue is specific to relational
databases and to CASL's `accessibleBy`/`rulesToQuery`-style APIs (fetching _all_ records a user
can act on), which do need real SQL joins to convert a cross-entity rule into a `WHERE` clause.
Years after this issue, CASL grew `@ucast/sql` and ORM-specific packages (`@casl/prisma`, etc.)
that add auto-join support for exactly that query-building use case — see the issue thread's
later comments for that history.

## Our solution for Postgres

We don't use CASL's `accessibleBy`/query-building side at all — every check in this codebase is
a single-object `ability.can(...)` call, never "fetch me all chapters I can edit." That sidesteps
the auto-join problem entirely. What we do instead is exactly the maintainer's prescribed
"manual stuff": fetch the related field ourselves via Prisma, then hand CASL a plain,
already-flattened stand-in object tagged with [`subject()`](https://casl.js.org/v6/en/guide/subject-type-detection#subject-helper).

**Rule declaration** — conditions matched against `Novel.ownerId` (a real, direct field, no
join needed) and a synthetic `novelOwnerId` field for `Chapter` (which has no `ownerId` of its
own):
[`casl-ability.factory.ts#L37-L49`](https://github.com/Ponos-OS/smart-novel/blob/4d7fc33bd5be01b020435f5e027874875fdd8480/apps/backend/src/modules/auth/casl/casl-ability.factory.ts#L37-L49)

**Contrast case — same-entity condition, no join required.** `Novel.ownerId` lives directly on
the row being checked, so this is the "all should be good" case from the maintainer's reply —
fetch the row, hand it straight to `ability.can()`:
[`novel.policy.ts#L45-L71`](https://github.com/Ponos-OS/smart-novel/blob/4d7fc33bd5be01b020435f5e027874875fdd8480/apps/backend/src/modules/auth/policies/novel.policy.ts#L45-L71)

**Cross-entity case — manual join, then a stand-in object.** A chapter update needs its
_parent novel's_ owner. We do the join ourselves with a plain Prisma relation `select`
(`chapter.novel.ownerId`), then tag a small object with `subject('Chapter', { novelOwnerId })`
so CASL checks the already-resolved field instead of trying to traverse a relation it knows
nothing about:
[`chapter.policy.ts#L52-L78`](https://github.com/Ponos-OS/smart-novel/blob/4d7fc33bd5be01b020435f5e027874875fdd8480/apps/backend/src/modules/auth/policies/chapter.policy.ts#L52-L78)

**Cross-entity case at create time — no chapter row exists yet.** Same idea, but the "join" is
just fetching the target `Novel` directly (there's no chapter to join from), and the stand-in
object is built from that fetch. This uses CASL's own
[`ForbiddenError.from(ability).throwUnlessCan(...)`](https://casl.js.org/v6/en/api/casl-ability#forbiddenerror)
instead of a hand-rolled `if (!allowed) throw`:
[`chapter.policy.ts#L96-L124`](https://github.com/Ponos-OS/smart-novel/blob/4d7fc33bd5be01b020435f5e027874875fdd8480/apps/backend/src/modules/auth/policies/chapter.policy.ts#L96-L124)

## Why this matches the suggested resolution

The maintainer's own answer to "what do I do about a condition on another entity" is: don't
expect CASL to resolve it, resolve it yourself and feed CASL a flat object. That's the entire
pattern above — Prisma does the join (it already knows how to do relational `select`s far
better than a generic query-rewriter would), and CASL is only ever asked to do what it's
actually built for: match a set of declared conditions against a plain object. We never needed
`@ucast/sql`, `@casl/prisma`'s query helpers, or any auto-join machinery, because we never ask
CASL to generate a _list_ query — only ever "is this one specific action, on this one specific
(already-loaded-or-fetched) thing, allowed."

> [!NOTE]
> The GitHub permalinks above pin to commit `4d7fc33` on `feat/create-chapter`, which is **not
> pushed yet** — they'll 404 until that branch (or its merge commit) reaches `origin`. Once
> pushed, permalinks pinned to a commit SHA stay valid even if the branch is later
> rebased/squashed; if the file moves or the commit becomes unreachable after a squash, re-pin
> to the new merge commit's SHA instead.
