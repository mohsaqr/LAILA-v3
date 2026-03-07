# Session Handoff — 2026-03-07

## Completed
- Fixed 9 syntax errors in `server/prisma/seed.ts` (missing `},` closing braces for `data:` objects in assignment/quiz/codeLab creates)
- Added `label?: string` to `findOrCreateModule` type signature
- Seed now runs cleanly and idempotently (no duplicates on re-seed)
- Fixed failing test in `assignment.service.test.ts` (gradebook query now uses `status: { in: ['active', 'completed'] }`)
- All 930 server tests pass
- Added Activity Timeline tab to TNA Dashboard:
  - Server: `getDailyCounts()` method + `GET /activity-log/daily-counts` endpoint
  - Client: `ActivityTimelineChart` component (stacked bars / lines toggle, color by verb, hover + tooltip)
  - Dashboard: new "Activity" tab as first tab, independent data source from TNA sequences
  - i18n: `activity_tab` and `activity_timeline` keys in all 4 locales
- Fixed `date(timestamp)` returning null in SQLite — timestamps stored as epoch ms, needed `date(timestamp / 1000, 'unixepoch')`
- Fixed date filter comparisons (`.getTime()` instead of `.toISOString()` for raw SQL)
- Renamed "Learner Clusters" tab to "Learning Tactics" in all 4 locales

## Current State
- Branch: `main` (uncommitted changes)
- Server: 930 tests passing
- Client: compiles cleanly (only pre-existing type warnings in unrelated files)
- Seed: idempotent — labs and modules do not duplicate on re-seed
- Lectures, assignments, quizzes, codeLabs still use `prisma.*.create()` (not idempotent) but this only matters if seed is run multiple times

## Key Decisions
- Activity timeline chart uses custom SVG (matching all other TNA charts), not Recharts
- Daily counts endpoint uses raw SQL (`$queryRawUnsafe`) for efficient date grouping
- SQLite timestamps are epoch ms integers — `date(timestamp / 1000, 'unixepoch')` for date extraction, `.getTime()` for filter comparisons
- Activity tab has its own data query (independent from TNA sequences), so it works even without TNA data

## Open Issues
- Lectures, assignments, quizzes, codeLabs, codeBlocks in seed.ts still use `prisma.*.create()` — will create duplicates on re-seed. Only modules and labs are idempotent. Low priority since seed is rarely run multiple times.
- Previous sessions: Python labs (Pyodide), SNA labs, template reordering — all implemented and working

## Next Steps
1. Commit all changes if desired
2. Consider making remaining seed entities (lectures, assignments, etc.) idempotent if re-seeding is needed
3. Continue with any new feature requests

## Context
- Dev servers: client on port 5174, server on port 5001
- SQLite database — timestamps stored as epoch milliseconds (integers)
- Pre-push hook runs all tests
- 4 locales: en, fi, ar, es
