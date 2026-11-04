# Self-improvement log

## B1 - 2026-10-29

- `REQUIREMENTS.md` said not to commit each step; the user later asked for B1 to be committed explicitly, so it was committed on request.
- The repo has no `prisma/migrations` (it uses `db push`), and Prisma cannot express the partial unique index for `is_default`; B2 must enforce a single default in a transaction.
- `nx e2e backend-e2e` could not run: the frontend image build failed because `frontend:build` depends on `codegen`, which needs `apps/backend/schema.gql`, absent from the image. It failed independently of the B1 diff (introduced by `5edbd58`). B1 is verified by unit tests, lint and typecheck only.
- A Monitor waiting on `pgrep -f "nx e2e ..."` never fired because pgrep matched the monitor's own command line; the run had already finished.

## B2 - 2026-10-29

- Left uncommitted on request, for review.
- `nx e2e backend-e2e` still blocked by the frontend image build (see B1), so the new `license.e2e-spec.ts` is typechecked and linted but not run. Substitute used: a throwaway `postgres:17.11` container, `prisma db push`, the real seed, and a temporary script driving `LicenseService` (deleted afterwards). It caught a real race that the mocked unit tests could not: concurrent `upsert` of the same new text hit a `text_hash` unique violation.
- A step with raw SQL or concurrency behaviour needs a real-Postgres check even when e2e is available, mocks cannot show it.

## B3 - 2026-10-29

- Left uncommitted on request, for review. `backend-e2e` is still blocked by the frontend image build (see B1), so `platform-terms.e2e-spec.ts` and the fixture change are typechecked and linted but not run.
- Substitutes that paid off: `nx build backend --prod` to prove the `.md` asset lands next to `main.js` (a unit test cannot, `__dirname` differs when bundled), a throwaway real-Postgres script for concurrent accepts and the version-bump re-prompt, and a throwaway `NestFactory.createApplicationContext` to prove `@UseGuards(Class)` resolves its dependencies inside another module (`@nestjs/testing` is not installed).
- A new guard on existing mutations breaks every e2e spec that uses those users; the fixture now accepts the terms once per user, and one extra user (`writer3`) stays unaccepted so the gate itself stays testable regardless of spec order.

## F8 - 2026-10-29

- Left uncommitted on request, for review. Frontend unit tests only (`nx test frontend`, lint, tsc); no Cypress or Storybook story, since the permission check is already covered by `backend-e2e`.
- Running `npx vitest` directly in `apps/frontend` fails two specs with "VITE_SERVICE_URL is not defined"; `nx test frontend` loads `.env` and passes. Use the Nx target.
- jsdom's `querySelectorAll` with a selector list returns elements grouped per selector, not in document order, which broke the focus-trap test; sort by `compareDocumentPosition` instead of trusting it.
- A global error reaction (reopen on `PLATFORM_TERMS_NOT_ACCEPTED`) wired inline in `main.tsx` cannot be tested; keep the logic in a function under the feature folder and let `main.tsx` only call it.

## B4 - 2026-10-29

- Left uncommitted on request, for review. `license.e2e-spec.ts` gained a detail and list case but cannot run (see B1).
- lint-staged runs Prettier on `*.md` at commit time, so a hash-pinned markdown file (`platform-terms.md`) changed after its hash was computed and B3 landed with a failing `platform-terms.md.spec.ts`. The suite was last run before the commit. Re-pinned in this step. Rule for next time: after a commit whose hook may rewrite files, rerun the unit tests, and run Prettier on a hash-pinned file before computing its hash.
- A field resolver that injects a request-scoped dataloader goes in its own resolver class (`NovelLicenseFieldResolver`), not in `NovelResolver`, or every query on the large resolver becomes request-scoped.

## F9 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (`nx test frontend`, lint, tsc); no Cypress spec, no browser check.
- The step text assumed a license list and an `officialUrl` that the API does not have yet (the canonical registry arrives with B5). The form therefore offers the license in use (default on create, the novel's own on edit) with an editable text that becomes a FORKED or CUSTOM draft, and the novel page shows no canonical link. Check an AC's data needs against `schema.gql` before building on it.
- "Draft with assistant" is an optional prop on the form that renders only when given; the pages do not pass it until F1-F7 exist.

## F10 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (`nx test frontend`, lint, tsc, `nx build frontend` to confirm the lazy chunk); no Cypress or browser check, and the real `setDefaultLicense` call is only covered by the B2 e2e spec, which cannot run (see B1).
- Same gap as F9: there is no API to list stored licenses, so "pick another existing license" is not possible. The screen only takes text; typing a text that is already stored reuses that row (the server dedupes by text hash).
- `ConfirmDialog` hard-coded "Deleting..." on its confirm button; it now takes an optional `loadingLabel` with that default, so existing specs are untouched.
- Not done on purpose: a header link to the screen (F11 owns navigation); it is reachable at `/admin/licenses`.

## F11 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (frontend 190, backend 652, lint, tsc); no browser or Cypress check.
- The AC needs "accepted-on date", which `myPlatformTermsStatus` did not return. Added `acceptedAt` (ISO string, null unless the required version was accepted) to the backend status; a frontend step can need a small backend change, so read the operation's schema before building the UI on it.
- The terms modal links to `/licenses` and the gate steps aside on that route (writers can read it, the backend guard still blocks writing). That needed the gate inside the router, so `App` now wraps all routes in a root route that renders the gate beside the `Outlet`.
- Route is `/licenses` (resource path); the admin screen stays at `/admin/licenses`, linked from the default-license tab for admins.
- A spec that mocks the generated module with a bare factory breaks on any component importing an enum from it; spread `vi.importActual` first.

## B5 - 2026-10-29

- Left uncommitted on request, for review. Built twice: first with the backend storing conversations, then reworked onto Fithara 2.0.0 once it returned the history to send next time. The final shape is a stateless gateway: `draftLicense` takes the conversation and the draft from the client, forwards them, and returns the new `conversation`; the rate limit is a Redis counter (one new `RedisService.increment`, `INCR` plus `EXPIRE NX` in one transaction, checked against a real Redis 7 for the window not resetting). No tables, no conversation id; the JSON body limit is raised to 1mb for the long histories.
- Substitutes that paid off: a throwaway Postgres plus a fake Fithara server for the first shape, a throwaway Redis for the counter. `nx e2e backend-e2e` is still blocked (see B1), so the e2e cases are typechecked only.
- The decision moved twice (Postgres, then Redis with a TTL, then the browser) because the requirement text, written before Fithara could return a compacted history, said "stored by the backend". When a requirement implies server state, ask what the state is for before building the store.
- Nx cache trap: an Nx target whose only input is a file that an earlier target downloads is hashed before the download, so a version bump restored the old generated types. Uncache such targets (the Beatrice codegen target has the same shape and is still cached).
- `openapi-typescript` refused to install (peer `typescript@^5`, repo on 6); the generator is pinned in the Nx target through `npx` instead. A generated, gitignored file must also be excluded from ESLint, or `nx lint` reports hundreds of formatting errors that never appear in a PR.
- The AC lists no infra, but `draftLicense` cannot work in `start:dev` until a `fithara` Terraform module exists; `FITHARA_URL` points at a service that is not deployed yet.

## F1 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (`nx test frontend` 207, lint, tsc); no browser check.
- The step text said "typed client for the three endpoints"; after the gateway rework it is the backend's three GraphQL operations, so F1 is three documents (codegen makes the hooks) plus an error mapper from the backend's codes to UI states, tested over a mocked `fetch` through the generated fetchers.
- Auditing the earlier steps against the changed plan found one real gap (a canonical draft other than CC BY 4.0 cannot be saved, see B2) and two steps that can now do more than their ACs (F9, F10), because B5 added the canonical list.

## B2 / F9 / F10 follow-up - 2026-10-29

- Left uncommitted on request, with F1, for review. Changes to committed steps after the plan changed: (B2) a `CANONICAL` claim is now accepted only when the text equals the Fithara registry's text word for word (whitespace aside), and the row takes the registry's short name; any other text must come as FORKED or CUSTOM. (B2/B4) `License.officialUrl` is resolved from the registry, cached for an hour, `null` when the registry cannot be reached. (F9/F10) the license field offers the registry's licenses ("Start from"), saves an unmodified pick as canonical and an edited one as forked, and the novel page links the official text.
- Backend 700 tests, frontend 214, lint, tsc, schema and codegen pass; `LicenseService` resolving with the global Fithara module was checked in a throwaway Nest context, because unit tests mock every dependency.
- The B2 e2e case "an unknown text claims to be canonical" now needs Fithara in the cluster, which does not exist yet; it was replaced by one that does not (a canonical claim without its id). Verifying a real canonical claim end to end is blocked on the Fithara Terraform module.
- Found while auditing: when a plan changes mid-feature, grep the earlier steps for the assumption that changed (here "only the seeded text may be canonical") instead of waiting for the new step to hit it.

## I1 - 2026-10-29

- Left uncommitted on request, for review. Verified: `terraform test` for the new `fithara` module (5), `app` (24, with new cases) and `ollama` (2); `terraform fmt` and `terraform validate` of `envs/local`; the real image `9109679196/fithara:2.0.0` run with the module's environment answered `/health` (model and the catalog's window) and listed the four licenses. Not run: `npm run start:dev` / `stop:dev` twice and the backend e2e (cluster and memory limits; the PROCESS asks the user for the idempotence runs), so the pod's readiness, the Ollama image with two models and the new e2e cases are unproven in a cluster.
- Found by running the image: Fithara needs ~15-40 s to answer after its process starts (the catalog is read at boot), so the first readiness probe fails; the probe allows 36 failures at 5 s.
- A flaky F10 test (typing 40 characters key by key timed out at 5 s on a loaded machine) was changed to paste. A spec that types a long string should paste it.
- Known mismatch, not solvable in this step: Ollama serves `OLLAMA_CONTEXT_LENGTH` (32768) while Fithara trusts the catalog's window (131072 for llama3.2); it is recorded in `infra/README.md`.

## B6 - 2026-10-29

- Left uncommitted on request, for review. Built twice: first with licenses shared by every writer whose text was equal (a nullable globally unique `text_hash`), then reworked when the requirement became "never share between writers": `licenses` has an `owner_id` (`system` for the canonical licenses and the default, everybody else's own), `text_hash` is unique per owner, a writer can use only `system` licenses and their own, and the default is always `system`. Backend 730 unit tests, lint, schema generation, a throwaway Nest context resolving the new resolver with its guards, and a throwaway real Postgres (`prisma db push`, the real seeder and services).
- What the real Postgres showed that mocks could not: drafts with the same text coexist (null hash); one writer finalizing the same text twice, concurrently, ends in one real row and one id; two writers get two rows with their own names; a canonical text is one `system` row for everybody, and an unmodified canonical text sent as custom becomes that row; ten concurrent saves leave one consistent row; a save after finalizing is refused and leaves the real license alone; another writer cannot use a license id that is not theirs.
- The immutability of real licenses rests on one `WHERE`: every write to a draft names `isDraft: true` and the owner in an `updateMany`, and finalizing flips `isDraft` in the same statement, so a late save matches nothing.
- `getOrCreate` was split into `prepareNew` (the checks and the lookup) and `insert`, so finalizing a draft runs the same checks as saving a novel's license.
- A requirement about uniqueness has to name its scope. "Distinct licenses" was built globally, and two writers writing the same text then shared a row (and a name); asking "unique across whom" before the schema would have saved the rework.
- Not done: nothing removes drafts that were never finished (the 20-per-writer cap bounds them); the optional 90-day purge is left out. `createLicenseDraft` counts then inserts, so two simultaneous creates can reach 21. `license-drafts.e2e-spec.ts` is typechecked only (the e2e blocker, see B1).
- An automated review found that `createLicenseDraft(licenseId)` copied the text of any non-draft license, another writer's included; after the move to per-writer licenses it must be scoped like every other use of a license id. Fixed by using the same `findUsable(id, ownerId)` as a novel's `licenseId`, and the unscoped `LicenseService.findOne` was deleted so nothing can reach for it again. When ownership is added to a table, grep every lookup of its id, not only the ones the change touched.
- The draft list became `licenseDraftsConnection` (cursor-paginated like `novelsConnection`, ordered by last save then id) with `filters.ownerIds`: a writer omits it or names only themselves (anybody else is a 403), an admin omits it for every writer's drafts or names several; admins can read any draft by id but every write still names the owner. The pagination, the ordering after a save, backwards paging and the admin rules were checked on a real Postgres, since a mock cannot show that a compound `updatedAt, id` order works with Prisma's cursor.

## F2 - 2026-10-29

- Left uncommitted on request, for review. Frontend tests (37 for the assistant), lint, tsc, build; no browser check and no Cypress.
- Built as `use-license-assistant` (state) plus `ConversationPane` / `MessageList` / `Composer` and a thin `LicenseDraftingAssistant` that F3 extends with the draft pane and F7 mounts on a route. The conversation is exactly what the assistant returned last, shown and sent back unchanged; each turn is keyed by a hash of its text plus a counter for repeats (`pseudo-id.ts`).
- Built first with a separate transcript that never shrank and a detector for the summary turn to show a "summarized" note, and removed on review: the assistant already returns the condensed conversation, and its summary turn is an ordinary message the author can read, so the detector and the shared prefix constant were machinery for a state nobody needed to distinguish. Before adding a second copy of state and a way to detect a case, ask what the user sees if the data is just shown as it came.
- A failed send keeps what the author wrote: the composer clears only through the `onSent` callback the hook calls on success.
- Not done, belongs to later steps: the draft pane, disclaimers and recommendations (F3, F4; the hook already holds them), saving the conversation in `localStorage` (F5), the route (F7). The assistant's reply is plain text, not Markdown.
- A component prop named `role` trips `jsx-a11y/aria-role` even on a non-DOM component; name it for what it is (`author`).

## F3 - 2026-10-29

- Left uncommitted on request, for review. Frontend 255 tests (56 in the assistant feature), lint, tsc, build; no browser check and no Cypress.
- Built as `DraftPane` (title, body, status line, disclaimers, the permanent "not legal advice" statement), `DraftSourceBadge` (canonical: the short name and the official link; modified: "Modified from <short name> - not the same as the canonical license"; custom: "review with a lawyer"), `DraftBody` (memoized Markdown) and `DisclaimerList` (always open, no toggle), and `LicenseDraftingAssistant` now shows the two panes side by side. Short names and links come from the cached `canonicalLicenses` query, with the id as a fallback until it loads.
- "Without flicker" is three things, each tested: the pane never blanks while the next answer is pending, the rendered draft is memoized on its text so an answer that left it alone does not rebuild it (a mocked Markdown renderer counts the renders), and the change is announced in words in a status line instead of an animation or colour.
- Not in this step: editing the draft by hand (the hook can take one through `setDraft`, but no control calls it), the recommendation chips (F4), "Finalize" (F5/F7), saving. The permanent statement lives in the draft pane, which is always on screen; F7 may move it to a page-level banner.
- Rendering a list inside a pane broke an F2 test that asked for every list item on the page; query inside the region you mean (`within(log)`).

## F4 - 2026-10-29

- Left uncommitted on request, for review. Frontend 273 tests (73 in the assistant feature and the dialog), lint, tsc, build; no browser check and no Cypress.
- Built as `RecommendationChips` (for every suggested id: "Use <short name>" puts a sentence in the composer and "Read <short name>" opens the license), `CanonicalLicenseDialog` (what the license permits, limits and requires, its official link and its full text, with loading and error states), and a generic `components/Dialog` (a modal with Escape, the Close button and a click outside to close it, Tab kept inside, and focus returned to what opened it). The composer became controlled so a suggestion can fill it: a chip never sends anything, never replaces what the author wrote (the sentence goes on a new line) and moves focus into the box. A route was not needed: a dialog keeps the conversation on screen.
- Chips fetch the license list only when there is something to name; the first version fetched on every answer and silently ate a queued response in an older integration test.
- Two replacements of mine did nothing in the first pass and the type check could not tell, because Prettier had already re-wrapped the lines I was matching (props accepted but never used). After a scripted edit, assert the file contains the new text (grep for it) instead of trusting a clean `tsc`.
- Not in this step: the Finalize button and saving (F5/F7); `PlatformTermsModal` still has its own copy of the Tab-trap logic that `Dialog` now also has; moving it is a separate cleanup.

## F5 - 2026-10-29

- Left uncommitted on request, for review. Frontend 327 tests (the assistant feature: autosave under fake timers, storage, the whole flow over a routed `fetch`), lint, tsc, build; no browser check and no Cypress.
- Built: `useLicenseDraftAutosave` (saves the draft to the backend every `VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS`, default 5, only when it differs from what the backend has; one save at a time, a failed one retried at the next tick and shown as "Not saved. Trying again."), `session-storage` (the conversation and the draft id in `localStorage`, per writer, tolerant of blocked storage), `useLicenseAssistantSession` (create or resume a draft, discard, "Start over", finalize), `StartPanel` (Write my own, Customize <license> when one is given, the unfinished drafts), `FinalizeButton`, and a loader that reads the stored draft from the backend before the workspace starts. Finalizing and starting over save first, and refuse to go on when they cannot.
- The loader exists because the compiler lint forbids setting state from an effect: instead of an effect copying the loaded draft into state, a thin component fetches it and mounts the workspace with it as initial state. When a state-sync effect is the first idea, ask whether the parent can wait for the data.
- Not done, and why: no control to edit the draft by hand (the acceptance criteria do not ask for one, so the autosave only ever saves what the assistant drafted); the novel form and the route are F7 (this step added no import into them); the key is in `.env`/`.env.example` and reaches dev through the `VITE_` pass-through, but the production images do not bake it in, so they use the default of 5.
- A window of up to one interval of work can be lost if the tab closes right after an answer; the spec accepts it.

## F6 - 2026-10-29

- Left uncommitted on request, for review. Frontend 342 tests, lint (baseline 2 warnings), tsc, build; no browser check, no screen reader run and no Cypress.
- i18n has no library: `messages.ts` is a typed English catalog (a translation is another object with the same keys), `i18n.tsx` a provider with `useMessages()` returning `t(key, values)`. Errors carry a `messageKey` instead of a sentence. An ESLint override on the feature's components forbids literal JSX text and literal `aria-label`/`placeholder`/`title`/`alt`, so a new string cannot skip the catalog. Backend messages, the assistant's disclaimers, license texts and canonical ids are shown as they come.
- A pseudo-locale test (every message upper-cased and wrapped) walks the start panel, a conversation, the chips and the dialog, and fails on any catalog English; it also checks `canonicalId` stays untouched in requests.
- A11y: axe-core in jsdom on the start panel, a conversation, and the open dialog (colour contrast, and the page-level rules, are switched off because jsdom cannot compute them; the Tailwind pairs were chosen to be at least 4.5:1 by reasoning, not measured). Fixes: Markdown headings of a license are demoted three levels so the pane keeps one outline; only a failed save is a live region (saving and saved ticks would interrupt a screen reader); focus moves to the message box when a draft opens and to the start heading when it is left, but not on first mount.
- `DefaultLicenseTab` lives in the same folder but is a Licenses-page tab, so it is excluded from the string lint rule; translating it is not part of the assistant.
- Moving a status line out of `role="status"` broke four specs that located it by role; query by text and assert the role separately.

## F7 - 2026-10-29

- Left uncommitted on request, for review. Frontend 356 tests, lint (baseline 2 warnings), tsc, build; no browser check and no Cypress.
- Form: assistant in a wide lazy `Dialog` over the form (a route would lose the form's state); finalizing swaps the license field for the chosen license and submits `licenseId`. The submit guard also had to ignore the stale inline-license title once the field is gone, or an unnamed modified license would have blocked the submit invisibly.
- The AC asked for autosave on the form's own editor; not done on purpose (see REQUIREMENTS F7 note). The route `/licenses/draft` exists as asked, linked from the Licenses page so it is reachable.
- Boundary rule: D2 asked for an `index.ts` per feature, which AGENTS forbids in the frontend. The public files per feature are a map in the ESLint config. `no-restricted-imports` patterns with negation work on relative imports, checked with a throwaway file and then with `ESLint.lintText` in a spec; that spec needed the default jsdom environment because `vitest.setup.ts` touches `Range`.
- `DefaultLicenseTab` sits in `features/license-assistant` but is the Licenses page's tab; moving it was out of scope.

## Categories feature, Step 1 (2026-10-30)

- `REQUIREMENTS.md` says not to commit each step, so Step 1 is left uncommitted for review.
- Schema only: `CategoryStatus` enum, `status` (default `APPROVED`), `requester_user_id`, index `(status, name)`. The repo has no `prisma/migrations`; local and e2e use `prisma db push`, so the default is what keeps existing rows `APPROVED`. The seed is unchanged.
- Verified on a throwaway `postgres:17`: pushed the old schema, inserted two categories, pushed the new one; both rows `APPROVED`, index present. `--skip-generate` is not a `db push` flag in this Prisma (it prints help and exits 0, which looks like success); `--url` is needed when the schema has no URL. Backend unit tests 737 pass.
- Process change: none from one data point. The Test line said `migrate dev`, which does not apply here; the AC's migration wording should read "schema change" in later Prisma steps.

## Categories feature, Step 2 (2026-10-30)

- Left uncommitted on request, for review.
- New `modules/category` (types, input, service, resolver, spec files). `categories: [String!]!` removed with its repository/service code and tests; `search.graphql` and `SearchPage` read `categoriesConnection(first: 100)` and map `node.name`.
- The AC said "capped like `novelsConnection`", but that query has no cap (an omitted `first` is an unbounded `take`). The service now defaults to 20 and rejects outside 1..100.
- graphql-api-tester found two real bugs the unit tests (mocked Prisma) could not: Prisma's `contains` passes `%`/`_` to `LIKE` unescaped, and a non-UUID cursor reaches Postgres as a 500 that leaks Prisma internals. Both fixed with unit and e2e cases. For any new connection built on `buildCursorPaginationParams`, validate the decoded cursor and escape user search text.
- backend-e2e has no DB access, so D6 (a pending row hidden from non-admins) cannot be proven in Step 2; only "no error, no non-APPROVED rows" is asserted. The real check is in Step 3, after `requestCategory` exists.
- Frontend unit baseline: `ChapterContentEditor`/`ChapterEditPage` specs fail without `VITE_SERVICE_URL` and `feature-boundaries.spec.ts` is flaky, identical with my changes stashed.
- A throwaway vitest config with `globalSetup: []` reused the running `start:dev` cluster, and the dev stack picked up backend edits within seconds, so the fix loop was fast.
- `nx e2e backend-e2e` could not complete: the frontend image build (`RUN npx nx build frontend --prod`) fails with "Failed to load schema from ../backend/schema.gql", because the image copies only `apps/frontend` and `libs`, so `schema.gql` (git-ignored) is absent and the `backend:gen-graphql-schema` dependency is not in the container's task graph. Reproduced identically on a clean `git stash -u` baseline, so it is not caused by this step; it presumably only passed before through Docker layer cache. Instead the affected backend-e2e specs (`categories`, `novels`, `novel/*`, `platform-terms`) ran against `start:dev` through the throwaway config: 67 pass after removing the old `categories` test from `novel.e2e-spec.ts`. Cypress not run for the same reason. Not fixed here (out of scope); worth a separate fix, e.g. copying `apps/backend/schema.gql` into the builder stage.
- That run also exercised, for the first time, the backend-e2e specs edited for the earlier author-removal change; they pass.

## Categories feature, Step 3 (2026-10-30)

- `requestCategory`, `approveCategory`, `updateCategory`, `deleteCategory` in `CategoryService`/`CategoryResolver`; `createNovel`/`updateNovel` now accept only approved categories (`resolveCategoryIds` no longer creates). Roles via `@RequireRole` + `@RequireAcceptedTerms`, not CASL (no ownership to check). A request is `createMany({ skipDuplicates })` and a zero count is the 400, so concurrent requests cannot 500 (graphql-api-tester: 6 parallel identical requests gave exactly 1 success).
- Making novels reject unknown categories broke three existing backend-e2e specs that relied on implicit creation (`novel-management`, `novel-delete`); caught only by running them, not by unit tests. When a step tightens an API, grep the e2e specs for callers of the changed input before running the suite.
- graphql-api-tester follow-ups fixed in the same pass: stale schema descriptions ("created when missing"), and no length limit on names (now 50, 400).
- Not fixed, outside this step: a service-thrown `NotFoundException` reaches clients with `extensions.code = INTERNAL_SERVER_ERROR` (status 404 only in `extensions.status`); `novel(id)` does the same.
- backend-e2e specs do have database access (`ClusterFixture.queryDatabase`, used by `novel-delete`), contrary to what the Step 2 note assumed.
- Same frontend-image `schema.gql` problem as Step 2 blocks `nx e2e`, so the affected specs ran against `start:dev`: 88 pass (categories, novel/\*, novels, platform-terms). Left uncommitted until the user's review, then committed on request.

## Categories feature, Step 4 (2026-10-30)

- Left uncommitted on request, for review.
- `Category.approximateNovelCount`: `EXPLAIN (FORMAT JSON)` through `$queryRaw` with the id as a bound parameter (Postgres accepts parameters inside EXPLAIN over the extended protocol; the e2e proved it), a request-scoped DataLoader, a field resolver that only runs when selected. A failed or malformed plan is logged and counted as 0, so the list never fails.
- graphql-api-tester with `log_statement='all'` confirmed 0 `EXPLAIN` without the field and exactly one per category with it, and 20 parallel requests gave no errors. Cost is about one round trip per category (35 categories: +15 ms). The planner never estimates below 1 row, so a category with no novels shows 1; for `fantasy` the estimate equalled the real count (2) after `ANALYZE`.
- The tester's "item 2 fails" was only my wording ("not slower"); no code change was warranted. Next time phrase such a requirement as a bound.
- The tester needed fresh tokens after the cluster was recreated between runs; stale tokens are the first thing to rule out when a tester reports 401s.

## Categories feature, Step 5 (2026-10-30)

- Left uncommitted on request, for review. Frontend only, so no graphql-api-tester and no backend e2e; the new operation is validated by `frontend:codegen` against the schema.
- `CategoryPicker` (combobox with chips, "More" via `after`, "Request category" only when the form passes `onRequestCategory`), `use-category-suggestions.ts` (a `useInfiniteQuery` over the generated `useSearchCategoriesQuery.fetcher`; no codegen change), `useDebouncedValue`. `NovelForm` does not pass `onRequestCategory` yet, so the action is not visible in the form until Step 6 wires it; the picker spec and story cover it.
- Unit specs mock `./use-category-suggestions` (and the debounce) so the form specs need no `QueryClientProvider`. Adding a second `role="combobox"` broke the specs that located the State `<select>` by `getByRole('combobox')`; they use `getByLabelText('State')` now.
- Storybook "verify the stories" proxy (no browser): a temporary `composeStories` spec ran every `play` and caught two real mistakes in my stories that a green `build-storybook` did not: a seeded `endCursor: null` makes react-query treat the page as the last (`getNextPageParam` returning `null` means no more), and asserting a count right after typing raced the 300 ms debounce (use `waitFor`). Deleted the temporary spec afterwards.
- Baseline unchanged: `ChapterContentEditor` / `ChapterEditPage` specs fail without `VITE_SERVICE_URL`; `tsc` on the spec project has the same 4 errors with and without the change; `eslint apps/frontend/src` is only clean when `src/generated` is ignored.
- No real-browser check was done (no Cypress per the step's Test line).

## Categories feature, Step 6 (2026-10-30)

- Left uncommitted on request, for review.
- `RequestCategoryDialog` (opened by the picker's "Request category" through `NovelForm`, rendered next to the `<form>` like the assistant dialog so it is never nested in it). A 400 `BAD_REQUEST` message from the server is shown inside the dialog (it already names the normalized category); every other error goes to `showApiError`. After success the form remounts the picker (`key`) to clear what was typed, and the category is not added.
- Unit specs for the dialog and the form wiring; Storybook stories with a mock of the mutation hook through the existing `mockGeneratedGraphql` plugin. The `composeStories` proxy needs `await Story.run()` (it runs `beforeEach` and renders itself); calling `Story.play` by hand skips `beforeEach` and the stories look broken when they are not.
- Step 5 had broken `manage-novel.cy.ts` (it typed into the removed comma-separated field) and I had not run Cypress then; fixed here (pick `fantasy` from the picker). The same journey also failed on `cy.get('select')` matching two selects (the license field added one earlier), fixed with `cy.contains('label', 'State').find('select')`. Lesson: when a step replaces a form control, grep the Cypress specs for its placeholder/selector even if the Test line says "no Cypress".
- Cypress ran for real against `start:dev` (`cypress run --project apps/frontend-e2e --spec ...`): `request-category`, `manage-novel`, `search`, `home` pass. A fresh stack puts the platform-terms modal in front of the writer, so the first run failed with an overlay covering every element; running any backend-e2e spec first accepts the terms for the same Writer user (the backend-e2e fixture does it). The Cypress specs do not accept the terms themselves, so they pass in a fresh cluster only if something accepted them earlier; worth a separate fix (a `cy.login` step or a command that accepts them through GraphQL).

## Categories feature, Step 7 (2026-10-30)

- Admin page `/admin/categories` (`features/admin-categories`): infinite list with search, All/Approved/Pending filter, Approve, inline rename, delete with a `ConfirmDialog` (estimated novel count for approved, "rejected" for pending), header menu link for admins. Icons from `lucide-react` (added to `package.json`, on the user's instruction) instead of hand-written SVGs.
- Backend additions this step: `categoriesConnection` filters by a `statuses` list instead of one `status` (an admin needs "all"; others are still forced to approved), and `Category.requesterUserId` (renamed from `requestedById` on the user's request, column `requester_user_id` too), returned only to admins by the field resolver.
- Verified for real: 786 backend and 391 frontend unit tests, 7 Storybook stories through a temporary `composeStories` spec, 86 backend e2e tests, and the Cypress journeys `admin-categories` (writer requests, admin approves, writer uses it, admin deletes), `request-category`, `manage-novel` and `search`.
- Found by Cypress, not fixed: the ingress sends the `/admin` prefix to ZITADEL's admin API (`modules/zitadel/outputs.tf`), so loading or refreshing `/admin/categories` (and the existing `/admin/licenses`) gives ZITADEL's 404; only in-app navigation reaches the app. The Cypress journey therefore opens the page through the user menu. Needs a decision: move both pages to a prefix the ingress does not claim, or route those paths to the frontend.
- Cypress lessons: two users in one test make ZITADEL show a hybrid login page (one `it` per user, `cy.login()` restores the cached session); a Cypress run that picks a category from the first page of the picker depends on how many categories earlier runs created (search for it instead); the dev stack's frontend image must be rebuilt (`stop:dev`, `start:dev`) after adding an npm dependency, or the page fails to import it.
- A temporary `composeStories` spec that mocks `generated/graphql` with a module that itself re-exports `generated/graphql` loops forever; mock with `importActual` plus overrides in the temporary spec.

## Categories feature, Step 8 (2026-10-30)

- Left uncommitted on request, for review. Frontend only.
- `SearchPage` reads `FilterCategories` (30 per page, `approximateNovelCount`) through `useFilterCategories` (`useInfiniteQuery` over the generated fetcher); `CategoryFilter` takes `{ name, approximateNovelCount }[]`, shows `~N` (compact: 1203 as ~1.2K) on every chip, and a single "Show more categories" button under both groups, so `search.cy.ts`'s "first button after the heading" selectors still hold. The old `GetCategories` document is gone. The picker's hook and the admin page's hook were not reused (different fields and page sizes; counts cost an `EXPLAIN` each, so the picker does not ask for them).
- New unit specs for `CategoryFilter` and `SearchPage` (there was none for the page), a `CategoryFilter` story file (4 stories, run through a temporary `composeStories` spec), Storybook builds, `search.cy.ts` passes against `start:dev` and a screenshot of the page was checked by eye.
- Seed data shows `~7` for both categories before an `ANALYZE`: the planner estimate on a table that was never analyzed is a guess. Expected, and what the "approximate" wording is for.
- No browser check of "Show more" itself: the dev database has far fewer than 30 categories. Paging is covered by the unit specs and, at the API, by `categories.e2e-spec.ts`.
- `feature-boundaries.spec.ts` failed once in the full run and passed alone: the known flaky one.

## Radix UI and a visual refresh (2026-10-31), outside `REQUIREMENTS.md`

- Left uncommitted for review. On the user's instruction: Radix UI is the main UI library, sonner is gone, and the look was modernized.
- Radix replaces: sonner (a `Toaster` over a small store in `utils/notification.ts`, same `showApiError`/`showSuccess`/`showInfo` calls), `Dialog`, `ConfirmDialog`, the platform-terms modal (with `Checkbox`), the settings confirmation, the header user menu (`DropdownMenu`), the licenses `Tabs`, the admin status filter (`ToggleGroup`), the search chips (`Toggle`) and `title` hints (`Tooltip`). Kept as they were: `CategoryPicker` (Radix has no searchable combobox), the native selects, `Button`, the word-explain popover (anchored to a text selection).
- Radix dialogs do not put focus back on whatever opened them (only on their own `Trigger`), so `useRestoreFocus` captures the active element on first render and restores it in `onCloseAutoFocus`; without it focus is lost on close.
- Test lessons: jsdom needs `hasPointerCapture`, `setPointerCapture`, `scrollIntoView` and `ResizeObserver` stubs (`vitest.setup.ts`); a modal Radix dialog hides the page behind it from role queries (assert that, or pass `hidden: true`) and sets `pointer-events: none` on the body, and user-event caches that check per element across tests, so click the body with `fireEvent.pointerDown` or `pointerEventsCheck: 0` in a fresh file; Radix `Tooltip` does not close on `unhover` in jsdom (use Escape); `role="menuitem"` replaces the old buttons, so the Cypress `logout` command and the `title`-based selectors changed.
- The refresh is mostly one file: Tailwind 4 `@theme` in `styles.css` redefines `gray` (ink), `blue` (dusk accent) and `white` (paper), so every utility already in use changes together; Literata (titles, novel titles, chapter text) and Instrument Sans via `@fontsource-variable` packages; global `:focus-visible` ring; sticky blurred header; novel cards with a spine on the cover. The dev stack's frontend image has to be rebuilt after adding packages.
- A horizontal scrollbar in the Cypress screenshots came from a floating SVG widget in the page (not from the app: `scrollWidth` equals the viewport width), so it was left alone.
- Cypress `novel.cy.ts` fails in this dev database only because my own earlier runs created novels with no chapters that sort before the seeded one.

## Writer Access Requests, Step 1 (2026-10-31)

- Machine user, PAT and `ORG_USER_PERMISSION_EDITOR` (an org role, so `zitadel_org_member`, not `zitadel_instance_member`) in `modules/zitadel_config` behind `backend_access`; `ZITADEL_MANAGEMENT_PAT` reaches the backend from `envs/local`, and from `envs/hetzner` through `envs/hetzner-zitadel`. Committed at the user's request despite the note in `REQUIREMENTS.md`; the idempotence runs of `start:dev`/`stop:dev` were not done by then.
- The requirements named only the local path; production is a separate env (`hetzner-zitadel`) that the AC missed. Grep `infra/terraform/envs` for every env that consumes a module before writing an infra AC.
- A Bash call the user rejected had still been applied; re-running a scripted edit duplicated the blocks. After a rejection, check `git status`/`git diff` before retrying an edit script.

## Writer Access Requests, Step 2 (2026-10-31)

- `ZitadelManagementClient` (v1 management endpoints: grants `_search`, `POST`/`PUT` grant); the update is skipped when the grant is already exactly `[role]` because ZITADEL errors on a no-op update. The project id had no source in the requirements, so `ZITADEL_PROJECT_ID` is generated like the client id, in `envs/local` and `envs/hetzner`.
- I first made the two new settings optional by copying `ZITADEL_PAT`, which is only optional because of its `_FILE` alternative; the user pointed out the feature cannot work without them. Before copying a setting's optionality, check why it is optional. Committed at the user's request; no `start:dev` or e2e run yet, which is the first place a config-validation break would show.

## Writer Access Requests, Step 3 (2026-10-31)

- `REQUIREMENTS.md` assumed a `prisma/migrations` folder and that a partial unique index needs raw SQL; neither held. The repo used `db push` only, and Prisma 7.4+ declares partial indexes in the schema (`@@unique(..., where: raw(...))`, preview feature `partialIndexes`). Started `prisma/migrations` (baseline plus this table), production keeps `migrate deploy`, dev keeps `db push`; the documented `migrate deploy --schema=...` fails under Prisma 7 and became `--config=./apps/backend/prisma.config.ts`.
- I asserted "Prisma cannot express it" from memory and designed around it; the user corrected me with the docs. For a library capability claim, check Context7 before writing it into a plan or a schema comment, even when the installed version is recent.
- Verified on a throwaway `postgres:17`: `migrate deploy`, no `migrate diff` drift, the index behaves, and `db push` creates it too. Committed at the user's request.

## Writer Access Requests, Step 4 (2026-10-31)

- `writer-request` module: `requestWriterAccess` and `myWriterRequest`, both `@RequireRole(Role.user)`. Without it the role guard returns `true` when no role is required, so an authenticated account holding no project role would have passed; the user caught this. The AC said only "authenticated", so for a new operation decide the minimum role explicitly instead of leaving the guard's default.
- To test that gate, `zitadel_config` users can now omit `role` (no grant) and `envs/local-zitadel` has a `no_role` user; the e2e project cannot import `@smart-novel/shared` (`rootDir`), so its specs use literals.
- Committed at the user's request with `backend-e2e` and `graphql-api-tester` not run: the user's own `smart-novel` kind cluster was up and predated the new table, and `start-dev.sh e2e` refuses to start next to it. Only unit tests, lint and `tsc` ran. Ask for permission to run `npm run stop:dev` up front when `kind get clusters` shows a cluster.

## Writer Access Requests, Step 5 (2026-10-31)

- `writerRequestsConnection`, `approveWriterRequest`, `rejectWriterRequest`; separate approve and reject mutations kept on purpose (only reject takes a reason, only approve calls ZITADEL). Approve calls ZITADEL first and flips the status with a `status = PENDING` filtered `updateMany`, so a ZITADEL failure leaves `PENDING` and two admins racing end with one 400. The category page-size/cursor check moved to a shared `boundPagination` instead of being copied.
- The real-ZITADEL e2e approves a user, which would change the shared `user` that other specs depend on, so it uses dedicated `applicant` and `applicant2` accounts. Any spec that mutates an account's role needs its own account.
- Committed at the user's request with `backend-e2e` and `graphql-api-tester` still not run (the user's `smart-novel` cluster is up and predates the new table); only unit tests (838), lint, `tsc` and schema generation ran. Steps 4 and 5 have never met a real stack, so the first real run may find bugs the mocks hid.

## Writer Access Requests, Step 6 (2026-10-31)

- `features/writer-request/`: `RequestWriterAccessDialog`, a presentational `WriterAccessCard` (four states) and `WriterAccessSection` (role gate, query disabled for non-`user` roles), placed on the Settings page because the AC named no location. `generated/graphql.ts` is git-ignored, so only the `.graphql` document is committed.
- A character counter placed inside the `<label>` became part of the field's accessible name and broke `getByLabelText`; keep counters outside the label.
- Storybook proxies from `PROCESS.md` worked: `nx build-storybook` plus a temporary `composeStories` spec. Use `Story.run(element)`, not `render` + `play`: only `run` executes a story's own `beforeEach` (the mock outcome), which two stories needed.
- A direct `npx vitest run` in `apps/frontend` skips Nx's `.env` loading: `ChapterContentEditor` and `ChapterEditPage` fail with `VITE_SERVICE_URL is not defined`, and cold-ESLint/load timeouts hit `feature-boundaries`, `a11y` and `pseudo-locale`. Source `.env` and widen `--testTimeout` before suspecting the diff; all passed that way.

## Writer Access Requests, Step 7 (2026-10-31)

- `features/admin-writer-requests/`: page at `/admin/writer-requests`, row with one-click Approve, reject dialog with an optional reason, status filter and load more; admin-only header links (desktop and mobile). An approve error keeps the row and says the request stays pending; a 400 means it was reviewed meanwhile, so the list refreshes.
- The ingress sends the `/admin` prefix to ZITADEL's admin API, so loading `/admin/writer-requests` directly or reloading it never reaches the app (documented in `admin-categories.cy.ts`; menu navigation works). I followed the AC's path and flagged it instead of changing the ingress. Read the Cypress specs of a sibling feature for such environment facts before choosing a route.
- Whole-feature status: Steps 1 to 7 are committed. `backend-e2e` and `graphql-api-tester` never ran for Steps 4 and 5 because the user's own `smart-novel` kind cluster was up and predated the new table; the real-ZITADEL approve test and the role-less `FORBIDDEN` test are unproven. That is the main open risk before this ships.

## Cursor Signing, Step 1 (2026-11-01)

- The cursor check (`isUUID`, 400 "Invalid cursor") moved from `boundPagination` into `buildCursorPaginationParams`, so every `paginateConnection` caller is guarded; `after` with `before` is now a 400 (it used to drop `before`). New `cursor-validation.e2e-spec.ts` covers all five connections.
- `REQUIREMENTS.md` says to leave each step uncommitted for review; followed it, nothing committed.
- Making the check universal broke two `license-draft.service.spec.ts` cases that used `cursor-row` as a cursor id. The mocked specs had been passing a value the real database would reject, which is the same blind spot as the original 500.
- Verification: 855 backend unit tests, `tsc` and eslint pass. `backend-e2e` did NOT run: `start-dev.sh e2e` fails twice at the frontend image build (`nx build frontend` runs codegen inside the image, and `apps/backend/schema.gql` is gitignored and not copied by `apps/frontend/Dockerfile`). Not checked on a clean `main`, so I cannot say whether it predates this step. The new e2e spec is unproven.

## Cursor Signing, Step 2 (2026-11-01)

- New global `CursorModule` / `CursorCodec` (`modules/cursor`): cursor is `<base64url {a,k}>.<base64url HMAC-SHA256>`, key from `CURSOR_SIGNING_SECRET` (`.env.example`, min 32 chars). `paginateConnection` now takes `codec` and `audience`; `encodeCursor`/`decodeCursor` are gone. `audience` is a per-connection constant for now, so Step 3 only has to widen it into the query fingerprint.
- `REQUIREMENTS.md` says to leave the step uncommitted for review; followed it.
- A new required env key breaks `validateEnvs` at boot for everyone with an existing `.env`; added the key to the local `.env` too (git-ignored).
- Not run: `backend-e2e` (same `start-dev.sh e2e` frontend-image codegen failure as Step 1, still unexplained). The new e2e cases (changed signature, cursor from another connection) are unproven.
- Pre-existing, left alone: `novels.e2e-spec.ts` "should return novels after a cursor" sends an unsigned cursor and only asserts HTTP 200, so it no longer exercises paging.

## Cursor Signing, Step 3 (2026-11-01)

- `buildAudience(connection, query)` (`shared/utils/cursor-audience.util.ts`): SHA-256 of canonical JSON (sorted keys, `undefined` dropped), base64url cut to 22 chars. Categories, license drafts and writer requests hash their Prisma `where` (so a condition added later is bound automatically); novels and chapters hash the arguments they hand to the repository (one shared `novelsQuery` / `chaptersQuery` per call, so a new filtering argument is bound automatically), because their `where` is built inside the repositories. Sorts fixed in code are covered by the connection name only.
- `REQUIREMENTS.md` says to leave the step uncommitted for review; followed it.
- Service specs that built cursors with a plain audience name had to use `buildAudience` too; every service spec got a "refuses a cursor issued for another scope before querying" case that also asserts the repository/Prisma call never happened.
- Not run: `backend-e2e` (same unexplained `start-dev.sh e2e` frontend-image codegen failure as Steps 1 and 2). The new e2e cases (chapters other order / other novel in `cursor-validation.e2e-spec.ts`, other writer in `license-drafts.e2e-spec.ts`) are unproven.

## Cursor Signing, Step 5 (2026-11-01)

- `INVALID_CURSOR_MESSAGE` moved to `libs/shared` (the backend codec and the frontend `isInvalidCursorError` read the same literal). `useResetOnInvalidCursor(queryKey, error)` resets an infinite list to its first page on that error; wired into the four infinite hooks (admin categories, admin writer requests, filter categories, category suggestions). `HomePage` keeps its cursors in component state, so it returns to page 1 itself. `gotchas.md` cursor line now points at the codec, `buildAudience` and the hook.
- `REQUIREMENTS.md` says to leave the step uncommitted for review; followed it.
- Skipped the Storybook story from the Test notes: Storybook has no `VITE_SERVICE_URL` (the `.env` is at the repo root, not under `apps/frontend`), so a story that clicks "Load more" runs the real fetcher and throws. Covered instead by a hook spec on a real `QueryClient` (first page, refused next page, first page again) and a `HomePage` spec that fails without the fix (checked by stashing `HomePage.tsx`).
- Full frontend run: `ChapterContentEditor.spec` and `ChapterEditPage.spec` fail on the untouched commit too (`VITE_SERVICE_URL` not defined in vitest). Two other files failed per run with a 5000 ms timeout, a different pair each time (`feature-boundaries`, `pseudo-locale`) and both pass alone: load, not this diff.

## Admin Dashboard, Step 1 (2026-11-01)

- `Novel.firstChapterCreatedAt` (nullable, indexed with `id`): set in `PrismaChapterRepository.createChapter` with `updateMany where firstChapterCreatedAt is null` inside the chapter transaction, recomputed in `deleteChapter` from the earliest remaining chapter. Named for what it stores after the user rejected `publishedAt` (the app has no publish feature). No backfill and no seeder change on the user's instruction (no production chapters, dummy seed), so seeded novels keep null.
- The user overrode `REQUIREMENTS.md`'s "do not commit" for this step and asked to commit it; `REQUIREMENTS.md` itself stays untracked.
- `nx e2e backend-e2e` did not run: the same frontend-image `schema.gql` codegen failure as earlier steps (reproduced once more, ~2 min wasted). Ran `novel-first-chapter-created-at`, `chapter-delete` and `novels` (16 tests) against `start:dev` with a throwaway config; graphql-api-tester passed all five requirements. `start:dev` takes more than the 10 minute foreground cap on a cold cluster, so it went to the background.
- A review comment asked whether the first-chapter case was handled: it is, through the `null` condition, which relies on the invariant "null iff no chapter". Worth a code comment if a reviewer asks again.
- Process change: `PROCESS.md` now names the `schema.gql` failure and its workaround; `SELF_IMPROVE.md` step 2c says to grep the log before re-diagnosing a repeat failure.

## Admin Dashboard, Step 2 (2026-11-01)

- `ZitadelManagementClient.findUser(userId)` (`GET /v2/users/{id}`, returns `{ name, email }`, null on 404 without an error log and for machine users); `request()` learned `GET` and a `notFoundIsNull` option. Display name first, then given plus family name.
- The planned infra change (widening the PAT's org role) turned out unnecessary: a live call from the backend pod with the existing PAT answered 200 for every seeded user. The Q15 premise was a hypothesis; `REQUIREMENTS.md` was corrected, and `PROCESS.md` now says to probe permission hypotheses live before building.
- Left uncommitted for review, as asked. No GraphQL surface, so no graphql-api-tester and no e2e (the client has no caller yet; Step 4 uses it).
- Live check: a throwaway `ts-node` script run from inside `apps/backend` (a script in the scratchpad cannot resolve `axios`) printed the profile of the seeded users against the running ZITADEL; deleted afterwards.

## Admin Dashboard, Step 3 (2026-11-01)

- `WriterRequestFiltersInput.search` (trimmed, max `WRITER_REQUEST_SEARCH_MAX_LENGTH` = 100, contains over `requesterName` or `requesterEmail`, case-insensitive, LIKE wildcards escaped) and a non-null `WriterRequest.userId`. `escapeLikePattern` moved from `CategoryService` to `shared/utils/like-pattern.util.ts`. An empty search leaves `where` exactly as before, so the cursor audience of the default query is unchanged.
- Committed on the user's request even though `REQUIREMENTS.md` says not to. The clean-state `backend-e2e` rerun was still pending at commit time (see below), so it is recorded here and not claimed.
- Adding `userId` to a shared e2e query broke an existing `toContainEqual` on the whole node (deep equality); a field added to a query that a spec compares as a whole object must be added to that expectation too (`expect.stringMatching(/^\d+$/)` for the ZITADEL id).
- The writer-request specs (`writer-request.e2e-spec`, `cursor-validation`) assume a database nobody has used: against a reused `start:dev` stack they failed on leftover requests ("never asked", "let a user request"), unrelated to this diff. The seven new search cases passed on the reused stack. A clean verification needs `stop:dev` and `start:dev` first (about 10 minutes).

## Admin Dashboard, Step 4 (2026-11-01)

- New `admin-novel` module: `adminNovelsConnection` (admin only) with filters (exact chapter count, first chapter date range, state, `ownerId`), `orderBy` on `firstChapterCreatedAt` (nulls last both ways), and per-row `estimatedChapterCount`, `license`, `owner { id name email }` through request-scoped dataloaders. Owner name and email: latest `WriterRequest` (index on `(userId, createdAt)`), else `ZitadelManagementClient.findUser`, logging `Owner <id> has no WriterRequest, asking ZITADEL`; a Grafana alert counts that line (> 5 in 15 minutes), covered by `observability.tftest.hcl`. The `EXPLAIN` helper moved from `CategoryService` to `estimateRows` in `modules/prisma`.
- The page is raw SQL with its own keyset, because Prisma cannot filter by a count and its cursor drops rows around NULL sort values. The first design (Prisma `findMany` plus an id list for the count filter) was rejected before writing code for that reason; the e2e spec pages one row at a time across the null boundary in both directions, which is the case that would have caught it.
- Found while testing: `buildAudience` hashed every `Date` as `{}` (fixed, with a test); an optional input argument with required validated fields fails with a 400 when omitted (fixed for the new input; the same defect makes the existing `chaptersConnection` cases of `cursor-validation.e2e-spec` fail, left alone as out of scope and recorded in `gotchas.md`); `writer-request.e2e-spec` "caller without a token" fails on `null` against `undefined` for the nullable `myWriterRequest`, unrelated to this diff.
- Verification: 934 backend unit tests, `tsc`, eslint, prettier, `terraform test` (observability, 9 runs). `nx e2e` still blocked by the `schema.gql` image build, so specs ran against `start:dev`: `admin-novels` 25, `writer-request-review` 22, `novel-first-chapter-created-at`, `chapter-delete`, `novels` earlier. graphql-api-tester passed all six requirements, including hostile `ownerId` and `state` input. Its minor notes: `after: ""` means no cursor, `first` and `last` together use `first`, and a fresh small novel shows an estimate of 2 whatever its chapters (planner default without statistics; expected for an `EXPLAIN` estimate).
- Left uncommitted for review, as asked.

## Admin Dashboard, migration rule (2026-11-01)

- The user corrected the habit of adding a migration file in the step that changes the schema (two files by Step 4): one migration per feature, generated in the last step; `prisma db push` covers development and the e2e tests. Both migration folders were removed, `.github/CONTRIBUTING.md` (Prisma Migration Guide) states the rule, and `REQUIREMENTS.md` got a final migration step and lost the per-step migration lines. Future `REQUIREMENTS.md` files should end with that step, and no step before it creates a migration.

## Admin Dashboard, Step 4 (2026-11-01)

- `WriterRequest` became `Writer`: Prisma model and table (`writers`, columns `name` and `email`), enum `WriterStatus`, backend module `modules/writer`, GraphQL names (`myWriter`, `writersConnection`, `approveWriter`, `rejectWriter`, `requestWriterAccess` kept), shared constants, frontend features `writer` and `admin-writers` with the route `/admin/writers`, Storybook mocks, e2e specs `writer.e2e-spec.ts` and `writer-review.e2e-spec.ts`. User-facing wording still says "request" where it names the action. A script applied one ordered replacement list to contents and paths; the only follow-up edit was dropping the `@map` of the two renamed columns.
- All migrations were deleted in the same step (nothing is deployed): the Step 1 file, `20261031000000_init` and `20261031000100_writer_requests`; only `migration_lock.toml` stays until Step 12 writes one baseline.
- The user asked for the commit before the next step, so this step is committed although `REQUIREMENTS.md` says not to commit; the old Step 4 code (separate `adminNovelsConnection`) sits in `stash@{0}` for Steps 6 and 7.
- Verification: 901 backend unit tests, frontend writer/admin/app specs, `tsc` for both apps, eslint and prettier on the changed files, `nx build-storybook frontend`. Frontend full run: `ChapterContentEditor` and `ChapterEditPage` fail without `VITE_SERVICE_URL` as before, and three specs hit the 5 s timeout under load (`feature-boundaries` passes with a longer timeout). `nx e2e` still blocked by the `schema.gql` image build, so the specs ran against a restarted `start:dev` (clean database): `writer-review` 22/22, `novels` 5/5, `writer` 10/11 and `cursor-validation` 20/25, the failures being exactly the six known ones (`gotchas.md`: omitted `orderBy`; `myWriter` null against undefined without a token), unchanged by the rename.

## Admin Dashboard, Step 5 (2026-11-01)

- Pen names and the application history: `writers` has one row per user (`user_id` unique), `pen_name` (a `citext` column, unique, case-insensitive, keeps the typed case; first built as a lowercase `pen_name_key` column and replaced after the user asked for no sanitized copy), `applications` (`jsonb`, entries `{ note, appliedAt, rejectionReason, reviewedBy, reviewedAt }`) and no more `note`, `rejection_reason`, `reviewed_by`, `reviewed_at`. `requestWriterAccess(note, penName)` validates the pen name with `getPenNameProblem` from `libs/shared` (the form uses the same function), answers 409 `PEN_NAME_TAKEN` for a name another writer has, and a rejected user asking again appends an entry to the same row. Approve and reject fill in the review fields of the last entry under the row lock. `writersConnection.search` matches the pen name only. The dialog has the pen name field with the red border for three seconds and a notification.
- Found while building: `createGraphqlErrorFormatter` turned every 409 into `CONFLICT`, which would have hidden `PEN_NAME_TAKEN`; it now only remaps the generic `INTERNAL_SERVER_ERROR` code (spec added).
- The history column is parsed and checked every time it is read (`parseApplications`), and a malformed value fails the request instead of being overwritten.
- The review spec compares whole objects (`toStrictEqual`) and the old "keeping the old one as history" case no longer described the behavior (the row is reused now), so both were rewritten; the history is asserted from the database through `ClusterFixture.queryDatabase`. The taken-name case inserts a holder row with SQL instead of depending on which applicant is still a `user` (spec order is not fixed).
- Verification: 926 backend and 28 shared unit tests, 489 frontend (the two `VITE_SERVICE_URL` specs fail as before), `tsc`, eslint, prettier, Storybook build. `backend-e2e` against a restarted `start:dev`: `writer` 19/20 (the known `myWriter` null-against-undefined case), `writer-review` 23/23, `novels` 5/5. An edit to the review spec could not be rechecked on the same database (the applicants were writers by then), so the stack was restarted a third time (about 10 minutes each).
- graphql-api-tester passed all six requirements (invalid names, `PEN_NAME_TAKEN` in any case, search by pen name only, one row per user with the history in the column, two concurrent requests for one name give one winner, review behavior). One pre-existing quirk it found and this step does not change: three simultaneous `approveWriter` calls on one request give one winner, but a loser can reach ZITADEL's role grant before the row is claimed and fails with a 500 ("ZITADEL management API request failed with status 400") instead of "already reviewed". The order (ZITADEL first, row second) is the one chosen for the writer access feature so that a ZITADEL failure leaves the request pending; claiming first would change that, so it is reported, not fixed.
- Left uncommitted for review, as asked.
- Afterwards, on the user's request: the GraphQL `Writer` lost its top-level `note`, `rejectionReason` and `reviewedAt` and exposes `applications: [WriterApplication!]!` (`note`, `appliedAt`, `rejectionReason`, `reviewedAt`; `reviewedBy` stays in the database) so there is one source in the API too; the access card, the admin row and every query and fixture read the last entry. The stored shape was renamed `StoredWriterApplication` to free the name for the GraphQL class.
- Probes that settled design questions without touching the repo (scratch database in the dev cluster, dropped after): Prisma 7.7 accepts `@db.Citext` with the `postgresqlExtensions` preview feature, rejects `@@index(expression: ...)` and `@@check(...)` in `schema.prisma`, and `db push` leaves a hand-made expression index alone. `citext` equality through Prisma's `findUnique` is case-insensitive with the pg adapter (the three-case taken-name e2e passes).
- Decided afterwards: the `CHECK (jsonb_typeof(applications) = 'array')` goes in the last step (Step 13) as its own hand-written migration after the generated baseline, which stays untouched; the local stack and e2e (built by `db push`) do not get it.

## Admin Dashboard, Step 6 (2026-11-01)

- A novel references its writer: `novels.writer_id` is a required foreign key to `writers.id` (`ON DELETE RESTRICT`, indexed) and `novels.owner_id` and `novels.author` are gone. The repository includes `writer.userId` and hands it on as `INovel.ownerId`, so CASL, the services and the resolver keep reading `ownerId`; the two policies select `writer.userId` instead. `createNovel` looks the caller's writer row up by user id and fails with a logged `Writer integrity error` when there is none. `Novel.writer: NovelWriter` (pen name for everybody; name, email, status, createdAt and applications for admins only, null for the rest; non-admins only see an approved writer) is a field resolver with a request-scoped dataloader that asks once per page, per kind of viewer. A writer id without a row is a 500 plus the same log line. A Grafana rule on that line was built and then removed at the user's request: the foreign key makes a novel without a writer impossible, so there was nothing worth paging on.
- The seeder gives the writers and the admin a dummy `Writer` row (`APPROVED`, empty history, pen name `<First>_<Last>`): `envs/local-zitadel` outputs `seeded_writers`, `envs/local` passes it to the init Job as the `SEEDED_WRITERS` JSON setting, `writer.seeder.ts` validates it (`parseSeededWriters`, spec) and upserts the rows before the novels. `prisma.config.ts` now seeds with `ts-node -r tsconfig-paths/register` so the seeder can import `@smart-novel/shared`. `ZitadelManagementClient.findUser` (Step 2) was removed by reverse-applying that commit's code changes.
- The e2e specs had stale `author` inputs on `createNovel` (`license`, `license-drafts`): the field was not in `CreateNovelInput` for a long time and those cases were failing before this step; removing the author everywhere cleaned them, and they pass now.
- Verification: 946 backend, 28 shared unit tests, frontend (the two `VITE_SERVICE_URL` specs as before), `tsc`, eslint, prettier, `terraform fmt`/`validate`, the observability `terraform test`, Storybook build. `backend-e2e` against a restarted `start:dev` (`nx e2e` still blocked by the image build): `novel-writer` 8/8, `novels`, `novel-management` 14/14, `chapter`, `chapter-delete`, `categories`, `license` 14/14, `license-drafts` 21/21, `writer-review` 23/23, `writer` 19/20 (known), `cursor-validation` 21/25 (the known omitted `orderBy` cases). `novel.e2e-spec` "find a novel by ID" fails only because specs run earlier on the same database added chapters to the seeded novel (it expects the last chapter of a pristine seed), and `novel-delete` hit the 5 s test timeout while the stack was still warm and passes with a longer one. There is no `tftest` for `envs/local`, so the new setting is checked by `terraform validate` and by the seeder running.
- graphql-api-tester passed introspection, the seeded novel and the create/update payloads for all four kinds of viewer, ownership, the hidden REJECTED/PENDING writer (flipped back afterwards), delete and the foreign key. It could not count queries per page at runtime (no statement log, no `pg_stat_statements`), so one query per page rests on `WriterService.findForNovels` doing one `findMany` and on the dataloader spec. It also noticed GraphQL validation and FORBIDDEN errors are logged at ERROR with status 500 in the line; that is the existing formatter and was left alone.
- Left uncommitted for review, as asked.

## Admin Dashboard, Step 7 (2026-11-01)

- One novel list: `novelsConnection` gained the filters `chapterCount`, `firstChapterCreatedAt`, `state` and `ownerIds`, the `orderBy` (`NAME` default, `FIRST_CHAPTER_CREATED_AT` with the novels without a chapter last in both directions), a page of 20 by default and 100 at most, and `Novel.estimatedChapterCount` (planner estimate through the new `estimateRows`, a request-scoped loader). `NovelConnection.totalCount`, its field resolver, `_filterContext` and `countNovels` are gone. The page is raw SQL with its own keyset (`repositories/novel-page.sql.ts`: filters, order, "strictly after the cursor row" through a subquery on the row's stored value), and the novels are then loaded with their categories in that order. The category filter is two `EXISTS` subqueries with the old meaning; the owner filter joins `writers` on `user_id`.
- Brought back from the parked work: `estimateRows` and its spec, the cursor-audience date fix, the range validator, the `@IsOptional` order input. The parked `admin-novel` module itself is not used any more; `stash@{0}` can be dropped once the user is happy.
- The graphql-api-tester found a NUL character in a category name returning a 500 that leaks a Prisma message (PostgreSQL text cannot hold NUL). Fixed at the input (`@Matches` on `in` and `nin`, with an `eslint-disable` for `no-control-regex` because the control character is the point), with unit and e2e cases. Any new text filter that reaches SQL needs the same check.
- Verification: 991 backend unit tests, frontend (two `VITE_SERVICE_URL` specs as before), `tsc`, eslint, prettier. `backend-e2e` against the running stack: `novel-list` 32 cases (every filter as an anonymous caller and an admin, both orders and both directions paged one row at a time across the null boundary, cursors refused after a filter or sort change, the page cap), `novels` 5/5, `novel-writer` 8/8, `novel-management` 14/14, `novel-delete` 6/6. graphql-api-tester: seven of eight requirements plus the NUL bug, then fixed; paging checked with page sizes 1, 2, 3, 5, 7 over the scoped list and the whole table, ties in names included. Notes it made and left: `after: ""` means no cursor, `first` with `last` is accepted, and the estimate is rough on small data (1 for a 3-chapter novel).
- Left uncommitted for review, as asked.

## Admin Dashboard, Step 8 (2026-11-01)

- `/admin/novels` (lazy route, linked as "Manage novels" in both header menus) and `features/admin-novels`: `AdminNovelsPage`, `NovelRow`, `WriterPicker`, `use-admin-novels` and `use-writer-suggestions` (infinite queries with `useResetOnInvalidCursor`), `novel-filters.ts` (the form to the query filters) and `admin-novels.graphql`. Columns name, writer (pen name, name and email, the user ID when those are missing), state, `~` estimate, license, first chapter date; the date header has the up/down arrows with `aria-sort` and `aria-pressed`, pressing the active one goes back to the name order. Filters: state, chapter min/max, first chapter from/to (whole days in UTC), several writers by pen-name search with name and email shown in each suggestion; only the user IDs are sent. A range the server would refuse (max below min, end before start, a non-integer) is left out of the query and shown as an alert instead of an error. Delete uses `ConfirmDialog` with the novel and the pen name, the existing `useDeleteNovelMutation`, invalidates the list on success and keeps the dialog open with the error on failure. Load more, loading, empty and error states.
- Verification: 39 admin-novels unit and component tests (filters, hook, page, and four axe checks through `a11yViolations`: list, picker open and a pick, an announced wrong range, the delete dialog), the header spec, the full frontend run (533 pass; the two `VITE_SERVICE_URL` specs fail as before), `tsc` for app and spec projects, eslint, prettier, `nx build-storybook frontend` with 11 stories (the loading and failed ones start the fetch before the page mounts so that it joins it). Both documents were also run as an admin against the live backend with a throwaway spec: novels filtered and sorted, writers searched by pen name. The page was not opened in a browser: that needs the seeded admin password typed into the ZITADEL sign-in page, which was left to the user; a Storybook play function runner is not set up in this repo either, so the `play` steps are checked only by the build.
- Left uncommitted for review, as asked.

## Admin Dashboard, Step 9 (2026-11-01)

- `StatsSnapshot` (`stats_snapshots`, `day` unique), `StatsModule` with `StatsSnapshotService` (cron job registered at runtime from the validated `STATS_SNAPSHOT_CRON`, UTC, boot catch-up, idempotent `takeSnapshot`, failures logged), the `IsCronExpression` validator, the setting in `.env.example` and the Hetzner variables.
- Verification: backend unit suite (1023 pass) including the service, validator and config specs; `backend-e2e` `stats-snapshot` spec written (one row for today after boot, duplicate day refused by the unique index).
- Worth knowing: `nx test backend` fails at `fithara:codegen` (`npx openapi-typescript` needs the network); `npx vitest run` in `apps/backend` works. The Hetzner `terraform test` fails on `var.images["fithara"]`, not caused by this step. A comment saying "one row per UTC day, written once by the daily job" was wrong once the schedule is configurable; the unique `day` is the invariant, the cron decides which days exist.

## Admin Dashboard, Step 10 (2026-11-01)

- `contentStats` (live `EXPLAIN` estimates of novels and chapters, 0 and a warning when a plan cannot be read) and `statsSnapshotsConnection` (snapshots, `day` ascending, default 30, max 100, `filters { from, to }` as whole UTC days, `from <= to` validated, cursor audience carries the range), both `@RequireRole(Role.admin)`, in `modules/stats` (`ContentStatsService`, `ContentStatsResolver`), registered in `gen-graphql-schema.ts`. `IsNotLessThan` is now exported from the novel inputs for the range check.
- Naming: the first draft was `adminNovelStats*`, which put the audience in the name, unlike `writersConnection` and `approveWriter` that name the resource and keep the role in `@RequireRole`. Decided with the user: `contentStats` and, after a second look, `statsSnapshotsConnection` (plural node name plus `Connection`, like `writersConnection`; it mirrors the table and the `StatsSnapshot` type).
- Verification: 22 stats unit tests, 11 `backend-e2e` tests (`content-stats.e2e-spec.ts`, seeds March 2001 days and removes them), graphql-api-tester pass.
- Worth knowing: `queryDatabase` never throws, because `psql` exits 0 on a SQL error, so a test cannot rely on it to see a constraint violation; assert on the output (`ON CONFLICT ... DO NOTHING` printing `INSERT 0 0`) instead. Values with spaces in `.env` need quotes, or `source .env` breaks (`envs/local` strips them).

## Admin Dashboard, Step 11 (2026-11-01)

- `lightweight-charts` 5.2.1 (exact, released 2026-08-12; names checked in `dist/typings.d.ts`: `createChart`, `AreaSeries`, `LineSeries`, `LineStyle`, `ColorType`, `layout.attributionLogo`). In `features/admin-novels`: `ContentStatsCards` (two `ContentStatCard`s above the filters on `/admin/novels`), `ContentStatChart` (chart created once per series in `useEffect`, `chart.remove()` on cleanup), `content-stat-series.ts` (pure mapping: ascending unique `YYYY-MM-DD` days, the live estimate replaces today's snapshot), `format-estimate.ts` (`~1.2k`), `use-content-stats.ts`, two documents in `admin-novels.graphql`.
- Each card: headline with a tooltip saying it is a database estimate, its own 30/90 day toggle (`statsSnapshotsConnection(last)`), area chart of the exact days with today's estimate as a dashed continuation, a collapsible text table of the same values, a skeleton while loading, an error line that does not touch the table, and a sentence instead of a lone point.
- Verification: unit tests for the mapping, the formatter and the cards (chart mocked: jsdom has no canvas) with axe cases, the feature's 70 tests pass; Storybook built and the real chart checked in a browser (populated, single day, failed).
- Worth knowing: the app has only a dark theme, so colors are read from the theme tokens (`--color-blue-400`, `--color-gray-*`) when the chart is created and there is no light/dark switch to react to. The price scale shows decimals unless `priceFormat` is whole numbers. `pkill -f` with a pattern that appears in its own command line kills the shell that runs it; use `[h]ttp.server`. The frontend suite times out (5s) in several unrelated specs when the machine is loaded (cluster and builds running); rerun them alone before suspecting the change.

## Admin Dashboard, Step 12 (2026-11-01)

- One baseline migration, `prisma/migrations/20261101212942_admin_dashboard/migration.sql`, from `prisma migrate diff --from-empty --to-schema` (236 lines, unedited). It has the `citext` extension before `writers`, every enum, the unique indexes on `writers` (`UQ_writers_user`, `UQ_writers_pen_name`), `stats_snapshots` with `UQ_stats_snapshots_day`, and the `writer_id` foreign key (RESTRICT). The three deleted migrations held nothing Prisma cannot generate (a plain `tsvector` column with a GIN index, and a partial unique index that no longer exists), so nothing is lost. No data migration, no backfill; `CONTRIBUTING.md` needs no change.
- Verification, in a throwaway `postgres:17.11` container: `prisma migrate deploy` on an empty database applies it; `prisma migrate diff --from-config-datasource --to-schema` against that database reports no difference; the `\d` output of all ten tables is identical to a database built by `prisma db push` (the only extra index is `_prisma_migrations_pkey`).
- Worth knowing: Prisma 7 has no `--shadow-database-url` on `migrate diff` and `db push` has no `--skip-generate`; to prove "migrations equal schema", diff the migrated database itself with `--from-config-datasource`. `migrate diff --from-migrations` needs a shadow database configured in `prisma.config.ts`, which this project does not set.

## Admin Dashboard, Step 13 (2026-11-01)

- `prisma/migrations/20261101230000_writers_applications_is_array_of_objects/migration.sql`, hand-written, after the generated baseline (which is byte for byte unchanged): `CHECK (jsonb_typeof("applications") = 'array' AND NOT jsonb_path_exists("applications", '$[*] ? (@.type() != "object")'))`, with a comment that it exists in production only (the local stack and the e2e tests use `db push`). The `CONTRIBUTING.md` guide already says SQL Prisma cannot express goes in its own migration, so it is unchanged.
- The plan said only "is an array" because checking the entries was thought to need an `IMMUTABLE` function. That was wrong: `jsonb_path_exists` is immutable (`jsonb_path_exists_tz` is the stable one), so the entries can be checked as objects in a plain CHECK. The requirement text was corrected; the fields of an entry stay with `parseApplications`.
- Verification, in a throwaway `postgres:17.11`: both migrations apply with `migrate deploy`; `[]` and `[{"note":"x"}]` are accepted; `{}`, `null`, `"x"`, `[1]` and `[{"a":1},"x"]` fail with the constraint name; `migrate diff --from-config-datasource --to-schema` reports no difference (Prisma ignores the constraint); the baseline applied alone to another empty database works and creates no constraint.
- Worth knowing: `both` is a reserved word in SQL, so `CREATE DATABASE both` fails; `migrate deploy` creates a missing database on its own.
- Not verified: the backend running against a database that has the constraint (the local stack cannot have it).

## Ingress: ZITADEL on its own host (2026-11-01)

- Bug: a refresh or a pasted link of `/admin/novels` (and every other `/admin/...` page) answered `{"code":5,"message":"Not Found"}`. The ZITADEL module routed a list of path prefixes, among them `/admin` (for `/admin/v1`) and `/management`, to ZITADEL on the frontend's host, so the prefix swallowed the frontend's pages, and `/administrator` too (a prefix has no segment boundary). In-app navigation worked because the SPA router never asks the server. It had been there since the module was added; `admin-categories.cy.ts` worked around it by clicking through the menu.
- Fix: ZITADEL gets its own host, `auth.localhost` (module default; `internal_hosts = ["traefik"]` keeps the workloads in the cluster, which call it through the ingress Service name, working). The routes are `Host(...)` rules, with the login UI as the same hosts plus its path, and nothing is claimed on the frontend's host. `VITE_OIDC_AUTHORITY`, `ZITADEL_DOMAIN` and `ZITADEL_ISSUER_URL` point to `http://auth.localhost:8080`; the app's redirect URIs stay on `localhost:8080`. Only `envs/local` uses the module (Hetzner has an external ZITADEL), so Hetzner was never affected.
- Tests: a module test that no route mentions `/admin` or `/management`, `ingress-routing.e2e-spec.ts` (admin pages return the frontend, ZITADEL answers on its own host), `admin-categories.cy.ts` now loads `/admin/categories` directly. The Cypress login runs its ZITADEL steps inside `cy.origin`, in one self-contained function (`Cypress.require` needs an experimental flag).
- Verification on a fresh stack: 87 backend-e2e tests in six specs, three Cypress specs with real logins (categories, settings, manage-novel).
- Worth knowing: `*.localhost` resolves on its own in browsers, curl and Node, so the host needs no `/etc/hosts` entry (the stack already used it for Grafana and S3). Changing ZITADEL's external domain needs a fresh instance (`stop:dev`, `start:dev`). Two `start:dev`/`stop:dev` runs at once fail on the Terraform state lock; kill the earlier `terraform` first. `Cypress.env()` is deprecated in Cypress 15, so a constant is used.

## License management, Step 1 (2026-11-04)

- Built `licensesConnection` in `LicenseService.licensesConnection` (first put in a separate service, which was wrong: `WriterService` and `LicenseDraftService` keep theirs in the main service), `kind` as a field resolver derived from `isDraft`/`ownerId`, and unit plus `backend-e2e` specs. `tsc` and the 1060 backend unit tests pass.
- Not done: `backend-e2e` and graphql-api-tester were not run. A `smart-novel` kind cluster already answered on `localhost:8080`, which looked like the user's own dev stack, so it was left alone. `REQUIREMENTS.md` says not to commit; the tree is left uncommitted.
- Process change: `SELF_IMPROVE.md` item 2d, ask before replacing a running stack.

## License management, Step 2 (2026-11-04)

- Built `createLicense` (admin only): a `create` case in `LicensePolicy` and a mutation that calls `getOrCreate(input, 'system')`, so it reuses the existing validation and dedup and leaves the default alone. Unit specs for the policy and the resolver, five `backend-e2e` cases in `license.e2e-spec.ts` (permissions, no default change, same text twice, fake canonical, a writer using the new license on a novel).
- Not done: `backend-e2e` and graphql-api-tester were not run (a stack was already on `localhost:8080`, left alone). Step 1 was committed at the user's request; step 2 is left uncommitted for review, per `REQUIREMENTS.md`.
- Process change: `SELF_IMPROVE.md` item 2e; a scripted replace missed because prettier had reformatted the import, and only `tsc` showed it.

## License management, Step 3 (2026-11-04)

- Replaced `AdminDefaultLicensePage` with `AdminLicensesPage` at `/admin/licenses`: a `licensesConnection` table (scope, default badge, source, owner, updated), scope filter, debounced name search, "Load more" (the existing admin pages use it, so `REQUIREMENTS.md` was changed from "previous/next"), "Set as default" on shared rows, and a create dialog around `LicenseField` calling `createLicense`. "Manage licenses" is in the header menu (desktop and mobile). Uses `useConnectionList`, as `use-admin-tags` does.
- Verified: `tsc`, lint, specs for the page, the dialog and the header, `nx test frontend` (690 pass; one `feature-boundaries` case timed out under load and passes alone), `nx build-storybook frontend`.
- Not done: manual check in a browser and `frontend-e2e` (a stack was already on `localhost:8080`, left alone); the stories were only built, not played.
- Process change: `SELF_IMPROVE.md` item 2f.

## License management, Step 4 (2026-11-04)

- Added the `license-list` feature (`LicensesTab`, `LicenseTextDialog`, `use-licenses`): the first tab of `/licenses` is a `licensesConnection` table (name, scope, source, updated, default badge) with name search and "Load more"; a name opens a dialog with the text and the official link; the default license is a link above the table; admins also get "Manage licenses". `DefaultLicenseTab` and its tab are gone. `eslint.config.mjs` lists `license-list` and the renamed `AdminLicensesPage` (it still said `AdminDefaultLicensePage`).
- The list query fetches `text` and `officialUrl` for every row so a dialog needs no second call; there is no `license(id)` query. Up to 20 rows of up to about 20k characters per page.
- Bug from Step 3 fixed here: after "Set as default" the page invalidated `useDefaultLicenseQuery.getKey({})`, which does not match the no-variable hook key `['DefaultLicense']`; it now uses `getKey()` and the spec asserts it.
- `feature-boundaries.spec.ts` timed out on its first (cold ESLint) case in two full runs; its cases now have a 60s timeout.
- Verified: `tsc`, lint, specs for the tab and the page, `nx test frontend` was run before the timeout change (701 pass, the one failure being that timeout; the file passes alone, 10/10, after it), `nx build-storybook frontend`. Not done: browser check, `frontend-e2e`, the stories were not played.
