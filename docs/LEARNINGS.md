# LAILA Project Learnings

Technical knowledge accumulated while working on the LAILA codebase. Read this before starting any task to avoid repeating mistakes.

---

## Architecture

### 2025-02-14
- [project structure]: Monorepo with `client/` (React/Vite) and `server/` (Express/Prisma). Root `package.json` has convenience scripts (`npm run dev` runs both). No workspaces — each directory has its own `node_modules`.
- [service pattern]: All backend services are class-based with singleton exports (`export const fooService = new FooService()`). Services import `prisma` directly from `../utils/prisma.js`. They throw `AppError(message, statusCode)` for handled errors.
- [44 service files]: Auth, user, course, module, lecture, section, enrollment, assignment, quiz, survey, forum, chat, chatbot, chatbotConversation, chatbotRegistry, tutor, courseTutor, llm, mcqGeneration, surveyGeneration, customLab, codeLab, certificate, notification, emotionalPulse, activityLog, learningAnalytics, analytics, analyticsExport, messageExport, agentAssignment, agentDesignLog, agentAnalytics, adminAudit, batchEnrollment, courseRole, enrollmentManagement, userManagement, pdfExtractor, prerequisite, promptBlock, settings, email, lectureAIHelper.
- [route count]: 400+ endpoints across 34 route files. Key groups: courses (47 endpoints), quizzes (18), agent-assignments (16), forums (16), LLM management (18).
- [database]: Prisma ORM with 60+ models. Schema at `server/prisma/schema.prisma`. Uses `db push` for development, `migrate dev` for versioned migrations. No migration files currently committed — schema applied via `db push`.

### Database Quirks
- [JSON in string fields]: Survey question `options`, lab `config`, agent `selectedPromptBlocks`, activity log `extensions`, and many other fields store JSON as plain strings. Must manually `JSON.parse()` on retrieval and `JSON.stringify()` on storage. Prisma does NOT auto-parse these.
- [composite unique keys]: Enrollment uses `@@unique([userId, courseId])`. Quiz attempts use `@@unique([quizId, userId, attemptNumber])`. Check the schema before creating records to avoid P2002 errors.
- [virtual enrollments]: `enrollmentService.getMyEnrollments()` returns fake enrollments (with negative IDs like `-courseId`) for admins and instructors so they can access their own courses. Flag: `isVirtualEnrollment: true`.

---

## Authentication & Security

### 2025-02-14
- [JWT flow]: Token has 7-day TTL. Contains `{ id, email, fullname, isAdmin, isInstructor, tokenVersion }`. Secret from `JWT_SECRET` env var.
- [token invalidation]: Password changes increment `user.tokenVersion`. Auth middleware checks cached tokenVersion (30s TTL) against the token's version. Mismatch → 403. This invalidates ALL existing tokens for that user.
- [account lockout]: 5 failed login attempts → 15-minute lockout. Failed counter resets on successful login.
- [password requirements]: Min 8 chars, uppercase, lowercase, number, special character. Validated by Zod in `validation.ts`.
- [rate limiting]: Five separate limiters: auth (5/min), upload (10/min), API (100/min), LLM (60/min), forum AI (3/min). All use 1-minute windows with `express-rate-limit`.
- [file upload security]: SVG files explicitly blocked (XSS risk). MIME type + extension validated. Max 50MB. Served with CSP headers that block script execution. Uploaded to `/uploads/` with UUID filenames.
- [CORS]: Configurable via `CLIENT_URL` env var. Supports single URL, comma-separated list, or `*` for development.

---

## Testing

### 2025-02-14
- [test framework]: Vitest for both server (node env) and client (jsdom env). Server has 904+ tests across 25 test files.
- [mock pattern]: Always mock Prisma BEFORE importing the service. Use `vi.mock('../utils/prisma.js', () => ({ default: { tableName: { findUnique: vi.fn() } } }))`. Then `vi.mocked(prisma.tableName.method).mockResolvedValue(data as any)`.
- [missing mocks gotcha]: If a service calls a Prisma table you didn't mock, you get cryptic "Cannot read properties of undefined" errors. Check the service source for ALL Prisma calls (including `$transaction`, `aggregate`, etc.) and mock them all.
- [pre-push hook]: Tests run automatically before `git push` via `.githooks/pre-push`. Bypass with `git push --no-verify`. Tests must pass for push to succeed.
- [test timeout]: Tests occasionally timeout when run in parallel. Usually pass when run in isolation. If a test times out in CI, try running it alone first.
- [async handler testing]: Route tests use `supertest`. Mock the service methods and verify status codes and response shapes. Don't forget `asyncHandler` wraps all route handlers.

---

## Frontend Patterns

### 2025-02-14
- [axios double unwrap]: API responses have `{ success: true, data: {...} }`. Axios adds its own `.data` wrapper. So actual data is at `response.data.data`. Client API modules do this unwrap: `return response.data.data!`.
- [zustand stores]: 4 stores — auth (persisted), theme (persisted), language (synced with i18n), notifications (polling). Auth store intentionally does NOT persist `viewAsRole` to prevent client-side role spoofing.
- [protected routes]: `<ProtectedRoute>` component checks `useAuthStore().isAuthenticated`. Supports `requireInstructor` and `requireAdmin` props for role-gated pages.
- [i18n namespaces]: 9 namespaces (common, navigation, auth, courses, teaching, admin, errors, tutors, settings). Use `t('namespace:key')` for explicit namespace, or list namespaces in `useTranslation(['ns1', 'ns2'])` and first one is default.
- [RTL support]: Arabic uses `dir="rtl"` on document root. CSS animations need RTL variants with `[dir="rtl"]` selector. Language store manages direction changes automatically.
- [notification polling]: 30-second interval via `useNotificationPolling()` hook. Optimistic updates with rollback on error.
- [file URL resolution]: Client function `resolveFileUrl()` converts relative paths like `/uploads/abc.pdf` to absolute server URLs. Must use this for all uploaded file references.
- [LectureEditor save semantics]: Sections auto-save via `updateSectionMutation` on each change. The "Save Settings" button only saves lesson-level metadata (title, contentType, videoUrl, duration, isFree). Button lives inside the sidebar "Lesson Settings" card, not in the page header.

---

## LLM Infrastructure

### 2025-02-14
- [multi-provider]: Supports OpenAI, Anthropic, Google Gemini, Ollama, LM Studio, Groq, OpenRouter, Together, Mistral. All use a unified `llmService.chat()` interface.
- [provider adapters]: Three adapter types: OpenAI-compatible (handles most providers), Gemini (converts to `contents` array format), Anthropic (uses messages API with top-level system param).
- [o1/o3 model handling]: Reasoning models require special treatment — system prompt moves to first user message, temperature/topP parameters removed, `max_completion_tokens` used instead of `max_tokens`.
- [provider config]: LLMProvider model has 50+ fields. Key categories: connection, generation defaults, limits, reliability (timeouts/retries), capabilities (streaming/vision/function calling), health monitoring, usage stats.
- [health checks]: Each provider has `healthCheckEnabled`, `healthCheckInterval` (60s default), `lastHealthCheck`, `consecutiveFailures` tracking. Test endpoint: `POST /api/llm/providers/:nameOrId/test`.
- [local-first]: Ollama (localhost:11434) and LM Studio (localhost:1234) both use OpenAI-compatible adapter. Can list/pull models via API.
- [provider fallback]: `getDefaultProvider()` returns the enabled default provider. If no default set, falls back to highest-priority enabled provider.

---

## AI Content Generation

### 2025-02-14
- [MCQ generation]: Max 10 questions, temperature 0.4, 4000 max tokens. Validates generated JSON — resolves letter references (A/B/C/D → option text), filters questions with missing/invalid options. Supports difficulty levels (easy/medium/hard) and option counts (3-5).
- [survey generation]: 5 types (general_feedback, course_evaluation, likert_scale, learning_strategies, custom). Max 15 questions, temperature 0.4. `generateAndCreateSurvey()` creates survey + all questions in a single Prisma transaction.
- [AI response parsing]: Both MCQ and survey generators strip `<think>` tags from reasoning model outputs, extract JSON from markdown code blocks, and find the outermost `{...}` object. Always wrap in try/catch — AI responses are unpredictable.
- [practice questions]: Generated from lecture content. System extracts lecture text + PDF attachments (via `pdfExtractor` service), builds content-aware prompt, returns MCQs for self-assessment.

---

## Agent System

### 2025-02-14
- [7 built-in agents]: 3 professional (Socratic Guide temp=0.7, Helpful Guide temp=0.6, Project Coach temp=0.5) + 4 peers (Study Buddy temp=0.8, Carmen temp=0.8, Laila temp=0.7, Beatrice temp=0.75). Seeded via `prisma/seed.ts` as Chatbot records.
- [5 deployment surfaces]: Global tutoring (TutorSession), course tutors (CourseTutor), forum AI (ForumPost.isAiGenerated), lecture chatbots (LectureSection chatbot type), lecture AI helper (LectureExplainThread).
- [4 routing modes]: Manual (student picks), Router (fast keyword scoring), Collaborative (parallel/sequential/debate/random multi-agent), Random. Set per-session via `tutor.service.updateMode()`. Non-manual modes accept `courseId` to restrict agent selection to course-assigned tutors via `CourseTutor`.
- [keyword router]: Zero-latency — no LLM call. Scores messages against 7 categories (conceptual, problem-solving, emotional, study strategies, project, writing, discussion). Each agent has weighted keywords with base and boost scores.
- [collaborative synthesis]: After all agents respond, a synthesis message is generated. Each agent contribution tagged with agent name and personality.
- [agent builder]: Students design agents via 4-tab interface (identity, behavior, advanced, test). 10 role templates, 7 personality presets, 38 prompt blocks in 6 categories (persona, tone, behavior, constraint, format, knowledge). Blocks auto-combined in category order.
- [design analytics]: AgentDesignEventLog captures field-level changes, tab timing, template/block selections, version snapshots, test conversations, reflections. 30+ fields per event. Used for research on design-as-learning.
- [agentConfigId null on early events]: `AgentDesignEventLog.agentConfigId` is nullable. The design logger starts before the config is created/loaded, so early events (session_start, role_selected, personality_selected) have `agentConfigId: null`. For templateUsage, fall back to `StudentAgentConfig.pedagogicalRole` and `.personality` columns rather than relying solely on design events.
- [totalDesignTime computation]: `calculateAnalytics()` prefers the last event's cumulative `totalDesignTime` field (client-logged as `Math.floor((Date.now() - sessionStartTime) / 1000)`). Falls back to server-side session event pair computation (start/resume → pause/end) then first-to-last event span. The client value is most accurate because it tracks actual elapsed time; the session pair approach can miss time outside explicit session boundaries.
- [sendBeacon + JSON]: `navigator.sendBeacon(url, string)` sends `text/plain` — Express `json()` middleware ignores it. Must wrap in `new Blob([data], { type: 'application/json' })`. This affects `agentDesignLogger.flushSync()` and the activity logger's `beforeunload` handler.
- [tutor sessions are course-scoped]: `TutorSession` has `@@unique([userId, courseId])`. Each course gets its own session with independent conversations, mode, and active agent. All service methods and API endpoints accept optional `courseId`. When `courseId` is null (e.g., TestCorner), falls back to a global session. The client passes `courseIdFromUrl` from the URL query param through all API calls.
- [tutor auto-routing course filter]: `getAvailableAgents(courseId?)` in `tutor.service.ts` filters by `CourseTutor` when `courseId` is provided. The `courseId` flows from the client URL query param through the message request body. Without this, router/random/collaborative modes select from ALL global tutors instead of only the course's assigned tutors.
- [agent submission guard]: `assignment.service.submitAssignment()` rejects `ai_agent` type assignments (throws 400). Agent assignments must go through `agentAssignment.service.submitAgentConfig()` which preserves the `agentConfigId` link. Without this guard, the regular submit endpoint overwrites the submission with text content and loses the agent config association. The unsubmit→edit→resubmit cycle is handled entirely by `submitAgentConfig`/`unsubmitAgentConfig`.
- [TNA charts in agent review]: TNA visualization components (from `components/tna/`) are reused in `DesignAnalyticsSummary` for agent submission review. `ActivityDonutChart` takes `data: Record<string, number>` and `title`; `TnaIndexPlot` takes `sequences: string[][]`, `labels`, optional `colorMap`; `TnaNetworkGraph` takes `model: TNA` (from `dynajs`), `colorMap`, `showSelfLoops`, `height`. For agent design, map events via `categoryLabels` (session→Sessions, field→Field Changes, etc.) and pass a single sequence `[events.map(e => label)]`. Build TNA model via `tna([sequence], { labels })`. Share color maps via `createColorMap(labels)`. Events are passed from `DesignProcessTab` to `DesignAnalyticsSummary` via the `events` prop.

---

## Course System

### 2025-02-14
- [course hierarchy]: Course → Module → Lecture → Section. Sections have types: text, file, chatbot (embedded AI), assignment. Each level has `orderIndex` for sorting and `isPublished` for visibility.
- [publishing rules]: Course must have at least one module with content to publish. Survey must have at least one question to publish.
- [AI settings per course]: `tutorRoutingMode` (manual/router/collaborative/random), `defaultTutorId`, `collaborativeModuleEnabled`, `emotionalPulseEnabled`. Set via `PUT /api/courses/:id/ai-settings`.
- [course roles]: Beyond global isInstructor/isAdmin, courses support TA, co-instructor, course_admin roles with granular permissions: grade, edit_content, manage_students, view_analytics.
- [batch enrollment]: CSV upload creates a BatchEnrollmentJob. Processes rows async, tracks success/error per row. Results viewable per job.

---

## Analytics

### 2025-02-14
- [5 analytics layers]: (1) LearningActivityLog — xAPI-inspired actor-verb-object, (2) UserInteractionLog — client-side behavioral, (3) ChatbotInteractionLog — per-message AI metrics, (4) Domain-specific logs (Content, Assessment, Auth, System events), (5) AgentDesignEventLog — builder design process.
- [export formats]: CSV (per-table), Excel (multi-sheet workbook), JSON, ZIP (all CSVs bundled). All support date range and course/user filtering. Available at `/api/analytics/export/*`.
- [emotional pulse]: 7 states (productive, stimulated, learning, enjoying, frustrated, bored, quitting). Recorded with context (chatbot/tutor/lecture), contextId, agentId. Instructor views: aggregated stats + timeline. Now also fed into AI tutor system prompts — when a student selects an emotion, the next message includes it, and the server also checks the most recent DB pulse (within 30 min). Each emotion has tailored tone guidance in `EMOTION_GUIDANCE` map.
- [chatbot interaction logging]: 40+ fields per message including full course/module/lecture context, message metrics (char/word counts), AI metrics (model, provider, tokens, latency), device info, and session data. Critical for research.

---

## Development Workflow

### 2025-02-14
- [dev startup]: `npm run dev` from root starts both client (5174) and server (5001) via concurrently. Client proxies `/api` to server.
- [database reset]: `cd server && npx prisma db push --force-reset && npx prisma db seed` to wipe and reseed.
- [prisma studio]: `cd server && npx prisma studio` opens visual DB editor on port 5555.
- [test specific file]: `cd server && npm test -- --run src/services/quiz.service.test.ts`
- [test by name]: `cd server && npm test -- --run -t "should create quiz"`
- [adding translations]: Add key to ALL 4 language files (`client/public/locales/{en,fi,es,ar}/`). Use `t('namespace:key')` in components.
- [commit format]: `type(scope): description` — types: feat, fix, test, docs, refactor, style, chore.

---

## Environment Setup

### 2025-02-14
- [required env vars]: `JWT_SECRET`, `SESSION_SECRET`, `DATABASE_URL`. Without JWT_SECRET the server crashes on startup. Without SESSION_SECRET it crashes at middleware setup.
- [setup script]: `bash setup.sh` auto-generates secrets, creates `.env` files, installs deps, pushes schema, seeds database. Creates demo accounts: admin/instructor/student @laila.edu.
- [no Docker yet]: DEPLOYMENT.md has sample Dockerfile/docker-compose.yml templates but no actual Docker files in the project.
- [SQLite default]: Development uses SQLite (`file:./dev.db`). Production should use PostgreSQL. Change `provider` in schema.prisma and DATABASE_URL.
- [PWA]: Service worker at `client/public/sw.js`. Cache name `laila-v1`. Network-first for HTML, cache-first for static assets, network-only for API calls.

---

## Gotchas & Pitfalls

### 2025-02-14
- [prisma select vs include]: Cannot use `select` and `include` on the same relation level. Use `include` for full relations or nested `select` for partial fields.
- [async route handlers]: ALL route handlers MUST be wrapped in `asyncHandler()` or unhandled promise rejections crash the process silently.
- [viewAsRole security]: Auth store does NOT persist viewAsRole. This is intentional — persisting it would let a user manipulate localStorage to fake roles (even though the server validates, it would show wrong UI).
- [error messages in production]: Error middleware returns generic "Internal server error" in production. To debug production issues, check server logs — they contain the real error with full context.
- [notification polling memory]: The 30s polling interval can stack up if the component doesn't properly clean up. The `useNotificationPolling()` hook handles cleanup on unmount.
- [WebR initialization]: WebR takes 5-10 seconds to initialize (downloads WASM binary). The `useWebR` hook tracks `isReady` state. Never call execution methods before `isReady === true`.
- [PDF extraction]: `pdfExtractor.service.ts` extracts text from lecture attachment PDFs for AI context. Large PDFs can slow down MCQ generation significantly. Content is truncated to fit LLM context windows.
- [provider cache]: LLM service caches provider configs in memory. After updating provider settings via admin UI, the cache may serve stale data for up to a few requests until refreshed.

---

## TNA Analytics Feature

### 2026-02-17
- [tnaj package]: NOT on npm. Must install from GitHub: `npm install tnaj@github:mohsaqr/tna-js`. The user's own library for Transition Network Analysis.
- [tnaj API]: `tna(sequences, { labels })` returns `TNA` type with `{ weights: Matrix, labels: string[], inits: Float64Array }`. `ftna()` returns frequency-based model. `prune(model, threshold)` removes weak edges. `createColorMap(labels)` maps verb labels to consistent hex colors.
- [Matrix class]: tnaj's `Matrix` class wraps `Float64Array` with `.get(i,j)` and `.max()` methods. Not a plain 2D array — must use accessors.
- [service method placement]: When adding methods to class-based services (e.g., `ActivityLogService`), ensure the new method goes INSIDE the class body, BEFORE the closing `}` and before `export const activityLogService = new ActivityLogService()`. Editing near class boundaries is error-prone — target a unique string inside the class (like the last method's return statement) as the anchor.
- [AdminDashboard rename]: Original `AdminDashboard.tsx` was renamed to `AdminFrontpage.tsx` to free the "Dashboard" name for the new TNA analytics page. Must update: `index.ts` exports, `App.tsx` imports + routes (3 places), `AdminSidebar.tsx` label.
- [SVG visualizations]: All three TNA charts (distribution stacked bars, frequency horizontal bars, network directed graph) use pure React SVG — no D3 dependency. This keeps the bundle small and avoids D3's imperative DOM manipulation conflicts with React.
- [TNA sequences endpoint]: `GET /api/activity-log/tna-sequences` groups `LearningActivityLog` records by userId, ordered by timestamp, returning per-user verb arrays. Safety cap of `take: 50000` prevents memory issues on large datasets.
- [admin sidebar items]: Items in `AdminSidebar.tsx` use `{ path, label: t('key'), icon: LucideIcon }` format. New items must also have translation keys in all 4 locale files.
- [prune threshold UX]: Default 0.05 works well. Range input 0–0.5 with step 0.01 gives good granularity. Threshold is the minimum edge weight proportion to keep in the network graph.

### 2026-02-18
- [tnaj advanced API]: Beyond `tna()`/`ftna()`, the library exports `atna()` (attention/recency-weighted), `centralities(model)` → `CentralityResult` with 9 measures (OutStrength, InStrength, Betweenness, Closeness, ClusteringCoeff, etc.), `communities(model)` → `CommunityResult` with 6 methods (louvain, fast_greedy, walktrap, etc.), and `summary(model)` → stats object.
- [summary() return shape]: `summary()` returns `Record<string, unknown>` with fields: `nStates`, `type`, `scaling`, `nEdges`, `density`, `meanWeight`, `maxWeight`, `hasSelfLoops`. Note: the field is `nEdges`, not `edges`.
- [CentralityResult type]: `{ labels: string[], measures: Record<CentralityMeasure, Float64Array> }`. CentralityMeasure includes: OutStrength, InStrength, Betweenness, Closeness, ClusteringCoeff, PageRank, Eigenvector, HubScore, AuthorityScore.
- [CommunityResult type]: `{ counts: Record<string, number>, assignments: Record<string, number[]>, labels: string[] }`. Community methods: louvain, fast_greedy, walktrap, label_propagation, leading_eigenvector, spinglass.
- [colorPalette()]: `colorPalette(n)` returns array of n hex colors. Accepts optional second arg for palette name (e.g., `'accent'`). Replaces the old hardcoded NODE_COLORS arrays.
- [tnaj demo style constants]: Matching https://saqr.me/tna-js/ requires: edge color `#2B4C7E`, width range 0.3–4, opacity range 0.7–1.0, arrow len=7/halfW=3.5, node stroke `#999999`/2px, edge labels always on with 9px font and white stroke outline (`paintOrder: 'stroke'`), hover turns edges red `#e15759`.
- [SVG paintOrder technique]: For readable labels on busy backgrounds, use `style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3, strokeLinejoin: 'round' }}` — this draws the stroke behind the fill, creating a white halo effect.
- [LLM settings consolidation]: `LLMSettings.tsx` page was deleted and its functionality merged into `settings/LLMPanel.tsx`. The `/admin/llm` route now renders the settings page with the LLM panel tab.

### 2026-02-19
- [batch-first activity logging]: `activityLogger.ts` now queues all activities and flushes every 3 seconds via `POST /api/activity-log/batch`. No more individual POSTs per action. Reduces HTTP requests by ~90%.
- [beforeunload with keepalive]: `sendBeacon()` cannot set custom headers, so JWT auth won't work with it. Use `fetch({ keepalive: true })` instead — survives page unload AND supports `Authorization` headers. Token read from `useAuthStore.getState().token`.
- [redundant modules query]: `CurriculumEditor.tsx` was fetching modules separately via `getModules(courseId)`, but `getCourseById(courseId)` already includes `modules` with nested lectures/codeLabs. Removed the redundant query and derived `modules` from `course.modules`. Cache invalidations changed from `['courseModules', courseId]` to `['course', courseId]`.
- [curriculum section data]: `getCourseDetails()` includes `sections` (id, type, fileName, fileUrl, fileType, order) in lecture select. `ModuleItem` uses `lecture.sections?.length` to conditionally show add-section buttons only for empty lectures. `LectureItem` finds the first file section to display inline with download/rename.
- [Socket.IO server setup]: Server now uses `http.createServer(app)` + `server.listen()` instead of `app.listen()`. Socket.IO attached to the HTTP server via `initSocket()` in `server/src/utils/socket.ts`. CSP updated with `ws:` and `wss:` in `connectSrc`.
- [Socket.IO user rooms]: Each connected client joins a room named `user:{userId}` based on `socket.handshake.auth.userId`. Server emits targeted events via `emitToUser(userId, event, data)` which calls `io.to('user:${userId}').emit(...)`.
- [notification polling replaced]: `NotificationBell.tsx` no longer uses `setInterval(fetchUnreadCount, 30000)`. Instead, it connects via Socket.IO and listens for `notification:new` events. `useNotificationPolling()` hook removed from `notificationStore.ts` (was never imported elsewhere).
- [nginx WebSocket proxy]: Socket.IO needs a dedicated `/socket.io/` location block in nginx with `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"`. Without these headers, WebSocket upgrades fail and Socket.IO falls back to polling, defeating the purpose. Added `proxy_read_timeout 86400s` to keep long-lived connections alive.

---

## Forum Rich Text Editor

### 2026-03-09
- [tiptap setup]: Forum uses `@tiptap/react` with extensions: `StarterKit` (heading levels 2-3), `Underline`, `Image` (block, not inline), `Link` (openOnClick: false), `Placeholder`. Two components: `ForumReplyInput` (full editor with agent selector/submit) and `RichTextEditor` (reusable, props-only).
- [image upload]: Images uploaded to server via `POST /api/uploads/file` (not base64). Client-side compression via `utils/imageCompress.ts` — scales to max 1200px, re-encodes as JPEG with decreasing quality until under 500 KB. Images display at max 300px width in editor and rendered content (set in CSS).
- [HTML content rendering]: Forum post/thread content stored as HTML strings. Rendered with `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}` and `prose prose-sm dark:prose-invert` Tailwind typography classes for consistent styling. Thread list preview strips HTML tags via regex.
- [content size limit]: Server validation increased from 10K to 50K chars (`forum.routes.ts`) to accommodate HTML content with image URLs and formatting tags.
- [tiptap value sync]: External value changes (e.g., clearing after submit) synced via `useEffect` that checks `!editor.isFocused` before updating. Empty string triggers `clearContent()`, non-matching HTML triggers `setContent(value)`.
- [tiptap CSS]: Styles in `index.css` under `.forum-reply-editor .tiptap` — outline removal, placeholder via `::before` pseudo-element with `data-placeholder` attr, image max-width 300px, link color.
- [@tailwindcss/typography]: Required for `prose` classes that style raw HTML content (headings, lists, code blocks, links, blockquotes). Added to `tailwind.config.js` plugins array.

---

## File Sections

### 2026-03-09
- [file name editing]: FileSection.tsx supports inline renaming of uploaded files. The `fileName` field in `LectureSection` stores the display name (not the server filename which is a UUID). Renaming calls `onFileChange({ fileName: newName })` which triggers `updateSection()` API call — no file re-upload needed.
- [auto-edit after upload]: After successful upload, the component auto-enters edit mode (`setIsEditingName(true)`) so the instructor can immediately customize the name instead of keeping the original filename.

---

## Chatbot Registry

### 2026-03-09
- [three chatbot types]: The chatbot registry aggregates three sources: (1) `global` — `Chatbot` model records (AI tutors), (2) `section` — `LectureSection` with `type='chatbot'`, (3) `agent` — `StudentAgentConfig` records (student-designed agents from agent assignments). All mapped to `UnifiedChatbot` with prefixed IDs (`global-{id}`, `section-{id}`, `agent-{id}`).
- [agent chatbot mapping]: `StudentAgentConfig` → `UnifiedChatbot`: `agentName` → `name`, `agentTitle || agentName` → `displayName`, `personaDescription` → `description`, category hardcoded `'agent_assignment'`, `isActive = !isDraft`, `avatarImageUrl` → `avatarUrl`. Usage stats from `AgentTestConversation` (count, testerIds) and `AgentTestMessage` (message count, last activity).
- [agent creator = student]: For agent chatbots, the "creator" is the student who designed the agent (`config.userId`), not the course instructor. This differs from section chatbots where the creator is the instructor.
- [filter options deduplication]: `getFilterOptions()` merges courses and creators from all three sources using `Map` for deduplication. Courses come from section chatbot hierarchy + agent assignment courses. Creators come from instructors of section chatbot courses + students who designed agents.
- [adding new registry type]: To add a new chatbot source: (1) add type string to `ChatbotRegistryFilters.type` and `UnifiedChatbot.type` on both server and client, (2) add query block in `getChatbots()` between section and sorting blocks, (3) update `getStats()` counts, (4) update `getFilterOptions()` with merged courses/creators, (5) add type color in `constants.ts`, (6) update `ChatbotRegistryTab.tsx` filter dropdown + badge + stats card + expanded details, (7) add i18n keys in all 4 locales.

### 2026-03-10
- [certificate view vs render]: The old `renderCertificate` approach (server returns HTML template with placeholder substitution, client opens in `window.open`) produces unstyled pages. Better approach: a dedicated React page (`CertificateView.tsx`) that fetches certificate data via API and renders it client-side. PDF download uses `window.print()` in a new window with inline CSS for print layout.
- [certificate data enrichment]: `getCertificate()` originally returned only `user.fullname` and `course.title`. For a rich certificate view, expanded to include `user.avatarUrl`, `course.instructor.avatarUrl`, and `course.categories` (via CourseCategory join table).
- [print-to-PDF pattern]: Create a new window, write a self-contained HTML document with `@page { size: landscape; margin: 0; }` and `@media print` styles, then call `window.print()` on load. This lets browsers save as PDF natively without any library dependency.


# Learning Log

## 2026-03-11 — Rich text editor migration pattern

### Pattern: Replacing plain text inputs with RichTextEditor

When migrating a field from plain text/markdown to rich text (HTML via Tiptap):

1. **Editor side**: Replace `<TextArea>` or `<textarea>` with `<RichTextEditor>`. The `onChange` callback receives HTML string directly (no `e.target.value`).
2. **View side**: Detect whether stored content is HTML (`content.trim().startsWith('<')`) or legacy markdown. Render HTML with `dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}`. Fall back to markdown parsing for old content.
3. **Card/truncated views**: Strip HTML tags with `.replace(/<[^>]*>/g, '')` for plain text previews.
4. **Sanitization**: Always use `sanitizeHtml()` from `utils/sanitize.ts` (DOMPurify wrapper) before rendering HTML via `dangerouslySetInnerHTML`.
5. **Prose styling**: Use Tailwind `prose dark:prose-invert max-w-none` classes on the container for proper typography.
6. **No server changes needed**: The DB field is already `String?` — HTML is just a string. Validation schemas accept any string.

### Fields migrated so far
- Course description (`CourseForm.tsx` → `CourseDetails.tsx`, `CurriculumEditor.tsx`, `CourseHeader.tsx`, `Catalog.tsx`, `TeachDashboard.tsx`)
- Lecture text sections (`TextSection.tsx` → `LectureView.tsx`)
- Assignment instructions (`AssignmentManager.tsx`, `AssignmentSectionEditor.tsx` → `AssignmentView.tsx`)

### RichTextEditor customization
- `editorClassName` prop allows overriding the editor's min/max height per use case
- Default: `min-h-[120px] max-h-[300px]`
- Text sections use: `min-h-[300px] max-h-[600px]`

## 2026-03-12 — Card layout with fixed proportions

For list cards with description + stats side by side:
- Use `w-3/5 min-w-0` for the description section (allows text truncation)
- Use `w-2/5 flex items-center justify-end gap-6` for stats
- Add `flex-shrink-0` on icons and stat items to prevent shrinking
- Use `whitespace-nowrap` on stat text to prevent wrapping
- Use `line-clamp-2` on descriptions to limit to 2 lines
- Date format `en-GB` with `{ day: 'numeric', month: 'short', year: 'numeric' }` → `24 Aug 2025`

## 2026-03-12 — Due date "wall clock" timezone pattern

When a due date is a "wall clock" time (instructor picks 20:00, everyone should see 20:00):
- **Save**: Send `datetime-local` value + `':00.000Z'` directly — no `new Date().toISOString()` conversion
- **Display**: Always use `timeZone: 'UTC'` in `toLocaleDateString()` / `toLocaleTimeString()` options
- **Edit form population**: Use `.toISOString().slice(0, 16)` to get `datetime-local` compatible value
- **Never use** `new Date(localValue).toISOString()` for due dates — this applies timezone offset
- **Comparisons** (isPastDue etc.) still work: both `new Date(dueDateUTC)` and `new Date()` are absolute timestamps
- Submission timestamps (`submittedAt`, `createdAt`) are real UTC — display those without `timeZone: 'UTC'`
- Zod validates with `z.string().datetime()` which accepts `2026-03-15T20:00:00.000Z` format
- **Grace period deadline** follows the same wall-clock pattern. `gracePeriodDeadline` is nullable DateTime — same save/display/comparison rules as `dueDate`. Client uses 3-state logic: `isPastDue` (after due), `isInGracePeriod` (after due but before grace), `isFullyPastDue` (after both). Server validates grace > due on create/update. Submission allowed during grace period with client-side warning.

## 2026-03-12 — Unified submission routes pattern

When two pages serve the same purpose for different subtypes (e.g., regular vs agent submissions):
1. Use conditional `useQuery` with `enabled` flag based on entity type
2. Render different UI branches in the same component
3. Keep detail views as separate routes if they have fundamentally different UIs
4. Use a distinguishing path segment (e.g., `/agent-submissions/`) for the subtype detail

### Route structure applied
- List: `/teach/courses/{ID}/assignments/{ID}/submissions` → `SubmissionReview` (handles both)
- Regular detail: `.../submissions/{subId}` → `SubmissionDetail`
- Agent detail: `.../agent-submissions/{subId}` → `AgentSubmissionReview`

## 2026-03-12 — Assignment description rich text migration

Added to fields migrated:
- Assignment description (`CurriculumEditor.tsx`, `AssignmentManager.tsx`, `AssignmentSectionEditor.tsx` → `AssignmentSectionStudent.tsx`, `SubmissionReview.tsx`, `StudentAgentBuilder.tsx`)

## 2026-03-11 — File attachment pattern for assignments

### Pattern: Adding file attachments to a model

1. **Prisma schema**: Create an `XxxAttachment` model (fileName, fileUrl, fileType, fileSize, createdAt) with `onDelete: Cascade` on the parent relation. Add `attachments` relation on the parent model.
2. **Upload endpoint**: Add a type-specific multer filter in `upload.routes.ts` with allowed extensions and size limit. Reuse the existing `storage` config.
3. **Service methods**: Add `getAttachments()`, `addAttachment()`, `updateAttachment()` (rename), `deleteAttachment()` to the parent service. Each checks authorization via course.instructorId.
4. **Routes**: 4 endpoints — GET list, POST create, PUT rename, DELETE remove.
5. **Client types**: Add interface + optional array on parent type.
6. **Client API**: CRUD methods in the parent API file, upload method in `uploads.ts`.
7. **Editor UI**: Reusable `AttachmentManager` component — file list with rename/delete, drag-to-upload area, file input. Rendered after instructions.
8. **Student view**: Download links with file icon, name, type badge, and size. Use `resolveFileUrl()` for absolute URLs.
9. **DB push**: `npx prisma db push` for SQLite dev (interactive `migrate dev` doesn't work in non-interactive terminals).

## 2026-03-12 — Course activation code for enrollment

### Pattern: Adding a gated enrollment with activation code

1. **Schema**: Add nullable `activationCode` field to `Course` model.
2. **Auto-generate on create**: `crypto.randomBytes(4).toString('hex').toUpperCase()` → 8-char hex code (e.g., `A1B2C3D4`).
3. **Server enrollment check**: If course has code, validate `activationCode` param (case-insensitive). Throw 400 if missing or wrong.
4. **Client enrollment flow**: Check `course.activationCode` truthiness. If truthy → show modal with code input. If falsy → enroll directly.
5. **Instructor view**: Display code in CurriculumEditor management card with `navigator.clipboard.writeText()` copy button.
6. **Existing courses**: `activationCode` is nullable, so old courses without a code allow enrollment without one.

## 2026-03-12 — Email verification with activation code

### Pattern: Adding a verification step to registration

1. **Prisma model**: `VerificationCode` with `userId`, `code`, `expiresAt`, `createdAt`. Cascade delete on user.
2. **Register**: Create user with `isConfirmed: false`. Generate code, store with expiry (2 minutes). Return `{ userId, message }` — no token yet.
3. **Verify endpoint**: Validate code + expiry. On success: `isConfirmed: true`, delete code, return `{ user, token }`. On expired: delete code, throw 400.
4. **Resend endpoint**: Delete old codes, create new one with fresh expiry.
5. **Login guard**: Check `isConfirmed` before password check — throw 403 if false.
6. **Client two-step UI**: `step` state (`'register' | 'verify'`). After register success, switch to verify step showing individual digit inputs. Store `userId` in state. After successful verify, call `setAuth()` and navigate.
7. **Digit input UX**: 6 separate inputs with `useRef` array, auto-advance on input, backspace moves back, paste fills all 6 digits. `inputMode="numeric"` for mobile keyboards.
8. **Hardcoded code**: `123456` until SMTP is configured. `resendCode()` regenerates same hardcoded code with fresh expiry.

## 2026-03-13 — Email-based verification flow (no userId exposure)

### Pattern: Avoid exposing internal user IDs in unauthenticated API responses

1. **Register response**: Return `{ email, message }` instead of `{ userId, message }`. The email is already known to the client (they just submitted it).
2. **Verify/resend endpoints**: Accept `{ email, code }` or `{ email }` instead of `{ userId, code }`. Look up user by email on the server side.
3. **Client state**: Store `verifyEmail: string` instead of `userId: number` for the verification step.
4. **Security rationale**: Internal auto-increment IDs reveal user count, creation order, and can be enumerated. Email is already public to the user.

## 2026-03-13 — Route-level enrollment guard pattern

### Pattern: Protecting course content routes with enrollment check

1. **Create a wrapper component** (`RequireEnrollment`) that checks enrollment via API before rendering children.
2. **Extract courseId** from URL params (`useParams`) or query string (`useSearchParams`) — supports both `/courses/:courseId/...` and `/page?courseId=X` patterns.
3. **Bypass for admins/instructors**: Use `useAuth()` to check `isAdmin`/`isInstructor` — they skip enrollment check entirely.
4. **Use TanStack Query** with `staleTime: 5 * 60 * 1000` (5 min cache) to avoid redundant API calls when navigating between pages of the same course.
5. **Wrap routes in App.tsx**: Nest inside `<ProtectedRoute>` (auth check) → `<RequireEnrollment>` (enrollment check) → `<Page />`.
6. **403 UI**: Card with shield icon, "Access Denied" heading, "Not enrolled in this course" message, and action buttons ("View Course", "Browse Courses").
7. **Existing i18n keys**: `errors:access_denied` and `errors:not_enrolled` already exist in all 4 locales.

### Routes protected
All student-facing `courses/:courseId/*` routes: lectures, forums, quizzes, analytics, assignments, agent-assignments, code-labs, grades. Also `/ai-tutors?courseId=X`.

## 2026-03-17 — Team member role assignment constraints

- [instructor-only team members]: `courseRoleService.assignRole()` validates that the target user is an instructor (`isInstructor`) or admin (`isAdmin`). Students cannot be course team members (TA, co-instructor, course_admin).
- [user list role filter]: `userService.getUsers()` accepts optional `role` param: `'instructor'` → `isInstructor: true`, `'admin'` → `isAdmin: true`, `'student'` → both false. The filter combines with `search` using Prisma's `where` object merge. Client passes as query param `?role=instructor`.
- [defense in depth]: Both client (only fetches instructors) and server (rejects students in `assignRole`) enforce the constraint. Client filtering alone is not sufficient — always validate on the server.
- [canManageRoles]: `canManageRoles()` now checks three levels: (1) admin, (2) course owner instructor, (3) team member with `manage_students` permission. This uses the existing `hasPermission()` method which checks `courseRole.permissions` JSON.
- [GET /users access]: Changed from `requireAdmin` to `requireInstructor`. Instructors need to list users for team member assignment. The data returned (profile info, no passwords) is not sensitive. `requireInstructor` still allows admins since the middleware checks `isInstructor || isAdmin`.

## 2026-03-16 — Course page tutor visibility for admins/instructors

- [admin tutor access]: `getStudentTutors()` accepts `options?: { isAdmin?: boolean }`. When `isAdmin` is true, all enrollment/instructor/team checks are skipped. The route passes `isAdmin: true` for both admins and instructors. This follows the pattern of passing role flags from the route to the service rather than looking up the user's role inside the service.
- [avoid redundant API calls]: When a parent API response already includes nested data (e.g., `GET /courses/:id` returns `tutors`), child components should receive that data as props instead of making separate API calls. `CollaborativeModule` no longer calls `getStudentTutors` — it receives `tutors` from `CourseDetails`.
- [route-level role expansion]: When adding role-based access at the route level, check all four cases: enrolled student, team member, admin, and instructor. The `GET /courses/:id` route originally only checked `enrolled || isTeamMember` for tutor loading.

## 2026-03-11 — Many-to-many module linking pattern

### Pattern: Linking items to course modules via join table

1. **Prisma schema**: Create a join model (e.g., `ModuleSurvey`) with `courseId`, `moduleId`, `foreignId`, `addedAt`. Add `@@unique([moduleId, foreignId])` to prevent duplicates. Cascade delete from all parents.
2. **Service methods**: `getModuleItems(moduleId)`, `addItemToModule(courseId, moduleId, itemId, userId, isAdmin)`, `removeItemFromModule(moduleId, itemId, userId, isAdmin)`. Auth checks via `course.instructorId`.
3. **Routes**: GET list, POST add, DELETE remove. Mount under the item's router (e.g., `/surveys/module/:moduleId`).
4. **Client component**: Self-contained in `ModuleItem.tsx` — own queries, mutations, and modal. Use `useMemo` to filter out already-linked items and match search text.
5. **Searchable modal**: Search input with `autoFocus`, filtered list of clickable items, empty state message.
