# Session Handoff — 2026-03-09

## Completed
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
- Server: 930 tests passing
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
