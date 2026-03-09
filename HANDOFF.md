# Session Handoff — 2026-03-09

## Completed
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
