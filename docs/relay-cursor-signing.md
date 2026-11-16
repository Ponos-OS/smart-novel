---
title: Do you need to sign a Relay pagination cursor?
published: false
tags: graphql, relay, go, nestjs
---

# Do you need to sign a Relay pagination cursor?

Short answer: no. The Relay Cursor Connections spec never asks for it. I signed cursors anyway in a NestJS backend, then dropped the signature when I rewrote it in Go with ent and entgql. This post is about why I did it, what it bought me, and why I stopped.

## What the spec says

The [Relay Cursor Connections spec](https://relay.dev/graphql/connections.htm) asks for three things that matter here:

- Every edge has a `cursor`, and the spec calls it an opaque string. Clients must not parse it or build one.
- `first`/`after` and `last`/`before` are positions in a list. The server applies filters and ordering first, then cuts the page at the cursor.
- The server may use any cursor format and may change it later.

That is all. Nothing says the cursor must be signed, encrypted or tied to the query that issued it. "Opaque" is a contract with the client (do not look inside), not a security property.

## When a signature is worth having

A signature (or an encryption) earns its cost when a forged cursor gets the client something:

1. The cursor carries something sensitive, such as a tenant, a user or a private offset.
2. The position decides who may read what, so a forged cursor can reach rows the caller should not see.
3. The server trusts the cursor as input to a query that is not parameterized.

If none of those hold, the worst a forged cursor can do is return an odd slice of a list the caller may already read, or fail with "invalid cursor".

## How I did it in NestJS

The cursor was `<base64url JSON payload>.<base64url HMAC-SHA256 of the payload>`. The payload held the id of the last row and an "audience", a hash of the query that issued the cursor:

```ts
const payload: CursorPayload = { a: audience, k: [id] };
const body = Buffer.from(JSON.stringify(payload)).toString(
  'base64url',
);

return `${body}.${this.sign(body).toString('base64url')}`;
```

Decoding checked the signature in constant time, then the audience, then that the id was a UUID:

```ts
if (
  actual.length !== expected.length ||
  !timingSafeEqual(actual, expected)
) {
  throw new BadRequestException(INVALID_CURSOR_MESSAGE);
}
// ...
if (
  payload.a !== audience ||
  payload.k?.length !== 1 ||
  !id ||
  !isUUID(id)
) {
  throw new BadRequestException(INVALID_CURSOR_MESSAGE);
}
```

The audience is what made the cursor "bound to its query". Each list built it from the connection name and the filter:

```ts
audience: buildAudience('writers', { where }),
```

So a cursor from the unfiltered writers list, sent with `search: 'user'`, was refused. I had an e2e case for it:

```ts
it('should refuse a cursor issued without the search', async () => {
  // page 1 without a search, then page 2 with one, reusing the cursor
  expect(data.errors[0].message).toContain('Invalid cursor');
});
```

The pieces, if you want to read them:

- [the codec](https://github.com/Ponos-OS/smart-novel/blob/9d3ca84/apps/backend-nest/src/modules/cursor/cursor-codec.service.ts)
- [the audience hash](https://github.com/Ponos-OS/smart-novel/blob/9d3ca84/apps/backend-nest/src/shared/utils/cursor-audience.util.ts)
- [its use in the writers list](https://github.com/Ponos-OS/smart-novel/blob/9d3ca84/apps/backend-nest/src/modules/writer/writer.service.ts)

### What it cost

- A secret (`CURSOR_SIGNING_SECRET`) to configure, rotate and keep out of the logs. Rotating it invalidates every cursor a client is holding.
- A codec, an audience builder and a paginate helper that every list had to call correctly. A new list that forgot the audience still worked, it just lost the guarantee.
- A cursor that was a few hundred bytes of JSON for a single UUID.

### What it bought

Honestly, not much. Every field in the cursor is something the client already sees in the list. Authorization ran on each request, so a forged cursor never skipped it. The "refuse a cursor issued without the search" rule was a side effect of the design that I had turned into a test, not a requirement anyone had.

## How it works in Go with entgql

I moved the backend to Go with [ent](https://entgo.io) and its GraphQL extension `entgql`. `entgql` generates the connection types and a `Paginate` method, and it brings its own cursor.

Its cursor is a position and nothing else: the row id, and the value of the sort field when you order by one, encoded with msgpack and base64:

```go
type Cursor[T any] struct {
	ID    T         `msgpack:"i"`
	Value ent.Value `msgpack:"v,omitempty"`
}
```

There is no signature and no audience. A list resolver is one call:

```go
return r.Client.Writer.Query().Paginate(ctx, after, first, before, last,
	ent.WithWriterOrder(orderBy), ent.WithWriterFilter(filter))
```

`Paginate` applies the filter and the order, then the keyset condition from the cursor, as bound parameters. So the same cursor with a different `where` simply returns the rows after that position in the new result set.

The one thing I kept from the old design is the error. A string that ent cannot decode is the caller's fault, not a server error, so the scalar turns it into its own `INVALID_CURSOR` error, which the frontend matches by code:

```go
func UnmarshalCursor(v any) (entgql.Cursor[uuid.UUID], error) {
	var cursor entgql.Cursor[uuid.UUID]
	if err := cursor.UnmarshalGQL(v); err != nil {
		return cursor, apperr.WithCode(apperr.CodeInvalidCursor, InvalidCursorMessage)
	}

	return cursor, nil
}
```

The [cursor scalar](../apps/backend/internal/graph/scalar/cursor.go) and the [e2e cases for malformed cursors](../apps/backend-e2e/src/backend/cursor-validation.e2e-spec.ts) are the only cursor code left in the project. The page size rules (`first` and `last`) are in [one small package](../apps/backend/internal/pagination/pagination.go).

### What I checked before dropping the signature

| Question                                                     | Answer                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Does the cursor hold anything the client cannot already see? | No. An id, and a sort value that is in the row.                                          |
| Can a forged cursor skip authorization?                      | No. The guard runs on every request, before the resolver.                                |
| Can it inject SQL?                                           | No. The keyset condition is built from bound parameters.                                 |
| What does a garbage cursor do?                               | `INVALID_CURSOR`, "Invalid cursor".                                                      |
| What does a valid cursor reused under another filter do?     | Returns the rows after that position in the filtered list. Correct data, nothing leaked. |

The case I did not test is a cursor from one sort order used under another. It may return an odd slice or an error, and either way the list stays behind the same checks.

## What changed in behavior

One test disappeared: "refuse a cursor issued without the search". It asserted a rule that came from my cursor design, not from the spec or a requirement, and with entgql's cursor the request succeeds. I decided that was fine and removed the test instead of rebuilding signed, filter-bound cursors on top of entgql. That would mean a custom cursor type on every list, replacing the generated one, to protect against something that returns correct data anyway.

## When I would sign cursors again

- The cursor carries something sensitive.
- The position into the list decides who may read what.
- The server builds a query from the cursor without parameters.

If none of that applies, an opaque, unsigned cursor is what the spec describes, and it is one less secret to look after.
