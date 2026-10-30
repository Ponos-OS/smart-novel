DO NOT COMMIT EACH STEP, let me review it first.

# License Drafting Assistant UI, Novel Licensing and Platform Terms

**Primary goal:** Let authors (a) accept the platform's terms once (and again whenever they change), (b) converse with the license-drafting Fithara (`9109679196/fithara:1.0.0`, the headless backend -- `/home/mjb/projects/Ponos-OS/smart-novel/fithara`) to determine and draft a content license for their novel, and (c) have every novel carry exactly one license.

The assistant UI lives **inside the existing `smart-novel/apps/frontend/`** (see 0.2 and Decisions Log). There is no new SPA and no rename of `apps/frontend/`.

## Decisions Log

| #   | Decision                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Fithara is reached **only through `apps/backend`** (never from the browser).                                                                                                                                                                |
| D2  | Everything lives in `apps/frontend`, built as **self-contained feature modules** so it can be split into its own app later (see 6.1).                                                                                                       |
| D3  | The platform-terms consent is stored in **Postgres**, not Zitadel.                                                                                                                                                                          |
| D4  | Terms are a **versioned markdown file in the repo**; changing them means a redeploy. Not user/admin editable.                                                                                                                               |
| D5  | When the terms version changes, the UI re-prompts the author **once** at the next login/app load; no per-chapter prompt.                                                                                                                    |
| D6  | The "certificate" of a novel means **its license**: each novel references one row in a new `licenses` table.                                                                                                                                |
| D7  | A writer's licenses are **distinct by content hash within that writer** (the same writer never holds the same text twice); **writers never share a license**. The canonical licenses of the registry and the default are the exception: they belong to the system and are shared (D16). Real rows are immutable. |
| D8  | New novels default to **CC BY 4.0**. Only **admins** can change which license is the default.                                                                                                                                               |
| D9  | There are no existing novels (nothing deployed), so there is **no backfill**; the seed novel is simply updated.                                                                                                                             |
| D10 | Authors may change a novel's license at any time, and may customize an existing license or write one from scratch.                                                                                                                          |
| D11 | A **"Licenses & Terms"** page shows the current platform terms and the default license, so authors can read both outside the novel form.                                                                                                    |
| D12 | A license change is announced to readers with a **sticky notification** they close manually (no timeout). **No server-side tracking** of which license a reader saw, and no `license_changed_at` field or audit log (out of scope for now). |
| D13 | The assistant **conversation** lives in the **browser** (`localStorage`) and is exactly what Fithara returned last: shown as it is and sent back as it is, with no copy kept beside it. Fithara condenses a long history into a leading summary turn, and the author sees that turn like any other message. The backend stores no conversation. |
| D14 | A license **draft in progress** is stored in the **backend**, in the existing `licenses` table, as a row flagged `is_draft` and owned by its writer (`owner_id`). The writer creates it explicitly and gets its id, the frontend syncs it on an interval (`VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS`), and finalizing turns the row into a real license of that writer. A draft is mutable, has no hash, is never used by a novel (15.1), and only its owner can **write** it; **admins can read** every writer's drafts (list and by id). |
| D15 | Fithara runs **in the cluster** as an internal service, so the stack works end to end without an external Fithara (Step I1). |
| D16 | **Ownership.** Every license has an owner: the writer who made it, or `system` for the canonical licenses of the registry and the default. A writer can use the system's licenses and their own, never another writer's (a novel's license is still readable by everyone on its page). Nobody edits a real license in place; "updating" one means a draft from its text, finalized into a new or an existing license of the same writer, then set on the writer's own novel, and the changed `license.id` announces it to readers (D12). Only the **owner of a novel** (or an admin) changes that novel's license, and only an **admin** changes which license is the default or writes a new default, which is then a system license (D8). |

> **Important:** This specification describes product and UI requirements, not legal advice. The UI presents _drafts_, not binding legal instruments. All disclaimers and public-facing copy must be reviewed by qualified legal counsel before production use and we must visualize this to the user so they know what they're getting.

---

# Part 0 -- Scope and Boundaries

## 0.1 What the Backend Provides

The backend is a **stateless license-drafting assistant** reachable over HTTP. It:

- Hosts a curated, read-only registry of canonical content licenses.
- Accepts the full conversation history, current draft, and a new message on every call.
- Returns an assistant message, the (possibly updated) draft, recommendations, disclaimers, and the conversation to send next time (older turns condensed into a summary when it would outgrow the model's context window; the draft is never condensed).
- Holds no state between requests — the client must resend the conversation and draft every turn.

For the backend endpoints, request/response shapes, error codes you must download them and also build tooling around it so we can download the appropriate version which our frontend wanted to use from the `https://ponos-os.github.io/fithara/v2.0.0/openapi.json` URL.

### Decision D1: Fithara sits behind `apps/backend`

The browser never talks to Fithara. Reasons:

- Fithara is unauthenticated and LLM-backed, so exposing it invites cost abuse and scraping.
- The backend already authenticates users (Zitadel JWT + CASL), so it can enforce the platform-terms gate (Part 14) and rate limits per user before any LLM call.
- Fithara is stateless and so is the gateway: the browser owns the conversation (0.4) and the backend only forwards it, so there is nothing to persist, expire or clean up on the server.
- Fithara stays a standalone service with no knowledge of smart-novel; only the backend knows its URL (internal Docker network, not published through Traefik).

Shape: a **thin GraphQL mutation** (`draftLicense(input)`) that checks authentication, the role, the platform-terms gate and a per-user rate limit, then calls `POST /v1/draft` through the generated Fithara client (0.3) with the `conversation`, `draft`, `message` and `preferences` the client sent, and returns the assistant message, the draft, `draftChanged`, `recommendations`, `disclaimers`, `isReadyToFinalize` and the `conversation` Fithara returned. It stores nothing. The client can send a forged history; that only shapes that user's own answer (a user can already type anything as the draft), Fithara bounds its size and treats it as untrusted, and the backend validates its shape and size and rate-limits the user. `GET /v1/licenses[/{id}]` is exposed as GraphQL queries. Fithara errors are mapped to the backend's existing GraphQL error conventions; the Fithara `requestId` is logged and passed through for support. The JSON body limit of the backend is raised (1mb) so a request carrying a long conversation and a draft is not rejected.

This keeps Part 3 as written: the _frontend_ owns the conversation and the draft and sends them on every turn, through the backend instead of straight to Fithara. The frontend sends `{ conversation, draft, message, preferences }` and replaces its conversation with the `conversation` of the answer.

## 0.2 Two-layer Licensing Model

The consuming platform is responsible for a two-layer model:

1. **Platform License**: mandatory, granted by the uploader to the platform to host/display/distribute the work. Today the platform does not ask for it at all. It is collected through the one-time **platform terms acceptance** specified in Part 14 (a blocking modal for writers, backed by a Postgres record). Until a writer has accepted the current version they cannot use the writing features.
2. **Public License**: author-selected, determines what readers and third parties may do. The assistant (this doc) helps draft this layer only, and the result is stored in the `licenses` table and linked from the novel (Part 15).

**How the two layers relate:** they are independent and answer different questions.

- The **platform terms** (Part 14) are a grant from the author to smart-novel only: the right to host, display and distribute the work. They apply to every novel regardless of the public license, and they are what lets the platform publish at all.
- The **public license** (Part 15) is what the author tells everyone _else_: whether others may read it free, copy it, adapt it, republish it under another name, or use it commercially. It governs third parties and never limits what the platform may do, because the platform's rights come from the terms.

So no public license an author picks or writes can conflict with the platform's right to publish, and the terms text does not need to be reviewed against each license. Both texts still need legal review on their own (see the note at the top).

### Decision D2: one frontend app, modular features

The assistant is part of the author flow (create novel → choose license), so it should share auth, layout, theme and the terms gate with the rest of `apps/frontend`. A second SPA would duplicate login and fragment the author experience. To keep a later split cheap:

- Each concern is a folder under `apps/frontend/src/features/` (`license-assistant/`, `platform-terms/`, `admin-licenses/`) with a single `index.ts` public surface. Features do not import each other's internals.
- Each feature owns its routes, GraphQL documents, hooks, components, i18n namespace and tests. Shared things (auth, layout, UI kit) are imported from existing shared locations only.
- Routes are lazy-loaded (`React.lazy`), so `admin-licenses/` is code-split and not shipped to readers.
- Admin routes are guarded by `Role.admin`; this is UX only, the backend enforces authorization (Part 15).
- Features read config from props/context, not from global singletons, so mounting them in another app needs no changes inside the feature.

## 0.3 Backend endpoints available to the frontend

For this you must introduce tooling similar to Beatrice which enables us to not track their API definitions and also we must auto generate a Typescript client based on the OpenAPI spec file downloaded from `https://ponos-os.github.io/fithara/v<FITHARA_VERSION>/openapi.json` (currently `v2.0.0`; the version is pinned in `.env`). This must happen at build time and it must not be done manually by devs. In practice: an Nx target downloads the spec, another generates the TypeScript types (`openapi-typescript`), and a small wrapper over `openapi-fetch` is the client; the generated files are git-ignored and the codegen target is not cached (see `gotchas.md`).

## 0.4 Who owns which state

The frontend owns, in the browser (`localStorage`):

- The conversation: the `conversation` of the last answer, shown and sent back unchanged. It has no ids of its own, so the UI derives one per turn from a hash of its text (with a counter for turns that say the same) to key its list.

The apps/backend owns:

- Authentication, the role check, the platform-terms gate and the per-user rate limit in front of Fithara.
- The `licenses` table, the drafts in progress and their finalizing into a real license (`finalizeLicenseDraft`), and the novel inputs that use a license by id (Part 15).
- The **drafts in progress**, as flagged rows of the `licenses` table owned by their writer (D14, 15.1), synced by the frontend on an interval.
- It stores no conversation.

Fithara remembers nothing between calls. When the history is too long for its model's context window it condenses the older turns into a summary and returns the conversation to send next time; the draft is never condensed.

---

# Part 1 — Product Goals (Frontend-Relevant)

- Help non-lawyers understand what license fits their intent, via a conversational UI.
- Make the distinction between canonical, forked, and custom drafts visually unmistakable.
- Never hide disclaimers.
- Never claim to provide legal advice.
- Make the assistant's reasoning visible (its message accompanies every draft change).

Non-goals: determining copyright ownership, validating legal appropriateness, plagiarism detection, authentication of end users.

---

# Part 2 — Terminology

| Term              | Meaning                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Canonical License | An immutable, pre-written license hosted by Fithara (e.g. CC BY 4.0)                                   |
| Canonical ID      | Stable machine-readable identifier (e.g. `CC-BY-NC-4.0`)                                               |
| Draft             | The current license text the user is working on; either canonical, forked, or custom                   |
| Forked Draft      | A draft derived from a canonical license but with modifications; no longer equivalent to the canonical |
| Custom Draft      | A draft with no canonical base                                                                         |
| Conversation      | Full ordered list of user/assistant messages, owned and persisted by the client                        |
| Turn              | One `POST /v1/draft` call to Fithara in apps/backend                                                   |

---

# Part 3 — Frontend Responsibilities

The frontend owns:

- Conversation state: the conversation of the last answer (0.4), persisted to `localStorage` so closing the browser does not lose it.
- Current draft state: the writer creates a draft explicitly (`createLicenseDraft`) and gets its id; the frontend sends the draft to the backend (`saveLicenseDraft`) every `VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS` seconds (env variable, default 5) while it has unsaved changes, without any user action. On the next visit, on any device, the writer's drafts are listed (`licenseDraftsConnection`) and one is resumed by its id. "Finalize" (`finalizeLicenseDraft`) says the draft is finished and returns the license to put on the novel.
- Rendering the assistant's message, the current draft, and disclaimers.
- Deciding when a draft is "finalized" (Fithara has no concept of this): the author clicks "Finalize" and the frontend calls `finalizeLicenseDraft`; the answer's `isReadyToFinalize` is only a hint.
- Calling `draftLicense` on every turn with the conversation and the draft, and **replacing the conversation with the `conversation` of the answer**. When a long conversation is condensed, the older messages are replaced on screen by the summary turn, which is shown like any other assistant message; nothing else announces it.
- Displaying canonical license information (fetched from `GET /v1/licenses`).
- Handling `draftChanged` to decide whether to re-render the draft pane.
- Presenting `recommendations` as selectable chips/buttons that prefill a message.
- Sending the current draft as the author edited it, not the one of the previous answer.

The frontend must work against the backend without assuming it is the only client — no endpoint assumes a specific frontend, so don't build in coupling that isn't in the documented contract (e.g. don't rely on undocumented response fields or timing).

---

# Part 4 — Suggested React Component Tree

```
<LicenseDraftingAssistant>
  <ConversationPane>
    <MessageList />
    <Composer />
  </ConversationPane>

  <DraftPane>
    <DraftSourceBadge />          // "Canonical: CC BY-NC 4.0" / "Modified from CC BY-NC 4.0" / "Custom"
    <DraftTitle />
    <DraftBody />
    <DisclaimerList />
    <RecommendationChips />       // from response.recommendations
    <FinalizeButton />            // client-only action; may hand off to the platform
  </DraftPane>
</LicenseDraftingAssistant>
```

## 4.1 State shape (client-side)

```ts
type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

type DraftSource = {
  type: "canonical" | "forked" | "custom";
  canonicalId: string | null;
};

type Draft = { title: string; text: string; source: DraftSource };

type State = {
  conversation: ConversationTurn[];
  draft: Draft | null;
  disclaimers: string[];
  recommendations: string[];
  isReadyToFinalize: boolean;
  pending: boolean;
  error: string | null;
};
```

Persisted by the client under its own key/namespace. The backend sees this shape only as request payloads (`conversation`, `draft`, `message`, `preferences`) and stores none of it.

---

# Part 5 — UX Rules the Frontend Must Enforce

- Render `disclaimers` on every assistant turn. Do not hide them behind a toggle.
- When `draftChanged === false`, do not visually flash the draft pane.
- When `draft.source.type === "forked"`, show a clear "Modified from `<base shortName>` — not the same as the canonical license" banner.
- When `draft.source.type === "canonical"`, show the canonical short name and a link to `officialUrl`.
- When `draft.source.type === "custom"`, show "Custom license — review with a lawyer."
- "Finalize" is the author's decision, never Fithara's. On click, the client calls `finalizeLicenseDraft(id)` on the backend (not on Fithara) and gets back the final license, which it puts on the novel form. Use the returned license: its id may differ from the draft's (15.1).
- Accessible: keyboard navigable, labels, no color-only meaning, readable summaries, screen-reader friendly.

The UI must make this distinction clear somewhere prominent (e.g. persistent footer or intro banner):

> **Licence information explains permissions; it does not determine who owns the copyright, and it is not legal advice.**

---

# Part 6 — Implementation Steps

### Step F1 — API client

- Typed operations for the backend's GraphQL API (`draftLicense`, `canonicalLicenses`, `canonicalLicense`); the browser never calls Fithara.
- Error mapping from the backend's GraphQL error codes (`LICENSE_ASSISTANT_RATE_LIMITED`, `LICENSE_ASSISTANT_UNAVAILABLE`, `LICENSE_ASSISTANT_INVALID_REQUEST`, `PLATFORM_TERMS_NOT_ACCEPTED`, ...) to UI-friendly states.
- Tests (mock HTTP).

### Step F2 — Conversation pane

- Message list, composer, loading state.
- Sends the conversation + draft every turn and replaces the conversation with the answer's `conversation`, showing it as returned (a condensed history included); each turn is keyed by a hash of its text.
- Tests.

### Step F3 — Draft pane

- Renders draft with source badge.
- Renders disclaimers.
- Handles `draftChanged` without flicker.
- Tests.

### Step F4 — Recommendations and canonical details

- Recommendation chips that prefill a message.
- Modal or route to view a canonical license (`GET /v1/licenses/{id}`).
- Tests.

### Step F5 — Persistence

- Save/restore the conversation in `localStorage` (D13).
- Create a draft from a button ("Customize this license" / "Write my own"), keep its id, autosave it to the backend every `VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS` seconds (default 5; add the key to `.env.example`) only while it changed, and offer the writer's unfinished drafts to resume. One hook (`useLicenseDraftAutosave`) does the saving: the assistant uses it in this step and the novel form's license editor gets it in F7. A failed save is retried at the next tick and shown as "not saved" without interrupting the author; the start panel offers "Write my own", "Customize <the novel's license>" when it is given one, the writer's unfinished drafts (continue or discard), and "Start over" leaves a draft after saving it.
- "Finalize" calls `finalizeLicenseDraft` and puts the returned license on the novel form, which saves it through `licenseId`.
- Clear/reset control.
- Tests.

### Step F6 — Accessibility and i18n

- Keyboard, screen reader, contrast.
- Translation-ready strings; canonical IDs remain language-independent.
- Tests.

### Step F7 — Integration into consuming app

- Wire `<LicenseDraftingAssistant baseLicense onFinalized />` into the novel form: "Customize this license" passes the novel's license, and the license `onFinalized` returns becomes the form's `licenseId`; give the form's own license editor the same draft autosave.
- Mount `<LicenseDraftingAssistant />` inside `apps/frontend` behind a lazy route, as `features/license-assistant/` (D2). No global state assumptions.
- Tests, including a lint/dependency rule (e.g. Nx `enforce-module-boundaries` or eslint `no-restricted-imports`) that fails if a feature imports another feature's internals.

- Built as: `NovelForm` hosts the assistant in a wide `Dialog` (lazy-loaded) opened by "Draft with assistant", so the form's state survives; the finalized license replaces the license field and is submitted as `licenseId` (never together with `licenseDraft`), with "Use another license" to go back. `/licenses/draft` is a lazy route (writers only) linked from the Licenses page. The form's own license editor does not get the autosave: it edits inline text that is sent with the novel, and a draft row would be a second copy of it.
- D2's per-feature `index.ts` conflicts with the no-barrel rule for the frontend, so the public surface of each feature is a list in `eslint.config.mjs` (`featurePublicFiles`), enforced with `no-restricted-imports` and tested through the ESLint API.

### Suggested order

The consent gate and data model come first because everything else depends on them: **B1 → B2 → B3 → F8 → B4 → F9 → F10 → F11 → B5 → I1 → B6 → F1…F7**. F1–F7 talk to the backend GraphQL API (D1), not Fithara directly, so they follow B5; Fithara in the stack (I1) and the draft storage (B6) come before the assistant UI that needs them.

### Step B1 — Licenses table and novel license field ("certificate")

- Prisma model `License` (Part 15.1) and migration, plus `Novel.licenseId` (FK, `onDelete: Restrict`) and index `IDX_novels_license`.
- No backfill (D9): nothing is deployed, so `license_id` is created `NOT NULL` directly.
- Seed the CC BY 4.0 default license (`is_default = true`) before novels are seeded.
- Update the seeder (`prisma/seeders/novel.seeder.ts`) and the dummy novel `apps/backend/data/example-novel/details.json`: `details.json` gets a `"license": "CC-BY-4.0"` field and the seeder links the novel to that license row (falling back to the default when omitted).
- Tests: migration, seeder, uniqueness on `(owner_id, text_hash)` (per writer since B6).

### Step B2 — License resolution and default-license administration

- `LicenseService.getOrCreate(text, metadata)`: normalize → hash → upsert, returns the existing row when the text was already stored (D7).
- Novel create/update accepts a license (existing `licenseId`, or draft text/source that goes through `getOrCreate`); omitted means the current default.
- Admin-only mutation to change the default license (Part 15.3); CASL policy + resolver guard.
- Tests: dedupe, default fallback, non-admin rejected (policy spec + e2e).

### Step B3 — Platform terms and acceptance (backend)

- Versioned markdown terms file, loader, `PlatformTermsAcceptance` model, status query, accept mutation, enforcement guard (Part 14).
- Tests: version parsing, accept with stale version rejected, guard blocks unaccepted writers, re-prompt after a version bump.

### Step F8 — Terms gate (frontend)

- `features/platform-terms/`: blocking modal after login for writers who have not accepted the current version; accept → refetch status → unlock.
- A typed error from the backend guard (`PLATFORM_TERMS_NOT_ACCEPTED`) re-opens the modal (covers a version bump mid-session).
- Tests: modal shown/hidden, focus trap, keyboard, decline path, error-triggered reopen.

### Step B4 — Show license on novels (API)

- Expose `license { id, name, canonicalId, text }` on the `Novel` GraphQL type (Part 15.4).
- Tests.

### Step F9 — License on novels (frontend)

- Novel create/edit form: license selector (default preselected) with a "Draft with assistant" entry point (opens F1–F7 flow; Finalize returns the finalized license, which the form sets as the novel's `licenseId`).
- Novel page: license name, canonical link where applicable, and expandable full text; the Part 5 disclaimer is visible.
- Tests.

### Step F10 — Admin default-license screen (frontend)

- `features/admin-licenses/`: view the current default, pick another existing license or enter new text, with confirmation. Lazy route, `Role.admin` guard.
- Tests.

### Step F11 — "Licenses & Terms" page (frontend)

- Route in `features/platform-terms/` (terms tab) and `features/license-assistant/` (default license tab), composed on one page; reachable from the header and from the terms modal.
- Tests: both tabs render, default license text matches the API, accepted-on date shown.

### Step B5 — Fithara gateway (backend)

- Generated Fithara client at build time (0.3), a stateless `draftLicense` mutation (the client sends the conversation and the draft, the answer carries the new conversation), `canonicalLicenses` / `canonicalLicense` queries, the terms gate, writer-only access and a per-user rate limit (Redis counter) (D1).
- Tests with a mocked Fithara.

### Step I1 — Fithara in the stack (infra)

- `infra/terraform/modules/fithara`: only the inputs it needs and a `.tftest.hcl`, called from `modules/app` like the other components. Image `9109679196/fithara:${FITHARA_VERSION}` (the version already pinned in `.env`). An internal `ClusterIP` Service with no ingress route: only the backend reaches it (D1).
- Its LLM comes from the same switch as Beatrice's (`RUN_LOCAL_AI_MODELS`): the local Ollama, or the external endpoint and key of `terraform.tfvars`, with its own model in `.env`/`.env.example` (`FITHARA_LLM_MODEL`; the local Ollama image bakes it in next to Beatrice's). The model must be one the `llmcapa` catalog knows, or Fithara refuses to start. Ollama serves only the context length it is configured with; set it, or the window Fithara believes in is larger than the one served.
- `modules/app` hands the module's URL to the backend as `FITHARA_URL`, as it does for `BEATRICE_URL`; the pod waits for its LLM and has a readiness probe on `GET /health`. A positive line in the pod's logs proves it started, not just a `Running` pod.
- Tests: `terraform test` for the module; `npm run start:dev` and `npm run stop:dev` twice each to prove idempotence; a check that no module mentions `dev`, `local` or `kind`.
- Backend e2e that need no LLM call and that this step makes possible: `canonicalLicenses` returns the registry, and a canonical claim in a novel's `licenseDraft` is accepted for the registry's own text and rejected for any other (restore the B2 case that was replaced). Specs that call `draftLicense` on a paid provider stay opt-in (CONTRIBUTING).

### Step B6 — License drafts (backend)

- `licenses` gets `is_draft`, `owner_id` (not null, `system` by default), `updated_at`; `text_hash` becomes nullable and unique per owner, `(owner_id, text_hash)` (15.1, D7, D14, D16). The seeded default and every canonical license are `system`. Every existing read path ignores drafts: `getDefault`, `findOne`, `findByIds` (the dataloader), `resolve(licenseId)` and the dedupe lookup; a novel can never be given a draft, and `licenseId` on a novel is refused unless it is a `system` license or the novel owner's.
- `createLicenseDraft`, `saveLicenseDraft`, `finalizeLicenseDraft`, `discardLicenseDraft`, `licenseDraftsConnection` and `licenseDraft` (15.4), writer-only with the terms gate, the owner check on every write, admins reading every writer's drafts, and the limit of 20 drafts per writer. Finalizing reuses `getOrCreate`'s checks and may return an existing row (15.1).
- Tests: unit for the service and the visibility rules (a draft is invisible to every other path and to every other user; a writer cannot use another writer's license); a real-Postgres check that drafts with the same text do not collide, that two writers with the same text get two rows and one writer gets one, that concurrent finalizations of one text by one writer end in one real row, that a canonical text is one `system` row for everybody, and that concurrent saves of one draft end in one consistent row; a real-Postgres check of the cursor pagination (pages cover every draft once, backwards paging, a saved draft moves to the top); `backend-e2e` for the permission boundary (another writer cannot read, save, finalize or discard a draft, nor use its license; a writer naming another writer in `ownerIds` gets a 403; an admin reads and lists every writer's drafts but cannot save, finalize or discard them).

---

# Part 7 — Accessibility Requirements

- Keyboard navigation across conversation and draft panes.
- Semantic form controls.
- Accessible labels for all inputs.
- Licence meaning must not be conveyed by color alone.
- External links identifiable.
- Screen-reader-friendly summaries.
- Sufficient contrast.

---

# Part 8 — Internationalization

- All user-facing strings translatable.
- Canonical IDs remain language-independent.
- Canonical license _bodies_ are served by the backend in their authoritative language; translations, if any, are this consuming app's concern (the backend does not provide them).

---

# Part 9 — Testing Strategy

## 9.1 Frontend

- Component tests with mocked API.
- End-to-end flow: open → ask → receive draft → fork → finalize (`finalizeLicenseDraft`) → the novel uses the returned license.
- Accessibility tests (axe or equivalent).
- Persistence tests.

## 9.2 End-to-end (against a running backend, mocked LLM in CI)

```
Open assistant
 → Ask "what license lets people remix but not sell?"
 → Receive recommendation + canonical draft
 → Ask "what does section 3 mean?"
 → Draft unchanged, explanation returned
 → Ask "allow small indie authors to sell"
 → Draft forked, source.type = forked
 → Client finalizes (finalizeLicenseDraft) and uses the returned license
```

---

# Part 10 — Definition of Done (Frontend)

The frontend feature is complete when:

- The UI correctly renders canonical, forked, and custom draft states with the required badges/banners.
- Disclaimers are always rendered, never hidden.
- `apps/backend` forwards the client's conversation and draft to Fithara `POST /v1/draft` on every turn and returns the conversation Fithara sends back; the browser never reaches Fithara (D1).
- The conversation persists across a page refresh and a closed browser (`localStorage`); the draft persists on the backend, saved on an interval taken from `VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS`, and comes back on any device; the frontend replaces its conversation with the one Fithara returns and shows it as returned.
- A writer who has not accepted the current platform terms version cannot use writing features, in both the UI and the API (Part 14); a new terms version re-prompts exactly once.
- Every novel has exactly one license; new novels default to CC BY 4.0; only admins can change the default; the `licenses` table holds no duplicate texts (Part 15).
- Frontend test suite passes.
- Accessibility requirements are met (keyboard nav, labels, contrast, no color-only meaning).
- The frontend can run as a standalone SPA or be mounted inside an existing React app without modification to the backend.

---

# Part 11 — LLM-Assisted Development Instructions

An LLM implementing this frontend should:

1. Inspect the existing React app's conventions before making changes (component structure, state management, styling, testing).
2. Implement one step at a time, in the order given under "Suggested order" in Part 6 (B1 → B2 → B3 → F8 → B4 → F9 → F10 → F11 → B5 → I1 → B6 → F1…F7).
3. Run relevant tests after each step.
4. Do not proceed past a failing step without documenting the failure.
5. Do not assume the backend retains any state — always send full conversation + draft.
6. Never invent legal disclaimers; only render what the backend returns in `disclaimers`.
7. Prefer small, reviewable commits.

Required report format after each step:

```
Step: <number>

Implemented:
- ...

Files changed:
- ...

Tests:
- ...

Test result:
- PASS / FAIL

Known limitations:
- ...

Recommended next step:
- ...
```

---

# Part 12 — Future Extensions

Leave room for, but do not implement in v1:

- Streaming responses (if the backend adds `POST /v1/draft/stream`).
- Structured comparison of licenses in the UI.
- Export of drafts as PDF/DOCX.
- Integration with the consuming platform's finalization flow (webhook or callback).

---

# Part 13 — Summary of the Contract

```
Frontend owns:     rendering, composer input, finalization click, terms-gate modal, the conversation (localStorage), the autosave tick for the draft
apps/backend owns: auth, terms gate and rate limit in front of Fithara, terms acceptance, licenses table incl. the draft in progress (no conversation state)
Fithara owns:      canonical registry (read-only), LLM orchestration, response shaping, condensing a long history and returning the conversation to send next
Fithara never:     stores, remembers, writes, decides finalization, is exposed to the browser
Terms:             versioned markdown in repo, accepted once per version, stored in Postgres
Novel license:     exactly one license row per novel; rows immutable and deduplicated; default is admin-only
Canonical match:   rendered verbatim with source badge "Canonical"
Any modification:  rendered with "Modified from <base>" banner, source.type = forked
No base fits:      rendered with "Custom license — review with a lawyer" banner
Explanation turn:  draft pane does not change, no flicker (draftChanged = false)
```

---

# Part 14 — Platform Terms and Writer Consent

Goal: before a writer publishes anything, the platform has a recorded, versioned acceptance of the terms that grant it the right to host, display and distribute their work (the Platform License, 0.2). Nothing here is legal advice; the terms text itself must be reviewed by legal counsel.

## 14.1 Where it is stored (D3)

Postgres, not Zitadel. Zitadel user metadata would work with two organizations (metadata is attached to the user, whichever org they are in), but it was rejected because:

- It cannot hold evidence (timestamp, version history) and is a weak proof of consent.
- Only the backend can write it (Management API + PAT), so we would add a network call and a failure mode for no gain.
- It couples consent to the IdP; swapping the provider (`IAuthProvider` exists for that purpose) would lose it.

## 14.2 Terms source (D4)

- A markdown file in the repo (e.g. `apps/backend/src/modules/platform-terms/platform-terms.md`) with frontmatter:

  ```md
  ---
  version: 1
  ---

  # Platform License ...
  ```

- Loaded and validated at backend startup (missing or non-integer `version` fails boot). Changing the terms = edit the file, bump `version`, redeploy.
- Not editable through any UI or API.
- Recommended guard: a unit test that stores a hash of the text next to the version and fails if the text changes without a version bump.

## 14.3 Data model

```
platform_terms_acceptances
  id              uuid pk
  user_id         text        -- Zitadel `sub`
  terms_version   int
  accepted_at     timestamptz default now()
  unique (user_id, terms_version)
  index (user_id)
```

Append-only. A user has "accepted the current terms" when a row exists for `(user_id, currentVersion)`. Old rows are kept as an audit trail. Optional: store IP/user-agent; decide with legal before adding, since they are personal data.

## 14.4 API

- Query `platformTerms { version markdown }`: public text of the current version.
- Query `myPlatformTermsStatus { requiredVersion acceptedVersion accepted }`.
- Mutation `acceptPlatformTerms(version: Int!)`: rejects with a typed error if `version` is not the current one (prevents accepting a stale text the user saw before a deploy); idempotent for the same `(user, version)`.
- Guard on writer mutations (create/update novel, create/update chapter, license drafting): throws `PLATFORM_TERMS_NOT_ACCEPTED` when the user is a writer and has not accepted the current version. The check is one indexed lookup, cached per `(userId, version)` in the existing Redis (accepted state only, so it can never grant access wrongly). This keeps the backend cost low while still enforcing server-side; the UI gate alone is bypassable.

## 14.5 Frontend behaviour (D5)

- Applies to users for whom `isWriterOrHigher(roles)` is true (the same predicate as `useCanCreateNovel`). Readers are not asked.
- After login/app load, fetch `myPlatformTermsStatus`. If `accepted` is false, show a **blocking modal** (focus-trapped, not dismissible by Esc/backdrop) with the rendered markdown, an explicit "I have read and agree" control, and an Accept button. The writer cannot use writing features until it is accepted. A "Log out" action is offered as the only alternative.
- Show it once per version. After a version bump, the next load shows it again; a `PLATFORM_TERMS_NOT_ACCEPTED` error mid-session reopens it.
- Accessible: heading structure, labelled controls, keyboard operable, no colour-only meaning (Part 7). Strings translatable (Part 8); the terms body is served as written (no in-app translation).

## 14.6 Out of scope

Editing terms in a UI, per-chapter consent prompts, multiple terms documents, withdrawal-of-consent flow, and takedown handling.

---

# Part 15 — Novel Licenses ("certificate")

The novel's "certificate" is its **license**: every novel states the license under which it is published (e.g. "this novel is licensed under XYZ").

## 15.1 Data model

```
licenses
  id                    uuid pk
  name                  text            -- e.g. "CC BY 4.0", "CC BY-NC 4.0", "My custom license"
  text                  text            -- full license text
  text_hash             text null        -- sha256 of normalized text (D7); null while is_draft
  source_type           enum('canonical','forked','custom')
  canonical_id          text null       -- e.g. "CC-BY-NC-4.0" when canonical, or the base when forked
  is_default            boolean default false
  is_draft              boolean default false  -- a draft in progress (D14), see below
  owner_id              text not null default 'system' -- the writer who owns it; 'system' = shared by everybody (D16)
  created_at            timestamptz
  updated_at            timestamptz
  -- unique (owner_id, text_hash): a writer never holds the same text twice; it is also the index of a writer's licenses and drafts
  -- unique partial index so at most one row has is_default = true

novels
  license_id            uuid not null references licenses(id) on delete restrict
  index IDX_novels_license (license_id)
```

Rules:

- **Only distinct licenses per writer are stored (D7).** Text is normalized (trim, normalize line endings, collapse trailing whitespace) before hashing. The lookup for a text goes in this order: the `system` license with that hash (so an unmodified canonical text is always the canonical license), then the writer's own, then it is created for the writer. So one writer with ten novels under the same text has one row, and two writers who write the same text each have their own row, with their own name.
- **Rows are immutable, drafts excepted.** A license's text is never edited in place, because that would silently change the terms of every novel that references it. "Changing" a license means inserting/choosing a different row.
- **Drafts (D14).** A row with `is_draft = true` is a license being worked on. The writer creates it with `createLicenseDraft` (from a license or canonical license to modify, or from nothing for a custom one), receives its id, and every later save names that id; two tabs saving the same draft end with the last save. It has no `text_hash` (it changes on every save, and two drafts may hold the same text), so it is not deduplicated. It is mutable, and savable, finalizable and deletable by its owner only; it is readable by its owner and by admins (the draft list and the draft by id). It is invisible everywhere else: the default license, a novel's license, a lookup by id, a novel's `licenseId` and the dedupe lookup never see it, so a novel can never point at one.
- **Finalizing a draft.** `finalizeLicenseDraft(id)` runs the checks of `getOrCreate` on the draft (a `canonical` claim must equal the registry text, a `forked` one needs its base, a `custom` one has none), then makes it a real license: if the `system` or the writer's own license with the same text hash exists, that row is returned and the draft is deleted; otherwise the draft is promoted in place (`text_hash` set, `is_draft` false; a verified canonical text becomes a `system` license). **The id of the result can therefore differ from the draft's**, and the caller must use the returned license. The writer then puts it on a novel with `licenseId`; a draft is never linked to a novel.
- **Limits.** A writer has at most 20 drafts at a time (creating one more is refused until one is finalized or discarded); a draft untouched for 90 days may be deleted by a maintenance job (optional, not v1).
- **No sharing between writers.** Two writers who write the same license get two rows, so one can never see, reuse or learn the name of the other's. Only `system` licenses are shared: a text proven to be the registry's (word for word, whitespace aside) is stored once, owned by `system`, whoever uses it first, and the default is always a `system` license (an admin picks one, or writes a text that becomes one).
- Because rows are immutable and novels point at them, the license history of a novel can be added later (a `novel_license_history` table) without redesigning this one.
- `on delete restrict`: a license in use can never be deleted. Unreferenced non-default rows may be garbage-collected by a maintenance job (optional, not v1).

## 15.2 Default license (D8)

- The default is **CC BY 4.0** (closest well-known equivalent for prose: others may share and adapt, including commercially, with attribution). It is seeded as a `canonical` license with `canonical_id = CC-BY-4.0`; its text should come from the Fithara canonical registry (`GET /v1/licenses/CC-BY-4.0`) or the official legal code, never be paraphrased. Legal counsel should confirm it before production.
- Applied automatically when a novel is created without choosing a license.
- Shown to the author in the novel form with a clear note that they can change it, customize it, or draft another via the assistant.
- Visible outside the form too, on the "Licenses & Terms" page (15.5).

## 15.3 Who can change what

| Action                                                               | Who                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Change the **default** license (`is_default`), or write a new default | `Role.admin` only (CASL policy + resolver guard); the default is always a `system` license, and no draft of a writer becomes it |
| Choose or **change** the license of **their own** novel, at any time | Owner of the novel (writer or higher) or an admin, after terms accepted; the license must be a `system` one or the novel owner's own, never another writer's |
| **Update** a license of their own novel                              | The novel's owner: a draft from its text (`createLicenseDraft`), finalized, then set on the novel with `licenseId`. The old row is never edited |
| Customize an existing license or write one from scratch              | Any writer; a draft of their own, finalized into a real license of their own (`forked` / `custom`) |
| Edit/delete a real license row                                       | Nobody (immutable)                                                                       |
| Create, save, finalize and discard a **draft** license               | Any writer, for their own drafts only, after terms accepted; an admin cannot write another writer's draft |
| List and read **drafts**                                             | A writer: their own. An admin: every writer's (a list over all, or over the writers named in `filters.ownerIds`; full text included) |

Changing the default affects only **future** novels. Existing novels keep their license.

Changing a novel's license (D10) only repoints `novels.license_id`; it never edits a license row. Customizing an existing license produces a new row with `source_type = forked` and `canonical_id` set to its base; writing one from scratch produces `custom`. If the edited text equals an already-stored text the existing row is reused (D7). The author can always read the full text of the selected license in the form, and readers see the novel's current license.

## 15.4 API

- `Novel.license { id name sourceType canonicalId text }` on the GraphQL type; included in novel list/detail queries (watch N+1; use a dataloader or join).
- Novel create/update input: `licenseId` or `licenseDraft { title text source }`; the latter goes through `LicenseService.getOrCreate`, for the owner of the novel; `licenseId` must be a `system` license or one of that owner.
- Query `defaultLicense`; mutation `setDefaultLicense(licenseId | draft)` (admin only).
- Drafts (D14): mutations `createLicenseDraft(input { licenseId?, canonicalId? })` (starts from the text of a license the writer may use, or of a canonical license, or from nothing; returns the draft with its id), `saveLicenseDraft(input { id, title, text, source })` (the whole draft; a save of the unchanged content writes nothing), `finalizeLicenseDraft(id)` (returns the final `License`) and `discardLicenseDraft(id)`. Queries `licenseDraftsConnection(first, last, after, before, filters { ownerIds })`, cursor-paginated like `novelsConnection`, newest save first, and `licenseDraft(id)`; a `LicenseDraft` carries its `ownerId`. Writer-only with the terms gate on the mutations; every write names the owner, so another writer's draft, and an admin's attempt to write one, behave as not found. `ownerIds` is a list: a writer may omit it (their own drafts) or name only themselves, and naming anybody else is refused with a 403; an admin who omits it gets every writer's drafts and can name several writers. Reading by id follows the same rule: an admin reads any draft, a writer only their own.
- Authorization failures for non-admins use the existing CASL error path; add policy specs next to `novel.policy.spec.ts`.

## 15.5 UX

- Novel page shows the license name prominently, a link to the canonical `officialUrl` when `sourceType = canonical`, a "Modified from `<base>`" notice when forked, and "Custom license" when custom (same rules as Part 5), plus the non-advice disclaimer.
- Finalizing a draft in the assistant (F5/F9) does not call Fithara: it calls `finalizeLicenseDraft`, and the novel form saves the returned license through `licenseId` (15.4).
- **License-change notice (D12):** the notice is computed entirely in the reader's browser. The frontend remembers the last-seen `license.id` per novel in `localStorage`. When the novel's current `license.id` differs from the remembered one, it shows a sticky side notification ("The license of this novel has changed. Review it.", with a link to the license text) that stays until the reader closes it, then stores the new id. On a first visit nothing is stored yet, so it stores the id silently and shows nothing. Consequences, accepted on purpose: nothing is tracked on the server; there is no flag to reset and no time window; the notice is per browser/device; it is not shown to readers who never revisit. The notification must be keyboard-reachable, announced to screen readers (`role="status"`), and not rely on colour alone (Part 7).
- **"Licenses & Terms" page (D11)** with two tabs, available to every writer: _Platform terms_ (current version and rendered markdown, plus the date the user accepted it) and _Default license_ (name, source, full text, and a note that authors may change it per novel). In the novel form, the selected license's full text is readable inline (expandable) and editable into a fork/custom draft.

## 15.6 Open questions

None at the moment. The relationship between the platform terms and the public license is settled in 0.2.
