### 2026-03-09 — Fix totalDesignTime null in agent design analytics

- `server/src/services/agentDesignLog.service.ts`: Replaced unreliable `design_session_end`-based `totalDesignTime` calculation with event-timestamp-based computation. Sums active session durations (start→end/pause, resume→end/pause pairs). Falls back to first-to-last event span if no session events exist. Previously returned 0/null because `design_session_end` events were lost due to `sendBeacon` content-type issue.
- `client/src/services/agentDesignLogger.ts`: Fixed `flushSync()` to send `sendBeacon` with `Blob({ type: 'application/json' })` instead of plain string, so Express can parse the JSON body.

### 2026-03-09 — Move save button into lesson settings card

- `client/src/pages/teach/LectureEditor.tsx`: Removed save button from page header. Moved it inside the "Lesson Settings" card as a full-width button after the isFree checkbox. Clarifies that save only applies to settings (content type, video URL, duration, free preview) — sections auto-save independently.
- `client/public/locales/{en,fi,es,ar}/teaching.json`: Added `save_settings` key.

### 2026-03-09 — Editable file section names for instructors

- `client/src/components/teach/FileSection.tsx`: Added inline file name editing. After upload, auto-enters edit mode with focused input. Pencil icon next to file name toggles edit mode. Check icon or Enter saves, Escape cancels. Saves via existing `onFileChange({ fileName })` callback.
- `client/public/locales/{en,fi,es,ar}/teaching.json`: Added `edit_file_name` key.

### 2026-03-09 — Add agent assignment chatbots to Chatbot Registry

- `server/src/services/chatbotRegistry.service.ts`: Added third chatbot type `'agent'` that queries `StudentAgentConfig` with `AgentTestConversation`/`AgentTestMessage` for usage stats. Updated `getStats()` to count agent chatbots/conversations/messages. Updated `getFilterOptions()` to include courses with agent assignments and student creators (deduplicated with existing sources).
- `client/src/api/admin.ts`: Updated `ChatbotRegistryFilters.type`, `UnifiedChatbot.type` to include `'agent'`; added `agentChatbots` to `ChatbotRegistryStats`.
- `client/src/pages/admin/logs/ChatbotRegistryTab.tsx`: Added `Puzzle` icon import, agent filter option in type dropdown, agent stats card (amber), agent type badge rendering, `agent_assignment` label in context column, course context section in expanded row details with "Designed by" info.
- `client/src/pages/admin/logs/constants.ts`: Added amber color for `agent` type badge.
- `client/public/locales/{en,fi,es,ar}/admin.json`: Added keys: `agent_chatbots`, `agent`, `agent_assignment`, `course_context`, `designed_by`.

### 2026-03-07 — Rename clusters tab to "Learning Tactics"

- `client/public/locales/en/admin.json`: `clusters_title` -> "Learning Tactics"
- `client/public/locales/fi/admin.json`: `clusters_title` -> "Oppimistaktiikat"
- `client/public/locales/ar/admin.json`: `clusters_title` -> "تكتيكات التعلم"
- `client/public/locales/es/admin.json`: `clusters_title` -> "Tacticas de Aprendizaje"

### 2026-03-07 — Add Activity Timeline tab to TNA Dashboard

- `server/src/services/activityLog.service.ts`: Added `getDailyCounts()` method — raw SQL grouping by `date(timestamp / 1000, 'unixepoch')` and verb, with course/user/date filters. Uses `.getTime()` for date comparisons against epoch ms timestamps.
- `server/src/routes/activityLog.routes.ts`: Added `GET /activity-log/daily-counts` endpoint.
- `client/src/api/admin.ts`: Added `activityLogApi.getDailyCounts()` method.
- `client/src/components/tna/ActivityTimelineChart.tsx`: New component — stacked bar / line chart toggle, color-coded by verb, interactive hover highlighting, tooltips, legend with totals. Custom SVG matching existing chart patterns.
- `client/src/pages/admin/Dashboard.tsx`: Added `'activity'` to `PageTab` type, placed as first tab for all roles, independent data fetch via `useQuery`, renders `ActivityTimelineChart`.
- `client/public/locales/*/admin.json`: Added `activity_tab` and `activity_timeline` keys in en/fi/ar/es.

### 2026-03-07 — Fix seed.ts syntax errors and test alignment

- `server/prisma/seed.ts`: Fixed 9 missing `},` closing braces in assignment.create, quiz.create, and codeLab.create calls. Added `label?: string` to `findOrCreateModule` type.
- `server/src/services/assignment.service.test.ts`: Updated gradebook test to expect `status: { in: ['active', 'completed'] }` instead of `status: 'active'`.
- Tests: 930/930 passing.

### 2026-02-25 — Fix PDF/file download in dev mode (Vite proxy)

- `client/vite.config.ts`: Added `/uploads` proxy rule so file requests reach the backend in dev mode. Previously only `/api` was proxied, causing all `/uploads/` fetches to 404 against the Vite dev server.
- `client/src/pages/LectureView.tsx`: No new changes (fetch->blob download from previous session already present).

### 2026-02-24 — Fix student file download in LectureView

- `client/src/pages/LectureView.tsx`: Updated `handleFileDownload` to use fetch->blob->objectURL to force browser download dialog instead of opening files in a new tab. Applied same fix to lecture attachment links. Fallback to `window.open()` on error.

### 2026-02-24 — Docs and gitignore housekeeping

- `tnadepguide.md`: Added TNA dashboard implementation reference guide
- `docs/`: Added archive files
- `.gitignore`: Added R-specific ignores (`.Rhistory`, `.RData`, `.Rproj.user`)
