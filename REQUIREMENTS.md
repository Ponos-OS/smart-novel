# Writer Access Requests

> **Do NOT commit any step.** After finishing a step (implementation and tests), stop with the working tree uncommitted and wait for the user's code review before doing anything else.

**Primary goal:** A self-registered user (role `user`) asks to become a writer with a short note. An admin reviews the request in the app, and approving it grants the `writer` role in ZITADEL automatically.

## Decisions Log

| #   | Decision                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Everyone still registers as `user` (the existing post-registration action). Becoming a writer is a separate, explicit request made after registration.                                                                                                                            |
| D2  | A request has a `status` of the enum `WriterRequestStatus` (`PENDING`, `APPROVED`, `REJECTED`). Reviewed requests are kept as history.                                                                                                                                            |
| D3  | A request carries a required free-text `note` (trimmed, 1 to `WRITER_REQUEST_NOTE_MAX_LENGTH` characters, the constant lives in `libs/shared`). It also snapshots the requester's display name and email at request time, so the admin list needs no ZITADEL lookup.              |
| D4  | Only a caller whose highest role is `user` can request. Writers and admins get a 400. A user has at most one `PENDING` request, enforced by a partial unique index, not only in code.                                                                                             |
| D5  | Rejecting stores an optional `rejectionReason` that the user sees. After a rejection the user may file a new request. There is no cooldown and no ban. Old requests stay as history.                                                                                              |
| D6  | Approve calls the ZITADEL management API first and marks the request `APPROVED` second. If ZITADEL fails, the mutation fails and the request stays `PENDING`, so the admin can retry. This is the primary action, so the "log and continue" rule for side effects does not apply. |
| D7  | Approve sets the user's project grant to exactly `[writer]` (it replaces `user`), matching the seeded writers. `writer` already includes everything `user` can do (`hasMinimumRole`). Setting the grant is idempotent, so retrying after a failed database write is safe.         |
| D8  | The backend authenticates to ZITADEL with a dedicated machine user and PAT holding only `ORG_USER_PERMISSION_EDITOR`. Never the `IAM_OWNER` token, never the integration-test bot's `ZITADEL_PAT`.                                                                                |
| D9  | Roles are read from the token and cached UserInfo, so an approved user keeps `user` until their token is refreshed. The UI tells them to sign out and in again. No emails or push notifications: the user sees the status next time they open the app.                            |
| D10 | Every list of requests is a cursor-based Relay connection, same argument shape as `categoriesConnection`.                                                                                                                                                                         |
| D11 | Out of scope: revoking writer access, expiring requests, notifications, a history view for admins beyond a status filter.                                                                                                                                                         |

---

## Step 1 -- Machine user for the backend in ZITADEL

**Description:** Give the backend a least-privilege credential to manage user grants (D8).

**AC**

- `modules/zitadel_config` creates a machine user, a PAT for it, and grants it the instance or org role `ORG_USER_PERMISSION_EDITOR` (confirm the exact role name and where it is granted in ZITADEL's docs before building on it). It gets no project roles.
- The PAT reaches the backend container as an environment setting through the same path as the existing generated `ZITADEL_PAT` (`envs/local-zitadel` output, then `envs/local`), under a new name. It is not set by hand in `.env`; `.env.example` gets a note next to the existing one about generated keys.
- The deployed environment gets the same: `envs/hetzner-zitadel` sets `backend_access` and outputs `backend_pat`, and `envs/hetzner` takes it as the `zitadel_management_pat` input, handed to the backend as `ZITADEL_MANAGEMENT_PAT` (optional, so an environment without it keeps working; document it in `README.md`).
- The module change is covered by a `run` block in `zitadel_config.tftest.hcl`. The module stays free of `dev`, `local` and `kind`.

**Test:** `terraform test` for the module. Ask the user to run `npm run start:dev` and `npm run stop:dev` twice each (idempotence). Check the backend pod receives the variable without printing its value. For production, `terraform validate` in `envs/hetzner` and `envs/hetzner-zitadel`; applying them is the user's call.

## Step 2 -- ZITADEL management client in the backend

**Description:** One small client that sets a user's project role.

**AC**

- `ZitadelManagementClient` in the `auth` module with `setUserProjectRole(userId, role)`: finds the user's grant on the project, updates it to `[role]` if it exists, creates it otherwise. A second call with the same arguments changes nothing (D7).
- Endpoints, payloads and the project id source are confirmed against ZITADEL's current docs (Context7) before coding. The base URL is `ZITADEL_INTERNAL_URL` (falling back to the issuer URL), the token is the Step 1 PAT (`ZITADEL_MANAGEMENT_PAT`), and the project id is the new generated setting `ZITADEL_PROJECT_ID` (from the `project_id` output of the ZITADEL stage in `envs/local`, and the `zitadel_project_id` input of `envs/hetzner`). Both settings are mandatory: the backend refuses to start without them.
- A non-2xx answer from ZITADEL throws, with the status in the log, and no token in any message.

**Test:** Unit tests with the HTTP layer mocked: update path, create path, idempotent repeat, non-2xx. `backend-e2e` is covered in Step 5, where the client is used for real.

## Step 3 -- Writer request in the database

**Description:** The persisted request (D2, D3, D4).

**AC**

- Prisma enum `WriterRequestStatus` and model `WriterRequest`: `id`, `userId` (the `sub`), `requesterName`, `requesterEmail`, `note`, `status` (default `PENDING`), `rejectionReason?`, `reviewedBy?`, `createdAt`, `reviewedAt?`, with an index on `(status, createdAt)`.
- `apps/backend/prisma/migrations` did not exist (local and e2e use `prisma db push`), so this step starts it: a baseline migration of the current schema, then the migration for this table. Production applies them with `prisma migrate deploy --config=./apps/backend/prisma.config.ts` (the documented `--schema` form fails under Prisma 7); dev keeps `db push`.
- The partial unique index on `userId` where `status = 'PENDING'` is declared in `schema.prisma` with `@@unique(..., where: raw(...))` (Prisma preview feature `partialIndexes`, supported since 7.4), so `db push` and the migration both create it.
- `WRITER_REQUEST_NOTE_MAX_LENGTH` is exported from `libs/shared`.

**Test:** Apply the migrations to an empty database with `prisma migrate deploy`, check `prisma migrate diff` shows no drift, and `db push` into a fresh one gets the index too; confirm a second `PENDING` row for the same user fails while a `PENDING` next to an old `REJECTED` one succeeds. Unit test of the shared constant is not needed.

## Step 4 -- Request side: `requestWriterAccess`, `myWriterRequest`

**Description:** What a `user` can do (D3, D4, D5).

**AC**

- New `writer-request` backend module with its resolver added to `apps/backend/gen-graphql-schema.ts`.
- `requestWriterAccess(note)`: caller must be authenticated; a caller whose highest role is `writer` or `admin` gets a 400; an empty, whitespace-only or too long note gets a 400; an existing `PENDING` request of the caller gets a 400 (the unique index violation is mapped to it, not a 500). On success it stores the caller's `sub`, name and email from the token.
- `myWriterRequest`: the caller's latest request or `null`.
- The frontend `.graphql` documents are not touched yet (Step 6).

**Test:** Unit tests for the service (each rejection above, the success path). `graphql-api-tester` for both operations. `backend-e2e`: a `user` can request and sees it; a second request while `PENDING` is a 400; a writer and an admin get a 400.

## Step 5 -- Review side: list, approve, reject

**Description:** What an admin can do, including the real ZITADEL grant (D5, D6, D7, D10).

**AC**

- `writerRequestsConnection(first, after, filters: { status })`, admin only, ordered by `createdAt`, default `PENDING`, `first`/`last` capped like `categoriesConnection`.
- `approveWriterRequest(id)`: admin only; the request must be `PENDING` (else 400); calls `setUserProjectRole(userId, writer)` first and then marks `APPROVED` with `reviewedBy` and `reviewedAt`. A ZITADEL failure leaves the request `PENDING` and fails the mutation (D6).
- `rejectWriterRequest(id, reason?)`: admin only; the request must be `PENDING`; marks `REJECTED` with the optional trimmed reason.
- `reviewedBy` is the admin's `sub`. Approving or rejecting an unknown id is a 404.

**Test:** Unit tests: transitions, ZITADEL called before the status change, ZITADEL failure leaves `PENDING`. `graphql-api-tester` for the three operations. `backend-e2e` against the real ZITADEL (nothing mocked): a `user` and a `writer` cannot list, approve or reject; an admin approves and the user's actual grant becomes `[writer]`; after a rejection the user can file a new request.

## Step 6 -- Requesting writer access in the UI

**Description:** The user-facing button, dialog and status (D3, D5, D9).

**AC**

- A `.graphql` document for `myWriterRequest` and `requestWriterAccess`, and `frontend:codegen` stays green.
- For a user whose highest role is `user`, a "Become a writer" button opens a dialog modelled on `RequestCategoryDialog`: a note textarea with a character counter limited by `WRITER_REQUEST_NOTE_MAX_LENGTH`, submit disabled while the note is empty.
- The button is replaced by the request's state: `PENDING` shows a "Request pending" badge; `REJECTED` shows the reason (when there is one) and a "Request again" button; `APPROVED` shows a message telling the user to sign out and in again.
- Writers and admins never see any of it. No barrel `index.ts`.

**Test:** Vitest specs for the dialog and each state. Storybook stories for the dialog and the four states; verify they render. No Cypress: the permission boundary is covered in `backend-e2e` (Step 5).

## Step 7 -- Admin page for writer requests

**Description:** Review requests in the app (D10).

**AC**

- New `features/admin-writer-requests/` page at `/admin/writer-requests`, modelled on `features/admin-categories`, with a nav link in `Header.tsx` visible to admins only.
- Lists `PENDING` requests (name, email, note, date) from `writerRequestsConnection` with a status filter and "load more".
- Approve is one click and shows an error when the mutation fails (for example ZITADEL is unreachable) while the row stays. Reject opens a dialog with an optional reason.
- The list updates after approve and reject without a reload.

**Test:** Vitest specs for the page (loading, empty, approve, approve failure, reject with and without a reason). Storybook stories for the page states.
