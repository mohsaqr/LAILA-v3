# Session Handoff — 2026-02-25

## Completed
- Fixed PDF/file download bug: added `/uploads` proxy to Vite dev config so file requests reach the Express backend
- Committed, merged `fix/pdf-download` branch into `main`, pushed, and deleted the branch
- All 912 server tests pass

## Current State
- Branch `main` is up to date with `origin/main` (commit `bc6b17b`)
- Dev servers running: client on port 6000, server on port 5001
- Audit ongoing — file download issues (issues #1 from last session + PDF fix today) resolved

## Key Decisions
- Root cause of PDF download failure in dev: Vite only proxied `/api` to the backend, so `/uploads/` requests 404'd against Vite. Fix was adding `/uploads` to `vite.config.ts` proxy. Production was unaffected since Express serves both API and static files.

## Open Issues
- Audit continues — waiting for user to report next items

## Next Steps
1. Continue receiving and fixing audit items
2. Keep CHANGES.md and LEARNINGS.md updated after each fix

## Context
- Dev server: client on port 6000, server on port 5001
- Pre-push hook runs all 912 tests — they all pass
- `tnadepguide.md` is a reference doc for TNA dashboard implementation
