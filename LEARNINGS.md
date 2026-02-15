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
- [4 routing modes]: Manual (student picks), Router (fast keyword scoring), Collaborative (parallel/sequential/debate/random multi-agent), Random. Set per-session via `tutor.service.updateMode()`.
- [keyword router]: Zero-latency — no LLM call. Scores messages against 7 categories (conceptual, problem-solving, emotional, study strategies, project, writing, discussion). Each agent has weighted keywords with base and boost scores.
- [collaborative synthesis]: After all agents respond, a synthesis message is generated. Each agent contribution tagged with agent name and personality.
- [agent builder]: Students design agents via 4-tab interface (identity, behavior, advanced, test). 10 role templates, 7 personality presets, 38 prompt blocks in 6 categories (persona, tone, behavior, constraint, format, knowledge). Blocks auto-combined in category order.
- [design analytics]: AgentDesignEventLog captures field-level changes, tab timing, template/block selections, version snapshots, test conversations, reflections. 30+ fields per event. Used for research on design-as-learning.

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
- [emotional pulse]: 7 states (productive, stimulated, learning, enjoying, frustrated, bored, quitting). Recorded with context (chatbot/tutor/lecture), contextId, agentId. Instructor views: aggregated stats + timeline.
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
