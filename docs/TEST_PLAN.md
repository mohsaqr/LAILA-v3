# LAILA Test Plan

> **Status (2026-09-21).** First version. Every number in this document was
> measured in the session that wrote it; nothing here is aspirational unless it
> says "planned". Re-measure before quoting these figures elsewhere.

## Where results live

This document is the **strategy**; it is not where results are recorded. LAILA is
registered as a product in **Prova** (`~/Documents/Github/prova`), which is where
runs, results, evidence and gaps actually land:

- `prova/seed/laila.product.json` — the product profile (roles, languages and
  host are required environment fields, because a LAILA result without them
  cannot be reproduced; two independent prod hosts, so `host` is not optional).
- `prova/seed/laila-lti.catalog.yaml` — §6 below, as 5 features / 16 cases.
- `prova/seed/laila.catalog.yaml` — everything else, as 9 features / 24 cases:
  plugin install and isolation, placement config, course export/import,
  public-disclosure surfaces, assignment attachments, i18n integrity and deploy
  verification.

Across both: **40 cases, 36 `covers:` keys each verified against a real vitest
test, and 18 cases with no automated cover.** Those 18 are the honest output of
this exercise — they are what only a person can currently answer (RTL layout,
real-tool interop, a live install) plus four cases deliberately recorded as
**failing today**: the Deep Linking `data` value is never validated, course
import fabricates records against real users from an attacker-authored package,
import has no uncompressed-size cap, and a public certificate still discloses the
holder's grade.

Import with `POST /api/v1/catalog/import`.

## Why this document exists

On 2026-09-21 the LTI 1.3 launch was found to be **completely non-functional in
every browser** — while 2,116 tests passed, both typechecks were clean, and
`config/csp.ts`, the file holding the policy that broke it, sat at **100%
statement and 100% branch coverage**.

That is the single most useful fact about testing in this repository, so it goes
at the top: *our coverage measures whether lines ran, not whether the product
works.* The directives object was asserted in isolation; nothing ever rendered
the merged helmet output, and nothing ever loaded a page in a browser. A feature
can be 100% covered and 100% broken.

This plan is therefore organised around **what each layer cannot see**, not
around coverage targets.

---

## 1. What exists today

| Layer | Where | Size (measured 2026-09-21) |
|---|---|---|
| Server unit/integration | `server/src/**/*.test.ts` | 2,180 tests, 89 files |
| Client unit/component | `client/src/**/*.test.ts(x)` | 545 tests, 49 files |
| Static | `tsc --noEmit` (both), `eslint` (client) | clean; eslint 0 errors, 71 warnings |
| Runtime health | `server/scripts/verify-system.ts` | 6 checks |
| Protocol smoke | `server/scripts/oidc-smoke-test.mjs` | OIDC only |
| CSP generation | `server/scripts/gen-nginx-csp.ts --check` | nginx/app parity |
| Deploy verification | `scripts/verify-deployment.mjs` | post-deploy |
| Load | `server/scripts/load-test{,-public}.ts` | ad hoc |

Server coverage overall: **statements 65.0%, branches 54.5%, functions 63.9%,
lines 66.3%** (`npm run test:coverage`).

Coverage is uneven in a way that matters more than the average:

| File | Statements | Branches |
|---|---|---|
| `services/lti.service.ts` | 89.8% | 83.5% |
| `services/coursePackage.personal.ts` | 89.8% | 85.1% |
| `plugins/hostApi.ts` | 92.7% | 84.8% |
| `plugins/db.ts` | 80.4% | 84.2% |
| `routes/plugin.routes.ts` | 48.1% | 37.9% |
| **`routes/lti.routes.ts`** | **33.9%** | **24.4%** |
| `services/certificate.service.ts` | 28.7% | 26.8% |

**Services are tested; routes are not.** 31 of 42 route files and 20 of 58
service files have no test file at all. Routes are where authorization,
validation and HTTP shape live, so this is the inverse of where the risk is.

---

## 2. The four blind spots

Each of these is stated with the bug that proved it. They are structural — no
amount of additional tests *of the current kind* closes them.

### 2.1 Middleware is invisible to route tests

Every `src/routes/*.test.ts` builds a bare `express()` and mounts one router.
`server/src/index.ts` — helmet/CSP, the rate limiters, the error handler, body
limits, CORS — never runs.

> **Proved by:** the LTI launch. `script-src-attr 'none'` and `form-action
> 'self'` each independently block it. No route test could see either.

**Mitigation:** for any endpoint whose correctness depends on a header or on
middleware ordering, assert the response header in the test (see
`lti.routes.test.ts` → *document CSP*), or cover it at layer 3 below.

### 2.2 Prisma is mocked, so the database is a fiction

Mocks do not enforce constraints, transactions, cascades — **or `select`**.

> **Proved by:** `certificate.service.test.ts`. The mock returned `email`
> regardless of the narrowed `select`, which exposed that the response was
> spreading the whole row. Production was fixed by the narrow select; the test
> only passed once the payload was built field-by-field.

**Mitigation:** where a query's *shape* is the safety property, assert on the
**query** (`mock.calls[0][0].where` / `.select`), not only on the returned
value. A foreign row that is loaded and then filtered has already been seen by
the roster.

### 2.3 There is no browser anywhere in CI

No Playwright, no jsdom navigation, no CSP evaluation.

> **Proved by:** two bugs on the same day. (a) The CSP block above. (b)
> `ContentView.tsx` called `useEffect` after an early return — "Rendered more
> hooks than during the previous render" on any direct visit to
> `/content/lecture/:id`. The second was caught only because ESLint was made to
> run for the first time; neither was caught by 525 client tests.

**Mitigation (planned):** a small smoke suite, not a full E2E estate. See §5.

### 2.4 `npm run lint` had never run

`client/.eslintrc.cjs` did not exist, so the documented command could not start.
`react-hooks` was installed and silent for the life of the project.

**Now fixed.** `npx eslint . --ext ts,tsx --quiet` is 0 errors and must stay
there. The 71 remaining warnings (56 `exhaustive-deps`, 15 `react-refresh`) are
a real backlog — do **not** bulk-fix `exhaustive-deps`, as mechanical dependency
additions cause render loops.

---

## 3. Gates

### Before every commit
```bash
cd server && npx tsc --noEmit && npm test -- --run
cd client && npx tsc --noEmit && npm run test:run && npx eslint . --ext ts,tsx --quiet
```

### Before every push
```bash
cd server && npm run check      # tests + verify-system + csp:check
cd client && npm run build
node scripts/check-versions.mjs
```
`npm run check` needs a running server for `verify-system`.

### Before a deploy
See `docs/DEPLOYMENT.md`. In particular: **a green `/api/health` does not mean
the deploy worked**, and the two prod hosts must be verified separately —
verifying one says nothing about the other.

### After a schema change
`npm run setup:local && npm run db:push`, then regenerate the prod migration.
Both schemas must be committed together.

---

## 4. Conventions that have actually caught bugs

These are not style rules; each earned its place.

1. **Break it on purpose.** Before trusting a new test, reintroduce the bug and
   confirm the test fails *by name*. Applied to the LTI CSP tests (2 of 17
   failed), plugin authorization (5 of 14), and the locale guards (2 of 13).
2. **Assert on the query when the query is the safety property** (§2.2).
3. **Test the contract, not the plumbing.** A negative test that asserts a
   *refusal* is worth more than three that assert a success path.
4. **A test that cannot fail is a defect.** `verify-system.ts` reported
   "Rate Limiting Active ✅ Could not test rate limiting" — `pass: true` was
   hardcoded *and* returned from the catch. It now asserts the `RateLimit-*`
   headers, and was confirmed to fail when they are absent.
5. **Distinguish "absent" from "unreadable".** `catch { return [] }` turned an
   unparseable attachment list into "no attachments", and the student's next
   save then overwrote the real files. Prefer a discriminated result
   (`client/src/utils/fileUrls.ts`).
6. **New i18n keys go in all four locales** (en/fi/es/ar), guarded by
   `client/src/i18n/localeIntegrity.test.ts`.

---

## 5. Planned work, in priority order

1. **Route-level authorization tests** for the untested 32 route files, starting
   with anything handling personal data or grades. Template:
   `server/src/routes/plugin.routes.test.ts`.
2. **A browser smoke suite** (Playwright is already available). Six to ten
   journeys, not a full estate: log in; open a course; view a lecture by direct
   URL (regression for §2.3b); submit an assignment with a file; run an LTI
   launch (§6); load a page and assert **zero CSP violations in the console**.
   The last one alone would have caught the LTI failure.
3. **One integration test file per destructive path** against a real SQLite
   database rather than mocks — course import, course delete, user delete.
4. **Coverage floor on routes only**, once (1) lands. A global floor would be
   satisfied by testing easy code.

---

## 6. LTI 1.3 conformance test plan

> **Status: not yet executed.** LTI is implemented (registration, resource-link
> launch, Deep Linking) and unit-tested, and the CSP defect is fixed and proved
> in Chromium — but **no launch has ever completed against a real tool.** Until
> §6.4 passes, LTI is unproven.

LTI is a certification-driven spec. "It worked with the one tool we tried" is
not evidence, and — as §2.1 showed — neither is a green unit suite.

### 6.1 Layer 1 — unit (exists)

`lti.service.test.ts` (44) and `lti.routes.test.ts` (17). Covers claim shaping,
role mapping, redirect-URI exact matching, token verification (RS256/iss/aud),
single-use launches including the concurrent case, and the per-document CSP.

`lti.service.ts` is at 89.8%/83.5%; **`lti.routes.ts` is at 33.9%/24.4%** and is
the priority for Layer 1 extension.

### 6.2 Layer 2 — protocol smoke against a running server (to build)

Mirror `scripts/oidc-smoke-test.mjs`, which already solves the hard part: it
mints a bearer with `JWT_SECRET` exactly as `generateToken()` does, so no
password is needed.

Proposed `server/scripts/lti-smoke-test.mjs`, wired as `npm run lti:smoke`:

1. Register a tool via the admin API (or seed a row).
2. `POST /api/lti/launch` → assert `{ launchId, startUrl }`.
3. `GET <startUrl>` → assert the auto-post form, **and assert the response's own
   CSP names the tool origin in `form-action` and carries a `script-src` nonce
   matching the `<script nonce>` in the body.**
4. Drive `/api/lti/authorize` as the tool would, with a real session cookie/JWT.
5. Verify the returned `id_token` against `/api/oidc/jwks`: signature, `iss`,
   `aud`, `exp`, `nonce` echoed, `deployment_id`, roles, context claims.
6. Re-submit the same `lti_message_hint` → must be refused.

This is the cheapest layer that exercises the real HTTP protocol, and it is the
one that would fail loudly if the CSP regressed.

### 6.3 Layer 3 — negative matrix

Each row must be **refused**, and the test asserts the refusal rather than
assuming it. Expected codes are the ones the implementation actually emits
(`LtiError`: `invalid_request`, `invalid_client`, `unauthorized_client`,
`login_required`, `unsupported_response_type`, `access_denied`,
`temporarily_unavailable`).

| # | Condition | Expected |
|---|---|---|
| 1 | Unknown `client_id` | `unauthorized_client` |
| 2 | Tool disabled (`isActive: false`) | `unauthorized_client` |
| 3 | `redirect_uri` not exactly registered (incl. `?x=1`, trailing path) | `invalid_request` |
| 4 | `response_type` ≠ `id_token` | `unsupported_response_type` |
| 5 | `response_mode` ≠ `form_post` | `invalid_request` |
| 6 | Missing `nonce` | `invalid_request` |
| 7 | No LAILA session | `login_required` (**not** LAILA's own auth error) |
| 8 | `lti_message_hint` replayed | `invalid_request` |
| 9 | Two concurrent redemptions of one hint | exactly one succeeds |
| 10 | Hint belongs to another tool | `invalid_request` |
| 11 | Hint belongs to another user | `login_required` |
| 12 | Launcher unenrolled between initiation and token | `access_denied` |
| 13 | Platform admin with no standing in the course | refused (no roles) |
| 14 | `sectionId` from a different course | 400 |
| 15 | Deep Linking started by a non-authoring role | 403 |
| 16 | Tool's response JWT signed with `alg: none` / HS256 | `invalid_request` |
| 17 | Tool's response JWT with wrong `aud` or expired | refused by `jwt.verify` |
| 18 | Tool's `kid` absent from its JWKS | `invalid_client` |

Verified against the suite on 2026-09-21: **every row above now has a test at
Layer 1.** Rows 1–8 and 16–18 were already covered; 9 (concurrency), 14
(cross-course `sectionId`) and 15 (Deep Linking authoring rights) were added
that day; 10–13 live in `lti.service.test.ts`.

Layer 1 coverage of the matrix is necessary but not sufficient — rows 1–8 are
asserted against a bare `express()` with no helmet and no error handler (§2.1),
so they prove the handler's logic and not the response a tool receives. That is
what Layer 2 is for.

**Known gap to encode as an expect-fail:** `/api/lti/deep-link` computes a
`deepLinkingData` HMAC, sends it, and **never reads it back**, despite the
handler comment claiming it does. The endpoint has no auth and no rate limiter,
so any registered tool can post a content-item response at any time, bound to no
course, teacher or session. Write the test now; it documents the gap and turns
green when the gap is closed.

### 6.4 Layer 4 — real tool interop (the actual exit criterion)

1. **IMS reference implementation (`lti-ri`)** as the tool, for every message
   type LAILA claims to support.
2. **A second, independent tool.** The reference implementation is forgiving in
   ways real tools are not; one tool proves interop with one tool.

For each: complete a resource-link launch end to end in a browser, complete a
Deep Linking round trip, and confirm **zero CSP violations in the console** —
that last check is what the whole §2.3 blind spot costs us when skipped.

### 6.5 Environment prerequisites

- `OIDC_ISSUER` and `OIDC_PRIVATE_KEY` must be set, or all LTI routes answer
  **503**. Local `.env` has neither, so LTI cannot be exercised locally without
  configuring it (`npm run oidc:keys`).
- Each tool's origin must be in `EXTRA_FRAME_SRC` **and** the nginx CSP
  regenerated (`npm run csp:generate`), or the browser blocks the frame with no
  visible error. `LtiLaunch.tsx` detects this and says so, but only after 4s.
- Prod needs `20260921000823_add_lti_1p3` applied. Boot is safe without it (it
  logs a warning and runs without LTI), so absence is easy to miss.

### 6.6 Exit criteria

LTI may be described as working when: Layer 2 passes in CI; every Layer 3 row
has a test and passes (or is an explicit, documented expect-fail); and Layer 4
passes against **both** tools with a clean console. Until then the honest
description is "implemented, unit-tested, not yet proven against a real tool".

---

## 7. Not covered, deliberately

- **Load/performance**: the two scripts are ad hoc; no thresholds, no CI.
- **Accessibility**: nothing automated.
- **RTL/Arabic rendering**: locale *structure* is guarded; visual RTL is not.
- **The 71 `exhaustive-deps` warnings** (§2.4).
- **Pre-existing i18n drift**: ~314 missing keys, ~138 of them referenced in
  source, concentrated in `teaching`/`courses`/`admin`; plus missing Arabic
  plural categories. The integrity test guards structure, not completeness.
