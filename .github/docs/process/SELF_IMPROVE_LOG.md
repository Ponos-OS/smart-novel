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
