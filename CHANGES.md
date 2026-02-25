### 2026-02-25 — Fix PDF/file download in dev mode (Vite proxy)

- `client/vite.config.ts`: Added `/uploads` proxy rule so file requests reach the backend in dev mode. Previously only `/api` was proxied, causing all `/uploads/` fetches to 404 against the Vite dev server.
- `client/src/pages/LectureView.tsx`: No new changes (fetch→blob download from previous session already present).

### 2026-02-24 — Fix student file download in LectureView

- `client/src/pages/LectureView.tsx`: Updated `handleFileDownload` to use fetch→blob→objectURL to force browser download dialog instead of opening files in a new tab. Applied same fix to lecture attachment links. Fallback to `window.open()` on error.

### 2026-02-24 — Docs and gitignore housekeeping

- `tnadepguide.md`: Added TNA dashboard implementation reference guide
- `docs/`: Added archive files
- `.gitignore`: Added R-specific ignores (`.Rhistory`, `.RData`, `.Rproj.user`)
