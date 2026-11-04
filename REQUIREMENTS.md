# License management

> Do NOT commit after a step is completed. Leave the working tree uncommitted so the changes can be reviewed first, then stop. This overrides step 7 of `PROCESS.md`.

Admins manage licenses in one table (shared, writers' personal ones and drafts) and can create shared licenses any writer can use. Writers browse the same list, limited to what they may use. No schema change, so no migration step.

## Decisions

- `licensesConnection` is a Relay connection. Filters follow `writersConnection` (`WriterFiltersInput`: optional enum plus a trimmed `search`, capped in `libs/shared`, page size default 20, max 100).
- `createLicense` is an admin-only mutation taking `LicenseDraftInput`. It stores a shared license (owner `system`), reusing the row when the text is already stored, and does not touch the default.
- `setDefaultLicense` keeps its signature. The UI uses its `licenseId` for "Set as default".
- Licenses are immutable: no edit or delete of a license (drafts keep their own discard mutation).
- Scope (`LicenseScope`, derived from `isDraft` and `ownerId`, never stored; `LicenseSourceType` says where the text came from, the scope says who may use it): `SHARED` (owner `system`, includes the canonical ones and the default, flagged by `isDefault`), `PERSONAL` (finalized, owned by a writer), `DRAFT`.
- Visibility: an admin sees every row. A writer sees `SHARED` and their own `PERSONAL` and `DRAFT` rows; another writer's rows are never returned.

## Step 1: `licensesConnection` (backend)

Extend `License` with `scope: LicenseScope!`, `isDefault: Boolean!`, `ownerId: String!` and `createdAt: String!`. Add `LicenseScope`, `LicenseFiltersInput { scope, search }` (search matches the name, case-insensitively, blank ignored), `LicenseConnection` and `LicenseEdge`. Add `LicenseService.licensesConnection(viewer, pagination, filters)`, ordered by `updatedAt` then `id`, descending.

- AC: an admin gets rows of all scopes and owners; a writer never gets another writer's `PERSONAL` or `DRAFT` rows, and naming no filter returns shared plus their own.
- AC: `scope` and `search` narrow the result; `first`/`last` and cursors page as in `writersConnection`; more than 100 is refused.
- AC: `isDefault` is true for exactly one row.
- Add the resolver to `gen-graphql-schema.ts` if a new resolver class is created.

### Test

Unit for the service (viewer scoping, filters, paging) and the filter input. `backend-e2e`: permission boundary (writer cannot see another writer's rows) and paging. Run graphql-api-tester on `licensesConnection`.

## Step 2: `createLicense` (backend)

Add `LicensePolicy` case `create` (CASL `Action.Create` on `License`; admins already have `manage`). Add `createLicense(input: LicenseDraftInput!): License!` under `@CheckPolicy('license', 'create')`, calling `getOrCreate(input, SYSTEM_LICENSE_OWNER)`.

- AC: an admin creates a license with `scope: SHARED`; a writer and a plain user are refused.
- AC: the same text twice returns the same row; a text claiming to be `CANONICAL` that is not the registry's is a 400.
- AC: the default license is unchanged.
- AC: a writer can then use the new id as `licenseId` on `createNovel`/`updateNovel`.

### Test

Unit for the policy case and the resolver. `backend-e2e`: admin creates, writer refused, writer uses the new license on a novel. Run graphql-api-tester on `createLicense`.

## Step 3: Admin licenses table (frontend)

Replace `AdminDefaultLicensePage` at `/admin/licenses` with a table backed by `licensesConnection`: name, scope badge, default badge, source, owner, updated. Scope filter, search and a "Load more" button (as `AdminTagsPage` and `AdminWritersPage` do). Row action "Set as default" (shared rows only, via `licenseId`, with the existing confirm dialog). "Create license" button opens a dialog using `LicenseField`, calling `createLicense`. Add "Manage licenses" to the admin header menu (desktop and mobile), next to "Manage tags".

- AC: the page is reachable from the header; non-admins see the permission message.
- AC: creating a license adds it to the table; setting the default moves the badge.
- AC: errors from either mutation show in the dialog.

### Test

Vitest spec for the page, Storybook stories for the table states (empty, loading, error, populated). No new Cypress spec: permissions are covered in `backend-e2e` (see CONTRIBUTING). Verify manually in the browser.

## Step 4: Licenses index page (frontend)

`/licenses` gets a "Licenses" tab (first) beside "Platform terms", showing a read-only `licensesConnection` table for writers (name, scope, source, updated). Row click opens a dialog with the full text and official link. The default license is a link above the table that opens the same dialog; the old "Default license" tab and its "Change the default license" link are removed. Admins see a link to `/admin/licenses`.

- AC: the default license is one click from the index and shows its text.
- AC: a writer sees no other writer's licenses.

### Test

Vitest spec and Storybook story. Verify manually.

## Step 5: Writers pick shared licenses (frontend)

In `LicenseField`, offer the shared and own personal licenses from `licensesConnection` next to the canonical list, submitting `licenseId` for an existing one and `licenseDraft` for new text.

- AC: a shared license created by an admin is selectable on the novel create and edit forms without knowing its id.
- AC: existing `LicenseField` and `NovelForm` spec expectations still hold (additive props with defaults).

### Test

Update the `LicenseField` and `NovelForm` specs and stories. Verify manually with an admin-created license.
