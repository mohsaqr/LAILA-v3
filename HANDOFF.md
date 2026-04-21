# Session Handoff — 2026-04-21

## Completed (2026-04-21, uncommitted)
- **Auth-guard leak fix**: wrapped `/courses`, `/courses/:id`, `/verify/:code`, `/surveys/:id` in `ProtectedRoute`. Only `/login`, `/register`, `/forgot-password` remain public content pages (landing is a pure `<Navigate>` redirect).
- **Instructor student roster**:
  - `client/src/pages/teach/CourseStudents.tsx` — table at `/teach/courses/:courseId/students` with search, status filter, pagination, and 4-action rows.
  - `client/src/pages/teach/StudentCourseActivity.tsx` — instructor drill-down at `/teach/courses/:courseId/students/:userId/activity` with Activity-Log and Analytics tabs, scoped to that course+student.
  - `client/src/components/teach/AddToTeamModal.tsx` — role picker (`ta` / `co_instructor` / `course_admin`) calling `courseRolesApi.assignRole`.
  - `client/src/pages/teach/CourseLogs.tsx` — now reads `?userId` from URL, passes as `initialUserId` to `ActivityLogsTab`.
  - `client/src/components/layout/DashboardSidebar.tsx` — "Students" instructor sidebar entry retargeted at the new page.
  - i18n strings added to `teaching.json` in en/fi/es/ar.
- **Known follow-up**: activity-log endpoints (`/api/activity-log/*`) accept arbitrary `userId` without checking the caller's relationship to that user — pre-existing permissiveness. The new instructor drill-down relies on this. Worth tightening (instructor-of-course OR self, admin bypass) as a security hardening in a future pass.

## Completed (2026-04-10)
- **Markdown chat + CSV detection**: Agent chat renders markdown. CSV in code blocks auto-detected, saved to `user_datasets`, shows download + SNA/TNA visualization buttons inline.
- **Inline network visualization**: Full controls (layout, size by centrality, node/edge size, labels, directed toggle) rendered inside chat messages.
- **UseMyAgent redesign**: Assignment-style layout, fixed chat height, no page scroll.
- **Conversation history**: Listed on Test & Reflect start page. Clickable to load. 0-message conversations filtered server-side.
- **TNA submission display**: Matching SNA pattern — submission card, resubmit, file attachments. Panel closes + reloads on submit.
- **Datasets tab** simplified to list-only. "Datasets" button on submitted view.
- **Route fix**: `/test/history` before `/test/:conversationId`.

## Completed (2026-04-09)
- **SNA/TNA exercise redesign**: Graph controls in horizontal toolbar above SVG. Analysis blocks as horizontal pill buttons. Searchable dropdowns. Drag-and-drop nodes. Responsive viewBox. Node labels toggle + font size. Directed/undirected toggle. Capture: network + analysis separately via html2canvas. Delete snapshots.
- **TNA assignment header**: Status badge, points, due date, grace period, submission type (matching SNA). Submit button bottom right-aligned.
- **Responsive SVG charts**: All 5 chart components use `useContainerWidth` hook — no hardcoded widths.
- **Admin analytics toolbar**: Searchable dropdowns, node labels, label size, DeferredSlider, expanded centrality options.
- **New components**: `SearchableSelect`, `useContainerWidth` hook.

## Completed (2026-04-08)
- **Auth/security**: JWT 30d expiry, token check on app load, `/users/me/stats` (no user ID in URL).
- **Agent assignment logging**: All events logged to global LearningActivityLog.
- **Analytics filters**: Searchable student/course on all tabs, enrollment-based user filtering, instructor course restriction.
- **Agent avatar upload**: File upload replaces URL input.
- **Datasets tab** in instructor submission review.
- **PostgreSQL-compatible SQL** for activity log queries + timezone support.
- **TNA category mapping**: 7 learning states, verb remapping, TNA grouping by actor (not session).
- **Free preview lectures**, breadcrumb fixes, page layout unification.

## Completed (2026-04-07)
- **Prisma local/prod directory restructure**: Split `server/prisma/` into `local/` (SQLite, gitignored) and `prod/` (PostgreSQL, committed). Each has its own `schema.prisma` and `migrations/`. `setup:local` script generates local schema from prod. All package.json scripts and deploy script updated. Eliminates the SQLite/PostgreSQL migration lock conflict that prevented `npx prisma migrate dev` from working locally.

## Completed (2026-03-31)
- **Assignment grace period deadline**: Added optional `gracePeriodDeadline` column to `Assignment` model. When set, students can still submit between the due date and the grace deadline (yellow warning shown). Submissions blocked after grace deadline. Server: validation in create/update ensures grace > due. `submitAssignment` and `submitAgentConfig` use 3-state check (on time / grace / blocked). Client: all assignment views (AssignmentView, SnaExercise, TnaExercise, StudentAgentBuilder, UseMyAgent) use `isInGracePeriod`/`isFullyPastDue`. Grace period input in all 4 instructor forms (AssignmentManager, ModuleItem, AssignmentSectionEditor). i18n in 4 locales.

## Completed (2026-03-27)
- **Assignment resubmission before grading**: Students can now resubmit any assignment type (text/file, lab, SNA exercise, TNA exercise) until the instructor grades it. Server: removed the resubmission block in `assignment.service.ts` (graded guard remains). Client: added "Resubmit" button/flow to `AssignmentView.tsx` (normal + lab), `LabAssignmentPanel.tsx`, `SnaExercise.tsx`, `TnaExercise.tsx`, and `LabRunner.tsx`. i18n `resubmit` key in 4 locales.

## Completed (2026-03-26)
- **Forgot password feature**: 3-step flow (email → 6-digit verification code → new password). Reuses `VerificationCode` model with 10-minute expiry. Auto-login after reset. New page at `/forgot-password`, link on login page, 401 interceptor exclusion added.
- **All users can enroll and complete lectures**: Removed role-based restrictions. Admins see the Enroll button (no longer forced `enrolled: true`). `markLectureComplete` and `getProgress` work for all enrolled users. Complete button visible to everyone.

## Completed (2026-03-25)
- **SNA exercise page assignment integration**: Full assignment header card with breadcrumbs, deadline, status badge, submit button, submitted/graded states, and grade card — matching the lab template assignment page design.
- **Hide interactive labs when linked as assignments**: Interactive lab entries (TNA/SNA) in module sections are hidden when a published assignment with matching `agentRequirements` exists. Added `agentRequirements` to course `getCourseById` select.
- **Display standalone CustomLabs**: `LabAssignment` records without an assignment now appear as lab items on the course page, linking to `/labs/{id}?courseId={id}`.
- **Fix enrollment route for admins/instructors**: Route now calls `getEnrollment` for all users, returning course data in breadcrumbs.
- **Removed redundant `assignmentId` from exercise redirect URLs**.
- **SNA sidebar**: Custom network/AI buttons on separate lines.
- **Past-due submit hidden for all lab types**: Lab templates, SNA, TNA all hide submit button and panel when due date passed.
- **SNA report capture overhaul**: SVG serialization for network graph (no clipping), separate html2canvas for analysis, excludes guide/AI/buttons, analysis-specific keys allow multiple centrality captures.
- **Network graph node clipping fix**: `TnaNetworkGraph` padding accounts for max centrality-scaled node radius.
- **Submission content visible after submit**: Lab assignments and SNA exercises show submitted text/files (with PDF preview) for both submitted and graded states.
- **TNA exercise due date/submission state**: Added submission query and past-due/submitted/graded gating.

## Completed (2026-03-24)
- **Lab assignment submission flow overhaul**: Hid duplicate "Your Submission" card for lab assignments. Moved submit button to page bottom. Panel closes on submit and page refreshes. Submitted/graded states now show correctly (waiting for grading banner, grade card with feedback).
- **PDF generation fixes**: Code renders as formatted text (not broken screenshot). Each snapshot captures code + output as a pair. Fixed horizontal stretching (aspect ratio preserved). Excluded AI Interpretation and buttons from captures. PDF filename uses `{course}_{assignment}_{student}.pdf`.
- **Fix PDF preview in Chrome**: Removed `sandbox` attribute from PDF iframes in student and instructor views.
- **Grade card layout**: Moved from sidebar column to bottom of main content for all assignment types.
- **Allow all users to enroll**: Removed server restriction blocking admin/instructor enrollment. Enroll button shows for any non-enrolled authenticated user. 2 new tests.

## Completed (2026-03-17)
- **Restrict team member assignment to instructors**: "Add Team Member" dropdown on course edit page now only shows instructors (not students). Added `role` filter to `GET /users` API. Server-side validation rejects students in `assignRole()`. 12 new tests.
- **Allow instructors and team members to manage course roles**: `GET /users` changed from admin-only to instructor-accessible. `canManageRoles()` now also allows team members with `manage_students` permission. 6 new tests.
- **Filter ineligible users from Add Role dropdown**: Excludes the course instructor, admins, and existing team members from the "Add Team Member" list.

## Completed (2026-03-16)
- **Fix AI tutors invisible to admins/instructors**: Route `GET /courses/:id` only loaded tutors for enrolled students and team members — admins and non-owner instructors saw empty tutor list. Fixed server route + service to allow admin/instructor access. Removed redundant `getStudentTutors` API call from `CollaborativeModule` — now uses tutors from course response prop. 13 new tests.

## Completed (2026-03-13)
- **Quiz creation in CurriculumEditor (#58)**: Full quiz creation modal with RichTextEditor for description/instructions. All CurriculumEditor modal sizes unified to `3xl`.
- **Unify popup/modal sizes (#59)**: All modals across CurriculumEditor, ModuleItem, QuizEditor, QuizManager, MCQGenerator changed to `size="3xl"`. Simplified empty quiz list page.
- **Quiz list in module cards (#61)**: Quizzes displayed in ModuleItem with `grid grid-cols-2 gap-1.5` layout (cyan-50), clickable links to quiz editor, delete support. Quiz count in module header.
- **Quiz editor/manager improvements (#62)**: `max-w-7xl` margins, HTML rendering via `sanitizeHtml()`, RichTextEditor in settings, clickable quiz cards with `<Link>`.
- **Analytics card on course page (#63)**: Added to CourseDetails right sidebar with `BarChart3` icon and indigo styling.
- **Static student sidebar (#64)**: Removed course-context switching from DashboardSidebar. Student nav items are static.
- **Rich text rendering on student quiz pages (#65)**: Fixed `StudentQuizList.tsx`, `CourseQuizList.tsx`, and `QuizView.tsx` to render description/instructions as sanitized HTML.
- **Assignment page margin**: `AssignmentView.tsx` container from `max-w-4xl` to `max-w-7xl`.
- **Enrollment permission checking (#66)**: `RequireEnrollment` wrapper component checks enrollment via `enrollmentsApi.getEnrollment()` before rendering. Shows 403 page for unenrolled students. Admins/instructors bypass. Applied to 15 routes in App.tsx. Supports courseId from URL params and query string.

## Completed (2026-03-12)
- **Course activation code (#56)**: Auto-generated 8-char hex code per course. Displayed in CurriculumEditor with copy button. Students must enter code to enroll (modal popup). Server validates case-insensitively. 7 i18n keys in 4 locales.
- **Re-registration for unverified users (#55)**: Unverified users can sign up again — old unconfirmed record is deleted (cascade). Login for unverified users shows "sign up again and verify" message.
- **UEF email restriction (#54)**: Registration limited to `@uef.fi` emails via Zod `.refine()` on server + client-side check. i18n key `uef_email_only` in 4 locales.
- **Email verification on signup (#53)**: Two-step registration flow. `VerificationCode` Prisma model stores 6-digit code with 10-minute expiry. Register creates unverified user + code, returns email (not userId). Verify/resend endpoints use email-based lookup. Verification code sent via SMTP email (`email.service.ts`). Client shows 6-digit code input UI with auto-advance, paste support, resend. 13 i18n keys in 4 locales. Tests updated.
- **Unified SubmissionReview (#48)**: `SubmissionReview.tsx` now handles both regular and AI agent submissions inline. Conditionally queries the right API based on `assignment.submissionType`.
- **Fix agent assignment redirect URLs (#49)**: All instructor submission list URLs unified under `/teach/courses/{ID}/assignments/{ID}/submissions`. Removed `/agent-assignments/.../submissions` route. Agent submission detail at `/assignments/{ID}/agent-submissions/{submissionId}`.
- **RichTextEditor for assignment description (#50)**: Replaced TextArea with RichTextEditor in CurriculumEditor, AssignmentManager, AssignmentSectionEditor. HTML rendered with sanitization in all student/instructor views. Fixed StudentAgentBuilder to render instructions/description as HTML.
- **Due date time picker + timezone (#51)**: Changed to `datetime-local` input. Fixed timezone by sending literal time as UTC (`value + ':00.000Z'`). All displays use `timeZone: 'UTC'`. Instructor picks 20:00 → DB stores 20:00Z → everyone sees 20:00.
- **Forum card layout (#52)**: Redesigned forum cards with 3/5 description + 2/5 stats, date format `24 Aug 2025`.
- **Static instructor sidebar (#33)**: No course-context switching, removed gradebook/calendar for instructors.
- **Margins/breadcrumbs for teach pages (#38)**: Standardized `max-w-7xl` and simplified breadcrumbs for labs, quizzes, surveys, certificates.
- **Certificates button in CurriculumEditor (#43)**: Added Certificates + Analytics buttons to management card.
- **Survey responses filter by moduleId (#45)**: Full stack fix: client → API → route → service → Prisma query.
- **Assignment edit modal width (#46)**: `lg` → `3xl`.
- **Survey API type fixes**: Replaced `any` with `Survey` in module survey API methods.
- **Interactive element fixes**: Fixed nested Link>Button, missing type="button" on attachment buttons.

## Completed (2026-03-11)
- **Thumbnail file upload**: Replaced "Thumbnail URL" text input on `/teach/create` with image file upload (png/jpg/jpeg, 1 MB limit). New `POST /api/uploads/thumbnail` endpoint, client upload API, preview with remove button, i18n in all 4 languages.
- **Rich text course description**: Replaced plain TextArea with RichTextEditor for course description. HTML rendered with sanitization on view pages (CourseDetails, CurriculumEditor, CourseHeader). Tags stripped for card previews (Catalog, TeachDashboard).
- **Rich text lecture sections**: Replaced plain textarea + markdown preview in TextSection with RichTextEditor (300px min height). LectureView detects HTML vs legacy markdown and renders accordingly. Added `editorClassName` prop to RichTextEditor for custom sizing.
- **Rich text assignment instructions**: Replaced TextArea with RichTextEditor for instructions in AssignmentManager and AssignmentSectionEditor (both edit and create forms). AssignmentView renders HTML with sanitization, falling back to wrapping plain text in `<p>` tags. Added 3 tests for HTML instructions handling.
- **Fix lecture-level assignments display**: Assignments with `lectureId` no longer appear on the course page (`CourseDetails.tsx`). Added `'assignment'` case to `LectureView.tsx` `renderSection()` so they render inline on the lecture page via `AssignmentSectionStudent`.
- **Assignment file attachments**: Instructors can upload multiple files (csv, xlsx, png, jpg, pdf; 3 MB limit) to assignments. Files appear after instructions in the editor with rename/delete. Students see downloadable attachments on AssignmentView. New `AssignmentAttachment` model, `POST /api/uploads/assignment-file` endpoint, full CRUD API. 8 tests added.

## Completed (2026-03-10)
- **Fix sidebar disappearing**: Sidebar was missing on Labs, Forums, Certificates, Quizzes (students), Labs/Forums (instructors), and Logs/Analytics (admins). Added missing paths to `sidebarPages` in `Layout.tsx` and removed the `/admin` exclusion.
- **Searchable select dropdowns**: Replaced plain `<select>` elements with searchable dropdowns in Course Catalog (level filter) and Course Create/Edit form (difficulty + curriculum view mode). All match the category multi-select style. Replaced the plain `<select>` for difficulty/level with a `SearchableSelect` dropdown matching the category multi-select style (search, chips, consistent colors).
- **Clean up navbar and sidebar navigation**: Removed Dashboard, Courses, and AI Tools (for instructors) from navbar. Renamed sidebar "My Courses" to "Courses". Moved AI Tools to third position in instructor sidebar.
- **Fix auto-route/random chat history not persisting**: Router and random modes stored messages under the routed agent's conversation, but on reload the client fetched the first agent's (team chat) conversation. Fixed by using `agents[0]` for unified conversation storage (same pattern as collaborative mode). The routed agent's prompt/personality still drives the AI response.
- **Fix "Reply to Thread" button**: The button appeared to do nothing because the reply form was already rendered at the bottom (with `replyingToId === null`). Now scrolls to the form on click.
- **Fix button font size and Forum layout**: Added `text-sm` to the default (`md`) Button size class. On the Forum page, added `whitespace-nowrap flex-shrink-0` to the "+ New Discussion" button and `min-w-0`/`truncate` to the title so the button never wraps to two lines.
- **Fix auto-route/random/collaborative missing courseId**: `handleRouterMode()`, `handleRandomMode()`, and `handleCollaborativeMode()` were calling `getOrCreateConversation()` without `courseId`, causing "Session not found" errors in course-scoped sessions. Fixed by passing `courseId` through.
- **AI tutor responds to emotional pulses**: When a student selects an emotion via the EmotionalPulseWidget, it's stored client-side and sent with the next chat message. On the server, `sendMessage()` also falls back to the most recent DB pulse (within 30 min). The emotion is injected into every AI tutor's system prompt as a `STUDENT EMOTIONAL STATE` section with tailored guidance (e.g., "Be extra patient" for frustrated, "Re-spark interest" for bored). Works across all modes: manual, router, random, and collaborative.
- **Course-specific tutor sessions**: `TutorSession` now has a `courseId` column with `@@unique([userId, courseId])`. Each course gets its own session, conversations, and message history. A student chatting with Carmen in course 2 won't see those messages in course 4. All API endpoints, service methods, and client queries pass `courseId` through. Existing sessions (with `courseId=null`) continue to work for the TestCorner page.
- **Fix auto-route selecting tutors outside course**: Router, random, and collaborative modes now filter available tutors to only those assigned to the current course (via `CourseTutor` model). `courseId` flows from client URL → request body → `sendMessage()` → mode handlers → `getAvailableAgents(courseId)`. When no `courseId` is provided (e.g., global tutor page), falls back to all tutors.
- **TNA charts in agent design analytics**: Added ActivityDonutChart, TnaIndexPlot, and TnaNetworkGraph below the Activity Breakdown on the submission review page. Charts visualize the student's design process as a transition network using `dynajs`. Events are mapped from raw categories to human-readable labels (Sessions, Field Changes, Testing, etc.).
- **Fix incorrect Total Design Time**: Summary/Analytics tabs now show the correct total design time by preferring the last event's cumulative `totalDesignTime` field (client-logged elapsed seconds) over the server's session event pair calculation. The Full Time Timeline's last item was already correct; now Summary/Analytics match it.
- **Rich text editor for forum replies and thread creation**: Replaced plain textarea in `ForumReplyInput` with tiptap rich text editor (bold, italic, underline, heading, lists, code block, link, image upload). Images compressed to max 500 KB client-side then uploaded to server (not base64). Images display at max 300px width in editor and rendered content. Created reusable `RichTextEditor` for thread creation. Content rendered as sanitized HTML with DOMPurify and Tailwind typography. Server content limit increased from 10K to 50K chars.
- **Assignment creation popup in curriculum editor**: Clicking the Assignment button in the curriculum editor now opens a modal with the full assignment creation form instead of redirecting. Creates both the assignment and the assignment section in one flow.
- **File upload popup in curriculum editor**: Clicking the File button in the curriculum editor now opens a modal with drag-and-drop upload and file name editing, instead of redirecting to the lecture editor. Creates the file section directly via API.
- **Section buttons for empty lectures only**: In curriculum editor, section add buttons (Text, File, AI, Chatbot, Assignment) now only appear for lectures with no sections. Lectures with content just show "Manage Content". File sections display inline with download and rename. Server query updated to include section data.
- **Guard ai_agent submissions**: Added server-side guard in `assignment.service.submitAssignment()` that rejects `ai_agent` type assignments with a 400 error. Previously, if the regular submit endpoint was called on an agent assignment, it would overwrite the submission with text content and lose the `agentConfigId` link. Agent assignments must go through the dedicated `agentAssignment.service.submitAgentConfig()` endpoint, which properly handles the unsubmit→edit→resubmit cycle.
- **Fix templateUsage null**: `templateUsage.roleUsed` and `personalityUsed` were null because early design events (role_selected, personality_selected) are logged before `agentConfigId` is set. Now falls back to `StudentAgentConfig.pedagogicalRole` and `.personality` columns.
- **Fix totalDesignTime null**: `totalDesignTime` in agent design analytics was always 0/null because `design_session_end` events sent via `sendBeacon` lacked `Content-Type: application/json`, so Express silently dropped them. Fixed two things: (1) server now computes design time from event timestamp pairs (start/resume → pause/end) instead of relying on client-reported value; (2) client `flushSync` now sends a `Blob` with proper content type.
- **Save button moved to settings card**: In LectureEditor, removed the save button from the page header and placed it inside the "Lesson Settings" sidebar card. The button now reads "Save Settings" to clarify it only saves lesson settings (content type, duration, video URL, free preview) — sections auto-save independently.
- **Editable file section names**: Instructors can now rename file sections. After uploading a file, the name input auto-focuses for renaming. An edit (pencil) icon next to the file name allows renaming at any time. The name is saved as `fileName` in the database via the existing `updateSection` API. Enter to save, Escape to cancel.
- **Agent chatbots in Chatbot Registry**: Student-designed AI agents from agent assignments are now visible in the admin Chatbot Registry as a third type (`agent`) alongside `global` and `section`.
  - Server: `chatbotRegistry.service.ts` — added `StudentAgentConfig` query with `AgentTestConversation`/`AgentTestMessage` stats, updated `getStats()` and `getFilterOptions()` to include agent data
  - Client: `ChatbotRegistryTab.tsx` — added agent filter, stats card, type badge (amber/Puzzle icon), course context in expanded details
  - Client: `admin.ts` types updated (`'agent'` in type unions, `agentChatbots` in stats)
  - Client: `constants.ts` — added amber color for agent type badge
  - i18n: `agent_chatbots`, `agent`, `agent_assignment`, `course_context`, `designed_by` keys in all 4 locales

## Completed (2026-03-11, continued)
- **Curriculum editor UI fixes**: Changed main content width from `max-w-4xl` to `max-w-7xl` to match course page. File sections displayed in two-column grid instead of full-width. Breadcrumb changed from "Teaching" to "Courses".
- **Add surveys to course modules**: Many-to-many `ModuleSurvey` model linking surveys to modules. "Add Survey" button in module footer opens searchable modal showing published surveys not yet linked. Surveys display with indigo styling and remove button. Full server CRUD with authorization. 11 tests added.

## Current State
- Branch: `dev`
- Client: compiles cleanly (only pre-existing type warnings in unrelated files)
- Server: 89 pre-existing test failures (section, module, lecture, forum, course, assignment, enrollment services — all related to missing `prisma.courseRole` mock), not caused by this session's changes
- New component: `client/src/components/layout/RequireEnrollment.tsx` — reusable enrollment guard for routes

## Key Decisions
- Agent chatbots use type `'agent'` with category `'agent_assignment'` to distinguish from global/section chatbots
- `isActive` for agent chatbots maps to `!isDraft` (submitted agents are active, drafts are inactive)
- Creator for agent chatbots is the student who designed the agent (not the instructor)
- Usage stats come from `AgentTestConversation`/`AgentTestMessage` tables
- Filter options merge courses and creators from all three sources (global, section, agent) with deduplication
- Due dates use "wall clock" pattern: stored as literal UTC, displayed with `timeZone: 'UTC'` — no timezone conversion
- Registration uses two-step flow: register → verify code. Hardcoded code `123456` until SMTP is configured. Code expires after 2 minutes
- Instructor submission routes unified: `/teach/courses/{ID}/assignments/{ID}/submissions` handles both regular and agent types
- Student-facing agent routes (`/courses/{ID}/agent-assignments/{ID}`) unchanged
- Lab assignments hide the generic "Your Submission" card — submission goes through `LabAssignmentPanel` only
- `LabRunnerUI` accepts `hideSubmit` prop to suppress submit button when embedded in `AssignmentView` and already submitted/graded
- PDF report items use code content as key: same code = recapture (overwrite), different code = new entry
- All users (admins, instructors, students) can enroll in any published course — no role-based enrollment restrictions
- Grade card displays inline at bottom of assignment page, not in a sidebar column
- Interactive labs (TNA/SNA) are hidden from module content when a published assignment with matching `agentRequirements` exists — avoids duplicate entries
- Standalone `CustomLab` (via `LabAssignment` with `assignmentId: null`) appears as lab content item, links to `/labs/{id}?courseId={id}`
- Enrollment route no longer short-circuits for admins/instructors — always calls `getEnrollment` to return course data
- Exercise pages find their assignment automatically via `agentRequirements` — no `assignmentId` query param needed
- SNA report capture uses SVG serialization for the network graph (bypasses html2canvas clipping) and html2canvas for analysis cards; combined into single image
- SNA capture keys are analysis-specific (e.g., `centrality-InDegree-chart`) so multiple centrality measures can coexist in the report
- `TnaNetworkGraph` padding uses `maxNodeScale` to prevent centrality-scaled nodes from being clipped
- Submission content (text + files) shown to students after submit for all assignment types (lab, SNA, TNA), not just after grading

## Open Issues
- Lectures, assignments, quizzes, codeLabs, codeBlocks in seed.ts still use `prisma.*.create()` — will create duplicates on re-seed. Low priority.
- **Bug #47 (discarded)**: AI agent assignment creation in lecture editor — changes were coded then discarded at user's request. Bug remains unfixed.

## Context
- Dev servers: client on port 5174, server on port 5001
- Database: `prisma/prod/schema.prisma` (PostgreSQL, source of truth), `prisma/local/schema.prisma` (SQLite, gitignored, auto-generated)
- Schema change workflow:
  1. Edit `prisma/prod/schema.prisma`
  2. `npm run setup:local` (regenerate local schema)
  3. `npm run db:push` (sync local SQLite)
  4. `npm run db:migrate:prod -- --name <name>` (generate PostgreSQL migration file — no DB needed)
  5. Commit schema + migration file
- Production deployment: `npx prisma migrate status --schema prisma/prod/schema.prisma` to check pending, then `npx prisma migrate deploy --schema prisma/prod/schema.prisma` to apply
- `npm run dev` auto-runs `setup:local` to regenerate local schema
- Pre-push hook runs all tests
- 4 locales: en, fi, ar, es
