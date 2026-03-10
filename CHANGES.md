### 2026-03-10 — Fix "Reply to Thread" button doing nothing

- `client/src/pages/Forum.tsx`: The "Reply to Thread" button set `replyingToId` to `null`, which was already the initial state, so nothing visibly happened. The reply form was already rendered at the bottom but off-screen. Fixed by adding a `replyFormRef` and scrolling to it with `scrollIntoView({ behavior: 'smooth', block: 'center' })` when the button is clicked.

### 2026-03-10 — Fix button font size consistency

- `client/src/components/common/Button.tsx`: Added `text-sm` to the `md` (default) size class. Previously `md` had no font-size class, so buttons inherited the parent's font size. Now all three sizes have explicit font sizes: `sm` = `text-sm`, `md` = `text-sm`, `lg` = `text-lg`.
- `client/src/pages/Forum.tsx`: Added `whitespace-nowrap flex-shrink-0` to the "+ New Discussion" button so it never wraps. Added `min-w-0` and `truncate` to the forum title so it shrinks instead of pushing the button off-screen.

### 2026-03-10 — Fix auto-route/random/collaborative missing courseId in conversation lookup

- `server/src/services/tutor.service.ts`: `handleRouterMode()`, `handleRandomMode()`, and `handleCollaborativeMode()` were calling `getOrCreateConversation()` without passing `courseId`. Since sessions use a `@@unique([userId, courseId])` compound key, the conversation lookup failed with "Session not found" when a courseId was present. Fixed by passing `courseId` to all three calls.

### 2026-03-10 — AI tutor responds to student emotional pulses

- `server/src/services/tutor.service.ts`: Added `EMOTION_GUIDANCE` map with tailored tone instructions for all 7 emotions (productive, stimulated, frustrated, learning, enjoying, bored, quitting). `sendMessage()` accepts optional `emotionalPulse` param; if not provided, fetches the student's most recent pulse from DB (within 30 min). Passes emotion to `handleManualMode()`, `handleRouterMode()`, `handleRandomMode()`, `handleCollaborativeMode()`, and `getAgentResponse()`. Each injects a `STUDENT EMOTIONAL STATE` section into the system prompt with the emotion name and behavioral guidance.
- `server/src/routes/tutor.routes.ts`: Message endpoint extracts `emotionalPulse` from request body and passes it to `sendMessage()`.
- `client/src/api/tutors.ts`: `sendMessage()` accepts optional `emotionalPulse` parameter and sends it in the request body.
- `client/src/pages/AITutors.tsx`: Added `latestEmotion` state. `handleEmotionalPulse` stores the selected emotion. `sendMessageMutation` passes `latestEmotion` to the API so the next message includes the student's current emotional state.
- `server/src/services/tutor.service.test.ts`: Added `emotionalPulse.findFirst` mock to prisma mock object.
- `server/src/routes/tutor.routes.test.ts`: Updated 6 message endpoint assertions to include `emotionalPulse` parameter.

### 2026-03-10 — Make AI tutor chat sessions course-specific

- `server/prisma/schema.prisma`: Added `courseId` column to `TutorSession`. Changed unique constraint from `@unique` on `userId` to `@@unique([userId, courseId])`. Added `Course` relation. Changed User relation from one-to-one (`TutorSession?`) to one-to-many (`TutorSession[]`).
- `server/src/services/tutor.service.ts`: All session lookups now use compound key `{ userId_courseId: { userId, courseId } }`. Methods `getOrCreateSession`, `updateMode`, `setActiveAgent`, `getConversations`, `getOrCreateConversation`, `clearConversation`, and `sendMessage` all accept optional `courseId`. Session responses now include `courseId`.
- `server/src/routes/tutor.routes.ts`: All session/conversation endpoints accept `courseId` — GET endpoints via query param, PUT/POST/DELETE via request body or query param.
- `server/src/types/tutor.types.ts`: Added `courseId` to `TutorSessionData`.
- `client/src/types/tutor.ts`: Added `courseId` to `TutorSession`.
- `client/src/api/tutors.ts`: All API methods now accept optional `courseId` and pass it as query param or body field.
- `client/src/pages/AITutors.tsx`: All mutations and queries pass `parsedCourseId` from URL. Query keys include courseId for proper cache isolation.
- `client/src/pages/TestCorner.tsx`: Updated `getSession` call for new signature.
- Test files updated for new compound key and courseId parameters.

### 2026-03-10 — Fix auto-route selecting tutors outside course list

- `server/src/services/tutor.service.ts`: `getAvailableAgents()` now accepts optional `courseId`. When provided, queries `CourseTutor` to return only the tutors assigned to that course. `sendMessage()` accepts `courseId` and passes it through to `handleRouterMode`, `handleRandomMode`, and `handleCollaborativeMode`.
- `server/src/routes/tutor.routes.ts`: Message endpoint now accepts optional `courseId` in request body and passes it to `sendMessage()`.
- `client/src/api/tutors.ts`: `sendMessage()` now accepts optional `courseId` parameter and sends it in the request body.
- `client/src/pages/AITutors.tsx`: Passes `courseIdFromUrl` to `sendMessage()` so router/random/collaborative modes only select from course-specific tutors.
- `server/src/routes/tutor.routes.test.ts`: Updated 5 existing test assertions for new `courseId` parameter, added new test for courseId passthrough.

### 2026-03-10 — Add TNA charts to agent design process analytics

- `client/src/components/agent-assignment/instructor/DesignAnalyticsSummary.tsx`: Added three TNA visualization cards below the existing Activity Breakdown section. New `TnaChartsSection` helper converts event categories into TNA sequences and models. Added `events` prop to receive raw design events from parent.
  - **ActivityDonutChart**: Shows activity distribution by category as an interactive donut chart.
  - **TnaIndexPlot**: Renders the full design process as a single color-coded sequence (one row of timesteps).
  - **TnaNetworkGraph**: Displays transition network between activity categories with weighted directed edges and self-loops.
- `client/src/components/agent-assignment/instructor/DesignProcessTab.tsx`: Passes `events` array to `DesignAnalyticsSummary` for TNA chart generation.

### 2026-03-09 — Fix incorrect Total Design Time in Summary/Analytics

- `server/src/services/agentDesignLog.service.ts`: `calculateAnalytics()` now prefers the last event's cumulative `totalDesignTime` field (logged by the client as elapsed seconds since session start) over the session event pair calculation. Falls back to the previous 3-tier computation (session pairs → unclosed session → first-to-last span) only when the last event has no `totalDesignTime`. This ensures Summary/Analytics tabs show the same correct total as the last item in the Full Time Timeline.

### 2026-03-09 — Rich text editor for forum replies and thread creation

- `client/src/components/forum/ForumReplyInput.tsx`: Replaced plain textarea with tiptap rich text editor. Toolbar: Bold, Italic, Underline, Heading, Bullet/Ordered List, Code Block, Link, Image upload, Undo, Redo. Value is now HTML string. Images uploaded to server (not base64) and compressed to max 500 KB before upload.
- `client/src/components/forum/RichTextEditor.tsx`: New reusable rich text editor component for thread creation modal. Same tiptap config and toolbar as ForumReplyInput.
- `client/src/utils/imageCompress.ts`: New utility that compresses images client-side using canvas. Scales down to max 1200px and re-encodes as JPEG with decreasing quality until under target size.
- `client/src/pages/Forum.tsx`: Post and thread content rendered as sanitized HTML via `DOMPurify.sanitize()` + `dangerouslySetInnerHTML` with `prose` typography classes. Thread list preview strips HTML tags for clean text. Thread creation modal uses `RichTextEditor` instead of textarea.
- `client/src/styles/index.css`: Added tiptap editor styles (placeholder, image max-width 300px, link color) and rendered content image sizing.
- `client/tailwind.config.js`: Added `@tailwindcss/typography` plugin for `prose` classes.
- `server/src/routes/forum.routes.ts`: Increased content validation limit from 10,000 to 50,000 chars (3 schemas: createThread, createPost, updatePost) to accommodate HTML content.
- New dependencies: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`, `@tailwindcss/typography`.

### 2026-03-09 — Create assignment via popup in curriculum editor

- `client/src/components/teach/ModuleItem.tsx`: Assignment button now opens a modal instead of redirecting to the lecture editor. Modal shows the full assignment creation form (title, description, instructions, submission type, points, due date, publish). On submit, creates the assignment via `assignmentsApi.createAssignment()` then creates an assignment section via `coursesApi.createSection()`.

### 2026-03-09 — Upload file via popup in curriculum editor

- `client/src/components/teach/ModuleItem.tsx`: File button now opens an inline modal instead of redirecting to the lecture editor. Modal supports drag-and-drop or click-to-upload, file name editing, and saves as a new file section via `coursesApi.createSection()`. Uses existing upload endpoint (`/api/uploads/file`).
- `client/public/locales/{en,fi,es,ar}/teaching.json`: Added `file_name`, `file_uploaded`, `failed_upload` keys.

### 2026-03-09 — Show section buttons only for empty lectures in curriculum editor

- `server/src/services/course.service.ts`: `getCourseDetails()` now includes `sections` (id, type, fileName, fileUrl, fileType, order) in the lecture select, so the curriculum editor knows which lectures have content.
- `client/src/components/teach/ModuleItem.tsx`: Inline add section buttons (Text, File, AI, Chatbot, Assignment) now only display for lectures with no sections. Lectures with existing sections rely on "Manage Content" instead.
- `client/src/components/teach/LectureItem.tsx`: When a lecture contains a file section, displays file info (name, download, rename) below the lecture card. Inline rename with Enter/Escape, download via fetch-blob.

### 2026-03-09 — Guard against ai_agent submissions via regular endpoint

- `server/src/services/assignment.service.ts`: Added guard in `submitAssignment()` that rejects assignments with `submissionType === 'ai_agent'` (throws 400). This prevents agent assignment resubmissions from being saved as text submissions. Agent assignments must go through `agentAssignment.service.submitAgentConfig()` which properly preserves the `agentConfigId` link and all analytics.

### 2026-03-09 — Fix templateUsage null in agent design analytics

- `server/src/services/agentDesignLog.service.ts`: `calculateAnalytics()` now accepts optional `config` parameter. `templateUsage.roleUsed` falls back to `config.pedagogicalRole` and `templateUsage.personalityUsed` falls back to `config.personality` from `StudentAgentConfig` when design events don't contain role/personality selections (early events logged with null `agentConfigId` are excluded from the query).

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
