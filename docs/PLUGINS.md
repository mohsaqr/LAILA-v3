# Plugins

LAILA plugins are **real extensions, not embeds**. A plugin's server half runs
inside the Express process — its own routes, its own database tables, hooks on
lifecycle events, scheduled jobs. Its client half runs as **real React
components inside LAILA's component tree**, using LAILA's own React instance.
No iframe, no `postMessage`, no sandbox.

That last part is a decision with consequences, so read the security model
before you install anything.

---

## The security model: provenance, not containment

**An installed plugin is trusted code.** It can read `server/.env`, reach Prisma
directly, and touch any part of the DOM. Node offers no isolate that still
permits async host calls and ordinary npm dependencies, so a sandbox that
claimed otherwise would be a lie told to an administrator making a real
decision. This is the same bargain Moodle and WordPress make, and it is the only
way to get plugins that are not toys.

What LAILA does instead:

| Mechanism | What it actually buys |
|---|---|
| **Admin-only install** | Nobody below platform-admin can run foreign code here. |
| **Declared capabilities** | Shown in plain words before you enable it, and recorded. |
| **Capability gating** | The *supported* API refuses an undeclared capability, so drift is a clean error, not a silent dependency. |
| **Bundle hash** | Recorded per install; a changed bundle at the same version is reported. |
| **Table prefixing** | A migration touching `users` is refused — catches honest mistakes, not malice. |
| **Stored manifest** | The manifest recorded at install is what loads, so editing the bundle on disk cannot grant a capability. |
| **Error isolation** | One plugin's failure never takes down a boot, a request, a lesson or a dashboard. |

Treat installing a plugin exactly as you would treat deploying a branch of
LAILA written by its author. Read what it asks for. Know who wrote it.

---

## Bundle layout

```
my-plugin/
├── laila-plugin.json          the manifest — the whole contract
├── server/index.ts            → built to index.cjs (the host is CommonJS)
├── client/plugin.tsx          → built to plugin.js (ESM, React externalised)
├── migrations/
│   ├── 001_init.postgres.sql
│   └── 001_init.sqlite.sql
└── locales/en.json
```

Built with the SDK into `<id>-<version>.laila-plugin.zip`:

```bash
cd plugin-sdk && npm install          # once
node plugin-sdk/src/build.mjs ./my-plugin
```

Then **Admin → Plugins → Upload bundle**. It installs *disabled* so you can read
its capabilities first.

---

## The manifest

```json
{
  "id": "org.example.drag-match",
  "name": "Drag & Match",
  "version": "1.2.0",
  "apiVersion": 1,
  "laila": ">=3.16.0 <4.0.0",
  "server": { "entry": "server/index.cjs" },
  "client": { "entry": "client/plugin.js", "styles": ["client/plugin.css"] },
  "extends": [
    {
      "point": "lecture.block",
      "id": "drag-match",
      "label": "Drag & Match",
      "component": "DragMatchBlock",
      "editor": "DragMatchEditor",
      "settings": [
        { "key": "pairs", "label": "Pairs", "type": "number", "default": 8 }
      ]
    }
  ],
  "capabilities": ["store", "db", "http", "events"],
  "migrations": "migrations"
}
```

- **`id`** is reverse-DNS. It is the directory name, a URL segment, a SQL table
  prefix, and part of every content row this plugin owns. It never changes.
- **`apiVersion`** must match the host's `PLUGIN_API_VERSION`. A mismatch is
  refused at install rather than half-loaded at boot.
- **`laila`** is a semver range checked at install *and* at every boot, so a
  LAILA upgrade that outruns a plugin disables it loudly.
- The manifest is validated **strictly**: an unknown key is an error. A typo'd
  `permissions` instead of `capabilities` fails at install instead of silently
  doing nothing for a year.

### Extension points

| Point | Where it renders | Placement key |
|---|---|---|
| `lecture.block` | A section inside a lesson, beside text/video/MCQ | `section:<id>` |
| `lab` | A full-page lab type | `lab:<id>` |
| `dashboard.widget` | A panel on the analytics dashboard | `course:<id>` |
| `course.tool` | A page at `/courses/:id/t/<path>` | `tool:<path>` |

A block's type column stores `plugin:<pluginId>:<extensionId>`. Every built-in
type parses as *not* a plugin, which is why adding this system changed the
rendering path of exactly zero existing rows.

### Capabilities

`store`, `db`, `http`, `events`, `llm`, `files`, `users:read`, `grades:read`,
`grades:write`, `activity-log`, `course:read`, `course:export`, `jobs`,
`network`.

Using one you did not declare throws immediately, naming the capability and the
manifest field to add.

---

## The server half

```ts
import type { PluginHostApi } from 'laila/plugin-sdk';

export function register(api: PluginHostApi) {
  const answers = api.db.table('answers');          // prefixed, collision-free

  const router = api.router();                       // /api/plugins/<id>/api
  router.get('/summary', async (req, res) => {
    const rows = await api.db.query(`SELECT * FROM ${answers} WHERE id = $1`, 1);
    res.json({ count: rows.length });
  });

  api.on('assignment.submitted', async ({ userId, courseId }) => { /* … */ });

  api.filter('course.export.data', (data, ctx) =>
    ctx.sections.includes('plugins') ? { ...data, mine: [] } : data);

  api.schedule('nightly', 3_600_000, async () => { /* … */ });
}

export function deactivate() { /* release anything the host cannot see */ }
```

**Events vs filters.** An *event* listener that throws is swallowed at the bus —
the enrollment it reacted to already happened and a plugin cannot retroactively
undo it. A *filter* returns the value the host then uses, so a thrower is logged
and the chain continues **from the last good value**. Both are bounded by a
5-second timeout, so a plugin awaiting a dead upstream cannot hold an Express
request open.

**Storage.** `api.store` is a JSON key-value store scoped `global` / `course` /
`user` / `section` / `lab`, capped at 256 KB per value. `api.data` is one row
per (user, placement) with `score`, `completed` and a JSON blob — the table the
gradebook, the export and the dashboard can all read. Need to *query*? Declare
`db` and ship migrations.

**Migrations** are per dialect, because LAILA runs PostgreSQL in production and
SQLite in local dev and `SERIAL`/`AUTOINCREMENT` have no common spelling. Ship
`001_init.postgres.sql` *and* `001_init.sqlite.sql`; a name present for one
dialect and missing for the other is an error, not a skip — "works locally,
missing table in production" is exactly the failure that would cause.

Every object a migration creates must carry the plugin's prefix
(`api.db.table('x')` returns it). Editing a migration after it has been applied
is refused.

---

## The client half

Ordinary React:

```tsx
import { useState } from 'react';          // ← LAILA's React, not a second copy

export function DragMatchBlock({ laila, config, editing }) {
  const [state, setState] = useState(null);
  return <button onClick={() => laila.setState({ completed: true })}>Done</button>;
}
```

The SDK rewrites that import to read from `window.__LAILA_PLUGIN_HOST__`, so the
plugin uses **the host's single React instance**. This matters absolutely: two
React copies in one page means every hook throws "invalid hook call", context
reads `undefined`, and the error points nowhere near the cause. The built client
bundle contains no React at all — the example plugin's is 4.5 KB.

Bundles are served from **LAILA's own origin** (`/api/plugins/<id>/assets/…`),
so `script-src 'self'` already permits them. **A plugin needs no CSP change.**

The `laila` object:

| Call | Does |
|---|---|
| `laila.context` | user id, role, locale, theme, course, placement |
| `laila.getState()` / `setState()` | this student's own state; partial writes |
| `laila.getConfig()` / `setConfig()` | teacher-authored config (`setConfig` is instructor-only) |
| `laila.call(path, init)` | the plugin's own server routes |
| `laila.t(key, fallback)` | translations from the plugin's locale files |

`userId` always comes from the JWT, never the request body — a student cannot
write another student's row, and `score` feeds the gradebook.

Every plugin component is wrapped in an error boundary. A crash costs that one
block; the lesson around it keeps working.

---

## Lifecycle, and the one honest limitation

Install → disabled. Enable → loaded, hooks attached, routes live. Disable →
hooks detached, jobs stopped, router unmounted.

**Upgrading a plugin's server code requires a server restart.** Node has no
`require.unload`; deleting a cache entry only affects the *next* require while
every closure already handed out keeps the old module alive. Rather than pretend,
the install response sets `restartRequired` and the admin UI says so. Client-only
plugins and first installs are live immediately.

Uninstall keeps the plugin's own SQL tables unless you tick "also delete its
database tables" — uninstalling to upgrade is far more common than uninstalling
to forget, and dropping by default makes that mistake unrecoverable. Rows in
`plugin_store` and `plugin_data` cascade either way.

---

## Code map

| Concern | File |
|---|---|
| Manifest schema, capabilities, extension keys | `server/src/plugins/manifest.ts` |
| Hooks (events + filters) | `server/src/plugins/events.ts` |
| Host API handed to `register()` | `server/src/plugins/hostApi.ts` |
| Tables, dialects, migration runner | `server/src/plugins/db.ts` |
| KV store and per-user data | `server/src/plugins/store.ts` |
| Registry of what is loaded | `server/src/plugins/registry.ts` |
| Loading from disk (`require` / ESM) | `server/src/plugins/loader.ts` |
| Install, enable, uninstall | `server/src/services/plugin.service.ts` |
| Routes and asset serving | `server/src/routes/plugin.routes.ts` |
| Shared-library registry | `client/src/plugins/host.ts` |
| Bundle loading and registration | `client/src/plugins/loader.ts` |
| Rendering + error boundary | `client/src/plugins/PluginSlot.tsx` |
| Admin UI | `client/src/pages/admin/PluginsAdmin.tsx` |
| Build tooling | `plugin-sdk/src/build.mjs` |
| Worked example | `plugin-examples/reflection-prompt/` |
