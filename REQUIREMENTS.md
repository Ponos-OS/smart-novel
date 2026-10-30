DO NOT COMMIT EACH STEP, let me review it first.

# Approved Categories and Category Requests

**Primary goal:** Writers pick a novel's categories from a searchable list of approved categories. A category that does not exist yet is requested by the writer and becomes usable only after an admin approves it. Admins manage categories on a dedicated page.

## Decisions Log

| #   | Decision                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | A category has a `status` of the enum `CategoryStatus` (`APPROVED`, `PENDING`), not a boolean, so a later state is one `ALTER TYPE ... ADD VALUE` instead of a data migration. Existing rows become `APPROVED`. A rejected request is deleted (no `REJECTED` state, no audit trail).                                                           |
| D2  | `createNovel` / `updateNovel` accept only `APPROVED` categories. An unknown or pending name is a validation error; categories are no longer created implicitly.                                                                                                                                                                                |
| D3  | A writer asks for a new category explicitly with a "Request category" button next to the categories field. Typing an unknown name in the field never creates anything.                                                                                                                                                                         |
| D4  | The request form says: "The new category will be created and be available after an admin approves it. Please come back later and add this category to your novel." The novel being created or edited is not affected meanwhile.                                                                                                                |
| D5  | Names stay normalized as today (`normalizeCategoryNames`: trimmed, lower-cased, de-duplicated). Requesting a name that already exists, approved or pending, is a **400** whose message contains the normalized name, so the writer knows what to search for instead.                                                                           |
| D6  | Only admins see and act on `PENDING` categories. Everyone else, including anonymous callers, only ever receives `APPROVED` ones, whatever filter they pass.                                                                                                                                                                                    |
| D7  | Admins manage categories on a **dedicated page** (`/admin/categories`): overview, search, status filter, approve, rename and delete. It follows the existing admin page (`features/admin-licenses`).                                                                                                                                           |
| D8  | Every list of categories is cursor-based (Relay connection, same argument shape as `novelsConnection`: `first`, `after`, ...). Nothing fetches all categories at once.                                                                                                                                                                         |
| D9  | The number of novels in a category is an **estimate** taken from the Postgres planner (`EXPLAIN (FORMAT JSON)`, the plan's `Plan Rows`), never `COUNT(*)`. It is exposed as `approximateNovelCount` and shown as `~N`. Its cost is planning time, independent of how many novels exist.                                                        |
| D10 | Only admins rename or delete a category, whatever its status. A writer's only power over an approved category is adding it to, or removing it from, their own novels. Rejecting a pending request is the same operation as deleting it.                                                                                                        |
| D11 | Renaming changes the one category row, so every novel using it follows automatically. The new name is normalized and a name that already exists is the same 400 as in D5. Deleting an approved category removes it from every novel that has it (the existing `onDelete: Cascade` on `novel_categories`); the novels themselves are untouched. |

## Notes on D9

- The estimate is only as fresh as the table statistics (autovacuum's `ANALYZE`), and it can be off for small categories (a category with 3 novels may report 1 or 10). The UI therefore always shows it as approximate.
- It is a field on `Category`, resolved only when a query selects it, so the pickers that do not need it pay nothing.

---

## Step 1 -- Category status in the database

**Description:** Add the status and who requested a category.

**AC**

- `Category` gets `status` (enum `CategoryStatus`: `APPROVED`, `PENDING`, default `APPROVED`) and nullable `requestedById` (the writer's `sub`), with an index on `(status, name)`.
- The migration leaves every existing category `APPROVED`.
- The seed keeps working unchanged.

**Test:** Run `npx prisma migrate dev` on a database with categories and check they are all `APPROVED`.

## Step 2 -- Category list: cursor-based, searchable, status-aware

**Description:** Replace `categories: [String!]!` with `categoriesConnection`.

**AC**

- `categoriesConnection(first, after, filters: { search, status })` returns `CategoryConnection` (`edges { cursor node { id name status } } pageInfo`), ordered by name, and is `@Public`.
- `search` is a case-insensitive prefix/contains match on `name`; without `first` or `last` a page of 20 is returned, and a `first`/`last` below 1 or above 100 is a 400 (`novelsConnection` has no cap, so this is new). A malformed `after`/`before` cursor is a 400 "Invalid cursor", and `%`, `_` and `\` in `search` are plain text, not `LIKE` wildcards.
- `status` defaults to `APPROVED`. For a caller who is not an admin, any other value is ignored (D6).
- The old `categories` query is removed; `search.graphql` is updated minimally so `frontend:codegen` stays green (the real UI work is in Step 8).

**Test:** Unit tests for the repository and service (pagination boundaries, search, the status rule per role). Integration via `graphql-api-tester` for `categoriesConnection`. `backend-e2e`: anonymous, writer and admin each ask for `PENDING` and get only what D6 allows.

## Step 3 -- Request, approve, rename and delete

**Description:** The write side of the workflow, including what admins manage.

**AC**

- `requestCategory(name)`: writer or admin only; creates a `PENDING` category with `requestedById` set to the caller. If the normalized name already exists (approved or pending) it throws a 400 `BadRequestException` whose message contains the normalized name (D5). Empty or whitespace names are rejected.
- `approveCategory(id)`: admin only; `PENDING` becomes `APPROVED`. Approving an approved category is a no-op.
- `updateCategory(id, name)`: admin only; renames a category of any status (D10, D11). The name is normalized; an empty name, or one that belongs to another category, is a 400 with the normalized name in the message. Renaming to its own current name is a no-op.
- `deleteCategory(id)`: admin only; deletes a category of any status and returns its id (D10, D11). The frontend uses it for both "Reject" on a pending request and "Delete" on an approved one.
- The new resolver is added to `apps/backend/gen-graphql-schema.ts`; the permissions live in `CaslAbilityFactory` like the other resources.
- `createNovel` / `updateNovel` reject categories that are not `APPROVED` with an error naming them (D2).

**Test:** Unit tests for the service and policy. `backend-e2e`: the permission matrix (user, writer, admin) for the four mutations; renaming to an existing name is a 400 and the novels follow a successful rename; deleting an approved category removes it from its novels and leaves them in place; a duplicate request with a differently cased name gets a 400 that contains the normalized name; a novel cannot use a pending category and can after approval.

## Step 4 -- Approximate novel count

**Description:** `Category.approximateNovelCount` (D9).

**AC**

- `approximateNovelCount: Int!` on `Category`, resolved by a field resolver that runs `EXPLAIN (FORMAT JSON)` on the `novel_categories` lookup for the category and returns the plan's row estimate. Bound parameters only, no string-built SQL. No `COUNT(*)` anywhere.
- Resolving a page of categories issues one cheap `EXPLAIN` per category, batched with a DataLoader like the license dataloader, and only when the field is selected.
- A failure to read the estimate does not fail the category query (log and return `0`).

**Test:** Unit tests for the repository (parses the plan JSON, a malformed plan) and the loader (batching). `backend-e2e`: a category with seeded novels returns a non-negative estimate after `ANALYZE`; a query that does not select the field runs no `EXPLAIN`.

## Step 5 -- Category picker with suggestions in the novel form

**Description:** Replace the comma-separated text input of `NovelForm` with a combobox.

**AC**

- Typing debounces a `categoriesConnection(search, first: 10)` query and lists approved matches; picking one adds a removable chip; selected categories are not suggested again. The list loads more with `after` on scroll or a "More" action.
- Keyboard works (arrows, Enter, Escape, Backspace removes the last chip) and the field has accessible labels.
- `NovelFormValues.categories` stays `string[]`, so the create and edit pages keep their contract.
- With no match, the dropdown shows a "Request category" action (wired in Step 6).

**Test:** Unit tests (Vitest) with a mocked query hook; a Storybook story for empty, typing, no-match and selected states. No Cypress for this step.

## Step 6 -- Request a new category from the form

**Description:** The explicit request flow (D3, D4, D5).

**AC**

- "Request category" opens a `Dialog` with a name field prefilled from what the writer typed, the D4 text, and Submit / Cancel.
- On success the dialog confirms and closes, the typed text is cleared, and the category is **not** added to the novel.
- The 400 of D5 is shown inside the dialog with the normalized name from the message (not the generic `showApiError`), so the writer can go and pick it. Other errors use `showApiError`.

**Test:** Unit tests for the dialog and the form wiring (success, duplicate); Storybook story. `frontend-e2e` (Cypress): a writer requests a category from the create form and the novel is created without it.

## Step 7 -- Admin categories page

**Description:** A dedicated page for admins (D7).

**AC**

- Route `/admin/categories`, visible and reachable for admins only (linked from wherever the admin licenses page is linked). A non-admin gets the same treatment as on the admin licenses page.
- A cursor-paginated table (`categoriesConnection`, "Load more"): name, status, who requested it, `~approximateNovelCount`. A search box and a status filter (All, Approved, Pending).
- Every row has a pencil (edit) and a trash (delete) icon button at its end, each with an accessible label and a tooltip ("Edit category", "Delete category"). Pending rows also have an Approve button before them. The icons are inline SVGs like the rest of the app (no new icon dependency), styled as subtle gray icon buttons that turn blue (pencil) or red (trash) on hover, on the app's dark gray table and card style, so the rows stay calm and the actions are discoverable.
- The pencil turns the name into an inline input with Save and Cancel (Enter saves, Escape cancels). A name that already exists shows the 400's message with the normalized name next to the input.
- The trash opens a `ConfirmDialog` that names the category and says what happens: for an approved category, "It will be removed from about N novels" (the `approximateNovelCount`), for a pending one, that the request is rejected. The list refreshes after each action.

**Test:** Unit tests for the page (admin vs non-admin, pagination, filter, approve, rename including the duplicate error, delete with the confirm text for approved and pending). Storybook states. `frontend-e2e` (Cypress): admin approves a pending request, then the writer can pick the category in the novel form (real login flow, full journey).

## Step 8 -- Search page: paginated categories with counts

**Description:** The search page's category filter uses the connection and shows the estimates.

**AC**

- The category filter list loads the first page and a "Show more" action using `after`; include/exclude behavior is unchanged. Each category shows `~approximateNovelCount`.
- Only approved categories appear; there are no admin controls on this page.

**Test:** Unit tests for `SearchPage` / `CategoryFilter` (pagination, counts shown). Storybook state with counts.
