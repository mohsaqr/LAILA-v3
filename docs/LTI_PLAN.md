# LTI 1.3 — a plan

> **Status: Phases 1–3 implemented (2026-09-21).** Registration, resource-link
> launch and Deep Linking all work; **AGS and NRPS are not built**, per this
> plan's own advice to build them only on demand. SCORM, xAPI-LRS and Common
> Cartridge remain unsupported. (`xAPI` appears in the codebase only as
> borrowed *vocabulary* for activity-log verbs — there is no LRS endpoint.)
>
> **The roles question was resolved as proposed**: `signIdToken` is untouched
> and asserts no roles; `lti.service.ts` signs its own tokens with roles taken
> from `CourseRole` for that course only. `isAdmin`/`isInstructor` are never
> read — a test asserts the queries do not even select them.
>
> | Built | Where |
> |---|---|
> | Tool registration + admin UI | `routes/lti.routes.ts`, `pages/admin/LtiAdmin.tsx` (`/admin/lti`) |
> | Resource-link launch | `services/lti.service.ts`, `components/lti/LtiLaunch.tsx` |
> | Deep Linking (incl. verifying tool JWTs via JWKS) | `verifyToolToken`, `POST /api/lti/deep-link` |
> | `lti` lecture section type | `components/lti/section.ts`, wired in `LectureView` |
> | Configurable `frame-src` | `EXTRA_FRAME_SRC`, `config/csp.ts` |
>
> 53 tests (42 service, 11 route). Two things the tests changed in the design:
> protocol validation now runs **before** the session check, so a tool being
> integrated gets "your response_mode is wrong" rather than "log in"; and
> `/authorize` uses `optionalAuth`, because `authenticateToken` answered with
> LAILA's own error shape, which a tool cannot interpret.

## The short version

LAILA should be an LTI **platform** (it owns the course and the roster), not a
tool. Roughly **60% of the hard part already exists**, because LTI 1.3's
security model *is* OpenID Connect with RS256, and `oidc.service.ts` already
implements that half properly.

What is missing is not cryptography. It is claims, a registration table, and
two services (Deep Linking, AGS).

---

## What already exists, and is reusable as-is

From `server/src/services/oidc.service.ts` and `routes/oidc.routes.ts`:

| Piece | State | LTI needs it for |
|---|---|---|
| RS256 signing, `kid` in header | ✅ done | every `id_token` in a launch |
| JWKS at `/api/oidc/jwks` | ✅ done | the tool verifies our launch |
| Discovery at `/.well-known/openid-configuration` | ✅ done | tool configuration |
| Auth-code + mandatory PKCE | ✅ done | reusable, though LTI's flow differs |
| `OidcAuthCode` table with one-time redemption, exact redirect-URI match | ✅ done | the same guard LTI's `state`/`nonce` needs |
| Short token TTL (300s), single-use codes | ✅ done | replay resistance |

The comment at the top of `oidc.service.ts` is worth reading before designing
anything here — its reasoning about asymmetric keys ("a compromise of the
relying party cannot forge a LAILA identity") applies unchanged to LTI tools,
and is the reason this is a good foundation rather than a coincidence.

---

## The decision that has to be made first

`oidc.service.ts` says, in capitals:

> **WHAT WE DO NOT ASSERT.** The id_token carries identity only — sub, email,
> name. It deliberately carries NO role claim. […] replaying them into another
> app would mean a bug here silently grants elevated access to someone else's
> data.

**LTI requires roles.** `https://purl.imsglobal.org/spec/lti/claim/roles` is
mandatory in a resource-link launch; a tool cannot distinguish a learner from an
instructor without it, and grade passback is meaningless without it.

So this plan cannot proceed without consciously narrowing that rule. The
proposal:

- The **existing** `signIdToken` is left exactly as it is. No role claim, ever.
  Chatoyon and any future plain-OIDC relying party are unaffected.
- LTI launches go through a **separate signer** (`lti.service.ts`) that shares
  the key and the JWKS but builds its own claim set.
- LTI roles are **course-scoped, not global**. `isAdmin`/`isInstructor` are
  never exported. The mapping is from `CourseRole.role` for *this course only*:

  | LAILA | LTI role |
  |---|---|
  | course owner (`Course.instructorId`) | `…#Instructor` |
  | `course_admin` | `…#Instructor` + `…#Administrator` (context-level) |
  | `co_instructor` | `…#Instructor` |
  | `ta` | `…#TeachingAssistant` |
  | enrolled, no `CourseRole` | `…#Learner` |
  | not enrolled | **launch refused** |

  A global admin who is not enrolled in the course launches as nothing. That is
  deliberate: it keeps the original rule's substance — LAILA's authorization
  model does not leak — while satisfying LTI.

If that narrowing is unacceptable, stop here. Everything below depends on it.

---

## Phase 1 — tool registration (prerequisite)

Today OIDC clients come from the `OIDC_CLIENTS` **environment variable**, parsed
by `parseClients()`. That works for one hand-configured relying party. It does
not work for LTI, where a teacher expects to add a tool from the admin UI and
each tool needs more fields than an env JSON should carry.

New model, alongside the existing `OidcAuthCode`:

```prisma
model LtiTool {
  id                String   @id @default(cuid())
  name              String
  clientId          String   @unique @map("client_id")   // we issue it
  deploymentId      String   @map("deployment_id")       // we issue it
  /// Where we POST to start a launch (OIDC third-party initiated login).
  loginUrl          String   @map("login_url")
  /// Where the signed launch is finally delivered.
  targetLinkUri     String   @map("target_link_uri")
  redirectUris      String   @map("redirect_uris")       // JSON array, exact match
  /// The TOOL's public keys, so we can verify ITS service calls back to us.
  jwksUrl           String?  @map("jwks_url")
  publicKeyPem      String?  @map("public_key_pem")      // for tools without a JWKS
  deepLinkingUrl    String?  @map("deep_linking_url")
  /// Which services this tool may use: JSON subset of ["ags","nrps"].
  enabledServices   String   @default("[]") @map("enabled_services")
  isActive          Boolean  @default(true) @map("is_active")
  createdById       Int?     @map("created_by_id")
  createdAt         DateTime @default(now()) @map("created_at")
}
```

Admin UI at `/admin/lti`, same shape as `/admin/plugins`: register, show what
the tool will receive, enable/disable, remove.

**Keep `OIDC_CLIENTS` as it is.** Migrating chatoyon to a table is a separate
change with its own risk, and conflating them buys nothing.

---

## Phase 2 — resource-link launch

The flow, and who does what:

```
teacher adds a tool to a module
student clicks it
  │
  ├─ LAILA POSTs to tool.loginUrl
  │     iss, login_hint, target_link_uri, lti_message_hint, client_id, deployment_id
  │
  ├─ tool redirects back to /api/lti/authorize
  │     scope=openid  response_type=id_token  response_mode=form_post
  │     prompt=none   state   nonce   redirect_uri
  │
  └─ LAILA form-POSTs a signed id_token to the tool's redirect_uri
```

Two differences from the existing OIDC route that matter and will bite if
missed:

1. **`response_mode=form_post`** — the token goes back as an auto-submitting
   HTML form, not a redirect fragment. The existing code path does neither.
2. **`prompt=none`** — the user is already authenticated in LAILA; a launch
   must never show a login screen inside an iframe. If the session is missing,
   fail with `login_required` rather than rendering a login page a tool will
   display in a 400×300 frame.

Claim set (beyond the standard `iss`/`sub`/`aud`/`exp`/`nonce`, which
`signIdToken` already produces):

```jsonc
{
  "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
  "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id": "<tool.deploymentId>",
  "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": "<tool.targetLinkUri>",
  "https://purl.imsglobal.org/spec/lti/claim/resource_link": {
    "id": "section-<LectureSection.id>",     // stable; survives a course edit
    "title": "<section title>"
  },
  "https://purl.imsglobal.org/spec/lti/claim/context": {
    "id": "course-<Course.id>",
    "label": "<course slug>",
    "title": "<course title>",
    "type": ["http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering"]
  },
  "https://purl.imsglobal.org/spec/lti/claim/roles": [ /* per the table above */ ],
  "https://purl.imsglobal.org/spec/lti/claim/launch_presentation": {
    "document_target": "iframe", "return_url": "<back to the lecture>"
  }
}
```

**`sub` stays `String(user.id)`**, matching `signIdToken`'s existing contract
and its comment about stability.

**Where a launch lives in the course.** The natural home is a new
`LectureSection.type` of `lti`, holding the tool id and resource-link title —
the same additive pattern the plugin system used, and for the same reason: the
column is a free string and every existing type keeps its path.

### Privacy

A launch discloses name and email to a third party. That deserves the same
treatment the export selection got: a per-tool switch for whether PII travels,
defaulting to **anonymous** (`sub` only). LTI explicitly permits omitting
`name`/`email`, and many tools work fine without them. An admin turning PII on
should see plainly what it means.

---

## Phase 3 — Deep Linking

Without this, a teacher has to paste a URL from the tool by hand, and most
commercial tools assume Deep Linking exists.

`LtiDeepLinkingRequest` sent to `tool.deepLinkingUrl`; the tool returns a
`LtiDeepLinkingResponse` JWT — **signed by the tool**, which is the first place
we verify *their* key via `jwksUrl`. The returned content items become sections
in the module the teacher was editing.

This is where `jwksUrl` stops being decorative; Phase 2 never verifies a tool
signature, Phase 3 must.

---

## Phase 4 — AGS (grade passback), optional

Lets a tool write a score back into LAILA's gradebook. Needs:

- OAuth2 **client-credentials** with a tool-signed JWT assertion — a new grant
  type, and the first time LAILA accepts a token *from* someone else
- a line-item API, and scope enforcement per `enabledServices`
- a mapping from a line item to an `Assignment` + `AssignmentSubmission`

Genuinely optional. Plenty of useful tools are read-only. Do not build it until
one deployment actually needs it — it is the largest phase and the only one
that lets an external party write to grades.

**NRPS** (roster service) is similarly optional and has a worse
privacy/benefit ratio: it hands a tool the whole class list in one call.

---

## What this is not

- **Not LTI 1.1.** OAuth1 signatures, shared secrets, deprecated. If a tool only
  speaks 1.1, the answer is "no", not a second implementation.
- **Not LAILA as a tool.** Being launchable *from* Moodle is a different
  project: session mapping, account linking, and a fundamentally different
  trust direction. Worth its own plan if anyone asks.
- **Not a plugin.** The plugin system loads code we host; LTI launches code
  someone else hosts. They solve different problems and neither replaces the
  other. A plugin that wrapped an LTI tool would be the worst of both.

---

## Sequencing

1. **Decide the roles question.** Nothing starts until that is settled.
2. Phase 1 (registration) + Phase 2 (launch) — this is the useful minimum; a
   teacher can add a tool and students can use it.
3. Phase 3 (Deep Linking) once a real tool is in play.
4. Phase 4 (AGS) only on demand.

Rough size: 1–2 weeks for Phases 1–2, mostly claim-shaping, a table and an admin
screen. Phase 3 adds a few days. Phase 4 is comparable to Phases 1–3 together.

## Verification

LTI is a certification-driven spec, and "it works with the one tool we tried" is
not evidence. Before calling it done:

- IMS **reference implementation** (`lti-ri`) as the tool, for every message type
- a second, independent tool — the reference implementation is forgiving in
  ways real tools are not
- negative tests as first-class: expired `id_token`, wrong `aud`, replayed
  `nonce`, mismatched `deployment_id`, unenrolled launcher, disabled tool. Each
  must be **refused**, and a test should assert the refusal rather than assume it

## Open questions

- **`deployment_id` per what?** Per tool is simplest; per course is what a
  multi-tenant platform does. Per tool until someone needs otherwise.
- **`sub` stability across instances.** `String(user.id)` is stable within an
  instance, meaningless across them. Course export carries no LTI identity —
  should it? Probably not, but decide rather than discover.
- **Iframe and CSP.** A launch normally renders in an iframe. `frameSrc` in
  `server/src/config/csp.ts` currently allows only self/YouTube/Vimeo, so each
  registered tool's origin must be added — the same admin-managed allowlist the
  Embed block needs (see `HANDOFF.md`). Fix both together.
