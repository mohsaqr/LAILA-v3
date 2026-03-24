### 2026-03-24 — Lab assignment improvements, enrollment fixes, PDF generation

- **Fix duplicate submit button on lab assignments**: When assignment type is lab assignment (`/courses/{id}/assignments/{id}`), the "Your Submission" card (text editor, file upload, submit button) is now hidden since labs have their own submission flow via `LabAssignmentPanel`.
- **Move lab submit button to page bottom**: Moved the "Submit Assignment" button from the lab toolbar (next to Help/Reset) to a full-width button at the bottom of the page. Uses the `Send` icon matching other assignment types.
- **Lab submission panel: close on submit and refresh**: After submitting via `LabAssignmentPanel`, the panel closes automatically and the page refreshes to show updated submission state.
- **Fix PDF preview blocked by Chrome**: Removed `sandbox` attribute from PDF iframes in both `SubmissionDetail.tsx` (instructor view) and `AssignmentView.tsx` (student view). Chrome's PDF viewer requires scripts which the sandbox blocked.
- **PDF filename based on course/assignment/student**: Generated PDF filenames now use the pattern `{CourseName}_assignment-{id}_{StudentName}.pdf` instead of `lab-report-{timestamp}.pdf`. Unicode characters preserved in filenames.
- **Lab assignment submitted/graded states**: When a lab assignment is submitted, the submit button is hidden and a "Waiting for grading" banner is shown. When graded, the grade card with score, percentage, and instructor feedback is displayed.
- **Fix PDF code rendering**: Code blocks in generated PDFs now render as properly formatted text (monospace font, light gray background, line breaks preserved) instead of broken single-line screenshots via `html2canvas`.
- **PDF captures code + output per snapshot**: Each "Add to report" click captures both the code that was run and the output screenshot as a pair. Multiple captures accumulate (different code = new entry, same code = recapture/overwrite). Button shows "Captured — click to recapture" state.
- **Fix PDF snapshot stretching**: Snapshot images in PDFs now preserve their original aspect ratio instead of being stretched to full page width. Images are centered horizontally.
- **Exclude AI Interpretation from snapshots**: The `outputAreaRef` now wraps only the output content box (stdout, stderr, plots), excluding the AI Interpretation section and the "Add to report" button from captures.
- **Grade card moved to bottom**: For all assignment types, the grade card (score, feedback, grading date) now displays at the bottom of the main content area instead of in a separate sidebar column.
- **Allow admins and instructors to enroll in courses**: Removed server-side restriction that blocked admins/instructors from enrolling. All users can now enroll in any published course. Updated `CourseDetails.tsx` — the enroll button shows for any authenticated non-enrolled user. 2 new enrollment tests added.
  - `server/src/services/enrollment.service.ts`: Removed admin/instructor enrollment guard
  - `client/src/pages/CourseDetails.tsx`: Changed `hasAccess` to use `isCourseInstructor` instead of `isActualInstructor`; enroll button condition simplified to `!isEnrolled && isAuthenticated`

### 2026-03-17 — Bug fixes

- **Restrict team member assignment to instructors only**: The "Add Team Member" modal on `/teach/courses/{ID}/edit` previously showed all users (including students). Students cannot be team members. Fixed by: (1) adding `role` filter param to `GET /users` API and `userService.getUsers()`, (2) client `CourseRoleManager` now requests only instructors (`role=instructor`), (3) server-side validation in `courseRoleService.assignRole()` rejects non-instructor/non-admin users with 400 error.
- **Allow instructors and team members to manage course roles**: The `GET /users` endpoint required admin — instructors couldn't fetch the user list for team assignment. Changed from `requireAdmin` to `requireInstructor`. Also updated `canManageRoles()` in `courseRole.service.ts` to allow team members with `manage_students` permission (previously only admins and the course owner instructor could manage roles).
- **Filter course instructor, admins, and existing team members from Add Role list**: The "Add Team Member" dropdown now excludes: the course's main instructor (already has full access), admin users (already have full access), and users who already have a role in the course. `CourseRoleManager` receives `instructorId` prop from `CourseEdit`.
  - `client/src/components/admin/CourseRoleManager.tsx`: Added `instructorId` prop, filter excludes `user.id === instructorId` and `user.isAdmin`
  - `client/src/pages/teach/CourseEdit.tsx`: Passes `course.instructorId` to `CourseRoleManager`
  - `server/src/services/user.service.ts`: Added optional `role` param (`instructor`/`admin`/`student`) to `getUsers()`
  - `server/src/routes/user.routes.ts`: Passes `role` query param to service
  - `client/src/api/users.ts`: Added `role` param to `getUsers()`
  - `client/src/components/admin/CourseRoleManager.tsx`: Fetches only instructors for team member dropdown
  - `server/src/services/courseRole.service.ts`: Added validation rejecting students in `assignRole()`
  - Tests: 4 new in `user.service.test.ts`, new `courseRole.service.test.ts` (8 tests)

### 2026-03-16 — Bug fixes

- **Fix AI tutors invisible to admins and instructors**: Admins and non-owner instructors could not see AI tutor avatars on the course page (`/courses/:id`) because the `GET /courses/:id` route only loaded tutors for enrolled students and team members. Fixed by expanding the tutor-loading condition to include admins and instructors. Updated `courseTutor.service.getStudentTutors()` to accept `options.isAdmin` flag that bypasses enrollment checks. Removed redundant `GET /courses/:courseId/tutors` API call from `CollaborativeModule.tsx` — tutors are now passed as a prop from the course API response, eliminating a duplicate network request.
  - `server/src/routes/course.routes.ts`: Expanded tutor-loading condition from `enrolled || isTeamMember` to include `isAdmin || isInstructor`
  - `server/src/services/courseTutor.service.ts`: Added optional `options: { isAdmin?: boolean }` param to `getStudentTutors()` to skip enrollment checks
  - `client/src/components/course/CollaborativeModule.tsx`: Removed `useQuery` call to `getStudentTutors`; accepts `tutors` prop instead
  - `client/src/pages/CourseDetails.tsx`: Passes `tutors` from course API response to `CollaborativeModule`
  - Tests: New `courseTutor.service.test.ts` (9 tests), 4 new route tests in `course.routes.test.ts`

### 2026-03-13 — Bug fixes #58–#66, auth security improvements

- **#58 Quiz creation in CurriculumEditor**: Added full quiz creation modal with RichTextEditor for description/instructions, time limit, max attempts, passing score, and publish toggle. All modal sizes unified to `3xl`.
- **#59 Unify popup/modal sizes**: Changed all modals in CurriculumEditor, ModuleItem, QuizEditor, QuizManager, MCQGenerator to `size="3xl"`. Simplified empty quiz list page to show only icon + message.
- **#61 Quiz list in module cards**: Added quiz display section to ModuleItem with `grid grid-cols-2 gap-1.5` layout (cyan-50 background), clickable links to quiz editor, delete button. Quiz count shown in module header stats.
- **#62 Quiz editor/manager improvements**: QuizEditor/QuizManager pages updated with `max-w-7xl` margins, HTML rendering of description/instructions via `sanitizeHtml()`, RichTextEditor in settings modal, quiz cards wrapped in `<Link>` for clickability.
- **#63 Analytics card on course page**: Added analytics shortcut card to CourseDetails right sidebar with `BarChart3` icon and indigo styling.
- **#64 Static student sidebar**: Removed course-context switching from DashboardSidebar. Student nav items are now static (no URL-based course ID extraction).
- **#65 Rich text rendering on student quiz pages**: Fixed `StudentQuizList.tsx` and `CourseQuizList.tsx` to render quiz description as HTML via `sanitizeHtml()` + `dangerouslySetInnerHTML`. Added instructions display to `QuizView.tsx` header.
- **Assignment page margin**: Changed `AssignmentView.tsx` container from `max-w-4xl` to `max-w-7xl`.
- **#66 Enrollment permission checking**: Created `RequireEnrollment` wrapper component that checks enrollment via API before rendering course content pages. Shows 403 "Access Denied" page with "View Course" and "Browse Courses" buttons for unauthenticated students. Admins and instructors bypass the check. Applied to 15 routes: lectures, forums, quizzes, analytics, assignments, agent-assignments, code-labs, grades, and ai-tutors. Supports courseId from both URL params and query string.
- **SMTP email verification**: Replaced hardcoded `123456` verification code with `crypto.randomInt(100000, 999999)` random codes. Added `sendVerificationCode()` to `email.service.ts` with styled HTML email template. Extended code expiry from 2 to 10 minutes. Fixed `fromEmail` to check `SMTP_FROM` env var.
- **Analytics auth page skip**: Added `isAuthPage()` guard in `client/src/services/analytics.ts` to skip `/api/analytics/interactions` calls on login/register pages.
- **Auth API security — email-based verification flow**: Changed register response from `{ userId, message }` to `{ email, message }` to avoid exposing internal user IDs. Switched verify-code and resend-code endpoints from userId to email-based lookup. Updated client API types, hooks, Register page state, and all related tests.

### 2026-03-12 — Course activation code for enrollment

- **#56 Activation code for enrollment**: Added `activationCode` column (nullable String) to Course model in `server/prisma/schema.prisma`. Auto-generates random 8-character hex code on course creation in `course.service.ts` using `crypto.randomBytes(4).toString('hex').toUpperCase()`. Modified `enrollment.service.ts` `enroll()` to accept optional `activationCode` param — validates case-insensitively against course's code, throws 400 on mismatch. Updated `enrollment.routes.ts` to pass `activationCode` from request body.
- Client: `CourseDetails.tsx` — if course has activation code, "Enroll Now" opens a modal asking for the code instead of enrolling directly. Modal has text input, submit/cancel buttons. `enrollmentsApi.enroll()` accepts optional `activationCode` param. `CurriculumEditor.tsx` — displays activation code in the management card header with amber styling and a copy-to-clipboard button. Added `activationCode` to client `Course` type.
- i18n: Added 7 keys (`activation_code`, `enter_activation_code`, `activation_code_required`, `activation_code_placeholder`, `enroll`, `code_copied`, `copy_code`) in `courses.json` for all 4 locales.

### 2026-03-12 — Allow re-registration for unverified users

- **#55 Re-registration for unverified emails**: Modified `auth.service.ts` `register()` — if existing user has `isConfirmed: false`, deletes the old record (cascade deletes verification codes) and allows fresh registration. Only throws "Email already registered" for confirmed users. Updated `login()` error for unverified users: "Your account is not verified. Please sign up again and complete the verification." Updated test for duplicate email to set `isConfirmed: true`.

### 2026-03-12 — Restrict registration to UEF emails

- **#54 UEF email restriction**: Added `.refine()` to `registerSchema` in `server/src/utils/validation.ts` — email must end with `@uef.fi`, returns "Only UEF email addresses (@uef.fi) are allowed" on failure. Client-side validation in `Register.tsx` checks before form submission. Added `uef_email_only` i18n key in all 4 locales. Updated test fixtures to use `@uef.fi` emails.

### 2026-03-12 — Email verification with activation code on signup

- **#53 Activation code verification**: Added `VerificationCode` model to `server/prisma/schema.prisma` (id, userId, code, expiresAt, createdAt) with cascade delete on user. Modified `auth.service.ts` `register()`: user created with `isConfirmed: false`, generates 6-digit code (hardcoded `123456` — no SMTP), stores with 2-minute expiry, returns `{ userId, message }` instead of `{ user, token }`. Added `verifyCode()`: validates code + expiry, sets `isConfirmed: true`, deletes code, returns user + JWT token. Added `resendCode()`: regenerates code with fresh 2-minute expiry. Added `isConfirmed` check to `login()` — blocks unverified users with 403. Added `POST /auth/verify-code` and `POST /auth/resend-code` routes in `auth.routes.ts`.
- Client: `client/src/api/auth.ts` — register returns `RegisterResponse` (userId + message), added `verifyCode()` and `resendCode()` methods. `client/src/hooks/useAuth.ts` — register no longer sets auth, added `verifyCode()` hook that sets auth after verification. `client/src/pages/auth/Register.tsx` — two-step UI: (1) registration form, (2) 6-digit code input with individual digit boxes, auto-advance, paste support, resend button, back-to-register link. Uses `ShieldCheck` icon in verify step.
- i18n: Added 13 keys (`verify_email_title`, `verify_email_subtitle`, `verification_code_sent`, `verify_code`, `enter_full_code`, `invalid_code`, `didnt_receive_code`, `resend_code`, `resending`, `code_resent`, `resend_failed`, `back_to_register`, `email_not_verified`) in all 4 locales.
- Tests: Updated `auth.service.test.ts` — mocked `prisma.verificationCode`, updated register tests to expect `{ userId, message }`, added `isConfirmed: true` to login mock users. Updated `auth.routes.test.ts` register test expectations.

### 2026-03-12 — Fix forum card layout and date format

- **#52 Forum card layout**: `client/src/pages/ForumList.tsx` and `client/src/pages/CourseForumList.tsx` — redesigned forum cards to use 3/5 width for description (title, course name, description with `line-clamp-2`) and 2/5 for stats (thread count, date, chevron). Date format changed from `toLocaleDateString()` (locale-dependent) to `en-GB` format: `24 Aug 2025`. Added `flex-shrink-0` on icon/stats, `min-w-0` on description for proper truncation.

### 2026-03-12 — Unify submission routes, rich text descriptions, due date timezone

- **#48 Unified SubmissionReview**: `client/src/pages/teach/SubmissionReview.tsx` rewritten to handle both regular and AI agent submissions inline. Checks `assignment.submissionType === 'ai_agent'` and conditionally fetches via `agentAssignmentsApi.getAgentSubmissions()` or `assignmentsApi.getSubmissions()`. Agent submissions display Bot icon, agent name, version, test conversation count.
- **#49 Fix agent assignment redirect URLs**: All instructor submission URLs unified under `/teach/courses/{ID}/assignments/{ID}/submissions`. Removed separate `/agent-assignments/.../submissions` list route from `App.tsx` and `AgentSubmissionsList` import. Agent detail route changed to `/assignments/{ID}/agent-submissions/{submissionId}`. Updated back-navigation in `AgentSubmissionReview.tsx` and view-answer links in `AgentSubmissionsList.tsx`.
- **#50 RichTextEditor for assignment description**: Replaced `TextArea` with `RichTextEditor` for description field in `CurriculumEditor.tsx` (modal size `md` → `3xl`), `AssignmentManager.tsx` (removed unused TextArea import), and `AssignmentSectionEditor.tsx`. All views render description as sanitized HTML with plain-text fallback (`startsWith('<')` check): `AssignmentSectionStudent.tsx`, `AssignmentSectionEditor.tsx` (read-only), `SubmissionReview.tsx`. Also fixed `StudentAgentBuilder.tsx` to render both description and instructions as HTML.
- **#51 Due date time picker + timezone fix**: Changed `CurriculumEditor.tsx` assignment modal from `type="date"` to `type="datetime-local"`. Fixed timezone: all assignment forms (`CurriculumEditor`, `AssignmentManager`, `AssignmentSectionEditor`, `ModuleItem`) now send `dueDate + ':00.000Z'` instead of `new Date(dueDate).toISOString()` — stores instructor's picked time as literal UTC with no timezone conversion. Fixed edit form population: `.split('T')[0]` → `.toISOString().slice(0, 16)`. All due date displays now use `timeZone: 'UTC'` (`AssignmentSectionStudent`, `AssignmentSectionEditor`, `StudentAssignments`, `CourseAssignments`, `ModuleSection`, `AssignmentItem`, `AssignmentManager`, `SubmissionReview`).

### 2026-03-11 — Add surveys to course modules

- `server/prisma/schema.prisma`: Added `ModuleSurvey` model (many-to-many between modules and surveys) with `@@unique([moduleId, surveyId])`, cascade deletes, and indexes. Added `moduleSurveys` relation to `CourseModule`, `Survey`, and `Course` models.
- `server/src/services/survey.service.ts`: Added `getModuleSurveys()`, `addSurveyToModule()`, `removeSurveyFromModule()` methods with authorization checks.
- `server/src/routes/survey.routes.ts`: Added 3 module survey routes — `GET /module/:moduleId`, `POST /module/:moduleId`, `DELETE /module/:moduleId/:surveyId`.
- `client/src/api/surveys.ts`: Added `getModuleSurveys()`, `addSurveyToModule()`, `removeSurveyFromModule()` API methods.
- `client/src/components/teach/ModuleItem.tsx`: Added "Add Survey" button in module footer, survey display section (indigo styling), and searchable survey selection modal. Self-contained with own queries/mutations.
- `server/src/services/survey.service.test.ts`: Created with 11 tests for module survey CRUD — get, add, remove, authorization, admin override, 404 handling.
- i18n: Added 9 keys (`add_survey`, `survey_added`, `survey_removed`, `failed_to_add_survey`, `select_survey`, `search_surveys`, `no_surveys_available`, `questions`) in all 4 locales.

### 2026-03-11 — Fix lecture-level assignments showing on course page

- `client/src/pages/CourseDetails.tsx`: Filter out assignments with `lectureId` from both module-grouped and standalone assignment lists. Lecture-level assignments now only appear on their lecture page.
- `client/src/pages/LectureView.tsx`: Added `'assignment'` case to `renderSection()` switch, rendering `AssignmentSectionStudent` component. Lecture-level assignments now display inline with a link to the full assignment page.

### 2026-03-11 — Add file attachment support to assignments

- `server/prisma/schema.prisma`: Added `AssignmentAttachment` model (id, assignmentId, fileName, fileUrl, fileType, fileSize, createdAt) with cascade delete on assignment. Added `attachments` relation to `Assignment` model.
- `server/src/routes/upload.routes.ts`: Added `.csv` to `allowedExtensions`. Added `POST /api/uploads/assignment-file` endpoint (3 MB limit, csv/xlsx/png/jpg/jpeg/pdf only, instructor-only).
- `server/src/services/assignment.service.ts`: Added `getAttachments()`, `addAttachment()`, `updateAttachment()` (rename), `deleteAttachment()` methods with authorization checks. Updated `getAssignmentById()` to include attachments ordered by `createdAt`.
- `server/src/routes/assignment.routes.ts`: Added 4 attachment routes — `GET /:id/attachments`, `POST /:id/attachments`, `PUT /attachments/:attachmentId`, `DELETE /attachments/:attachmentId`.
- `client/src/types/index.ts`: Added `AssignmentAttachment` interface and `attachments?` field to `Assignment`.
- `client/src/api/assignments.ts`: Added `getAttachments()`, `addAttachment()`, `updateAttachment()`, `deleteAttachment()` API methods.
- `client/src/api/uploads.ts`: Added `uploadAssignmentFile()` method.
- `client/src/components/teach/AssignmentSectionEditor.tsx`: Added `AttachmentManager` component (exported) with file upload, rename, delete. Renders after instructions in both edit and create forms.
- `client/src/pages/teach/AssignmentManager.tsx`: Added `AttachmentManager` in edit modal (only visible when editing existing assignment).
- `client/src/pages/AssignmentView.tsx`: Added attachments card between instructions and submission area. Files are downloadable with file type and size display.
- i18n: Added 10 keys (`file_attachments`, `click_to_upload_files`, `allowed_file_formats`, `max_3mb`, `files_uploaded`, `file_upload_failed`, `file_too_large`, `uploading`, `rename`) in all 4 locales (en, fi, ar, es).
- `server/src/services/assignment.service.test.ts`: Added 8 tests for attachment CRUD — get, add, rename, delete, authorization, 404 handling, and inclusion in getAssignmentById.

### 2026-03-11 — Use rich text editor for assignment instructions

- `client/src/pages/teach/AssignmentManager.tsx`: Replaced `TextArea` for the instructions field with `RichTextEditor`. Added import.
- `client/src/components/teach/AssignmentSectionEditor.tsx`: Replaced all `TextArea` instances for instructions (edit and create forms, different indentation levels) with `RichTextEditor`. Added import.
- `client/src/pages/AssignmentView.tsx`: Replaced `<ReactMarkdown>` rendering of instructions with `dangerouslySetInnerHTML` + `sanitizeHtml()`. Detects HTML vs plain text content. Added `sanitizeHtml` import.
- `server/src/services/assignment.service.test.ts`: Added 3 tests for HTML instructions support — create, update, and getById all correctly pass through HTML content.

### 2026-03-11 — Use rich text editor for lecture text sections

- `client/src/components/teach/TextSection.tsx`: Replaced plain `<textarea>` + manual markdown renderer + preview toggle with `RichTextEditor`. Removed label and placeholder. Set larger editor height via `editorClassName` (min-h 300px, max-h 600px).
- `client/src/components/forum/RichTextEditor.tsx`: Added `editorClassName` prop to allow custom sizing per use case.
- `client/src/pages/LectureView.tsx`: Text and AI-generated sections now detect HTML content (starts with `<`) and sanitize directly, falling back to markdown parsing for legacy content.

### 2026-03-11 — Use rich text editor for course description

- `client/src/components/teach/CourseForm.tsx`: Replaced `TextArea` with `RichTextEditor` for description. Label uses `common:description` for capitalized "Description".
- `client/src/pages/CourseDetails.tsx`: Render description as sanitized HTML with `prose prose-invert`.
- `client/src/pages/teach/CurriculumEditor.tsx`: Render description as sanitized HTML with `prose dark:prose-invert`.
- `client/src/components/course/CourseHeader.tsx`: Render description as sanitized HTML.
- `client/src/pages/Catalog.tsx`: Strip HTML tags for card preview text.
- `client/src/pages/teach/TeachDashboard.tsx`: Strip HTML tags for card preview text.

### 2026-03-11 — Replace thumbnail URL input with file upload

- `client/src/components/teach/CourseForm.tsx`: Replaced "Thumbnail URL" text input with file upload widget (drag-and-drop area, preview with remove button, client-side validation for type and size).
- `client/src/api/uploads.ts`: New file with `uploadsApi.uploadThumbnail()` function.
- `server/src/routes/upload.routes.ts`: Added `POST /api/uploads/thumbnail` endpoint — requires instructor auth, 1 MB limit, png/jpg/jpeg only with MIME validation.
- `client/public/locales/{en,ar,es,fi}/teaching.json`: Added 5 new i18n keys for thumbnail upload, updated `thumbnail_help` text.

### 2026-03-10 — Fix sidebar disappearing on multiple pages

- `client/src/components/layout/Layout.tsx`: The `sidebarPages` array only included `/dashboard`, `/courses`, `/ai-tools`, `/ai-tutors`, `/settings`, `/profile`, `/teach`. Added `/course`, `/labs`, `/forums`, `/certificates`, `/certificate`, `/quizzes`, `/admin`. Removed the `!location.pathname.startsWith('/admin')` exclusion so the sidebar also shows on admin Logs and Analytics pages.

### 2026-03-10 — Replace plain selects with searchable dropdowns in Course Catalog and Course Create form

- `client/src/pages/Catalog.tsx`: Added `SearchableSelect` component matching the `CategoryMultiSelect` style. Replaced the plain `<select>` for difficulty/level filter.
- `client/src/components/teach/CourseForm.tsx`: Added `SearchableSelect` component with optional `label` and `infoPopup` props. Replaced both plain `<Select>` elements (difficulty level and curriculum view mode) with searchable dropdowns. Removed unused `Select` import.

- `client/src/pages/Catalog.tsx`: Added `SearchableSelect` component matching the `CategoryMultiSelect` style (same border, focus ring, chip display, search input, dropdown list). Replaced the plain `<select>` for difficulty/level filter with `SearchableSelect`. Selected value shows as a removable chip, dropdown has a search field and radio-style indicators.

### 2026-03-10 — Clean up navbar and sidebar navigation

- `client/src/components/layout/Navbar.tsx`: Removed Dashboard and Courses from `navItems` (already in sidebar). Removed AI Tools for instructors (only admins see it in navbar now). Removed unused `BookOpen` and `GraduationCap` imports.
- `client/src/components/layout/DashboardSidebar.tsx`: Changed `t('my_courses')` to `t('courses')` for both student and instructor nav items. Moved AI Tools from last position to third (after Dashboard and Courses) in instructor sidebar.

### 2026-03-10 — Fix auto-route and random mode chat history not persisting

- `server/src/services/tutor.service.ts`: `handleRouterMode()` and `handleRandomMode()` were storing messages under the routed/random agent's conversation, so on page reload the client fetched the first agent's (team chat) conversation and found it empty. Fixed by using the same "team chat" unified conversation pattern as collaborative mode — `agents[0]` is always used for conversation storage. The routed agent's identity is preserved in `routingInfo` on the messages. The routed agent's system prompt and personality are still used for the AI response.

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
