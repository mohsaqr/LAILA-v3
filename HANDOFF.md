# Session Handoff — 2026-03-10

## Completed
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

## Current State
- Branch: `main`
- Server: 931 tests passing
- Client: compiles cleanly (only pre-existing type warnings in unrelated files)

## Key Decisions
- Agent chatbots use type `'agent'` with category `'agent_assignment'` to distinguish from global/section chatbots
- `isActive` for agent chatbots maps to `!isDraft` (submitted agents are active, drafts are inactive)
- Creator for agent chatbots is the student who designed the agent (not the instructor)
- Usage stats come from `AgentTestConversation`/`AgentTestMessage` tables
- Filter options merge courses and creators from all three sources (global, section, agent) with deduplication

## Open Issues
- Lectures, assignments, quizzes, codeLabs, codeBlocks in seed.ts still use `prisma.*.create()` — will create duplicates on re-seed. Low priority.

## Context
- Dev servers: client on port 5174, server on port 5001
- SQLite database — timestamps stored as epoch milliseconds (integers)
- Pre-push hook runs all tests
- 4 locales: en, fi, ar, es
