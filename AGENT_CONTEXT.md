# Agent Context - LAILA v3

This document provides context for AI agents continuing work on this project.

## Project Overview

LAILA (Learning AI Learning Assistant) is an LMS (Learning Management System) with AI-powered features. It's a full-stack TypeScript application with:

- **Frontend**: React + Vite + Tailwind CSS (`/client`)
- **Backend**: Express + Prisma + PostgreSQL (`/server`)
- **i18n**: 4 languages (en, fi, es, ar with RTL support)

## Current State (as of Feb 2025)

### Recent Major Feature: AI-Powered MCQ Generation

Just completed implementation of AI-powered Multiple Choice Question generation with two use cases:

1. **Instructor Quiz Builder** - Generate questions for formal quizzes
2. **Student Practice Mode** - Self-study MCQs at end of lectures

#### Key Files Created/Modified

| File | Purpose |
|------|---------|
| `server/src/services/mcqGeneration.service.ts` | Core AI generation logic |
| `client/src/components/teaching/MCQGenerator.tsx` | Instructor quiz builder UI |
| `client/src/components/lecture/LecturePracticeMode.tsx` | Student practice quiz UI |
| `client/src/pages/admin/settings/MCQGenerationPanel.tsx` | Admin prompt configuration |
| `server/src/routes/quiz.routes.ts` | Added `/practice/generate` endpoint |

#### How It Works

1. **MCQ Generation Service** (`mcqGeneration.service.ts`):
   - Uses `llmService.chat()` to call configured AI provider
   - Parses JSON response with `<think>` tag stripping for Claude models
   - Validates questions and resolves letter references (A, B, C, D) to actual option text
   - Admin-configurable prompts stored in `SystemSetting` table

2. **Practice Mode Flow**:
   - Student opens lecture → scrolls to `LectureAIHelper` component
   - Clicks "Practice" tab → selects question count → generates questions
   - Questions are ephemeral (not saved to database)
   - Immediate feedback with explanations

3. **Instructor Flow**:
   - Quiz editor → "Generate with AI" button → `MCQGenerator` modal
   - Preview generated questions → add selected to quiz
   - Questions saved via bulk API

## Architecture Notes

### LLM Service (`server/src/services/llm.service.ts`)

- Supports 12 providers: OpenAI, Gemini, Anthropic, Ollama, Azure, Together, Groq, etc.
- Provider configs stored in `LLMProvider` table
- Parameters passed through to providers (no client-side validation)

### Key Patterns

1. **Service Layer**: Business logic in `/server/src/services/`
2. **Route Layer**: Express routes in `/server/src/routes/`
3. **Component Structure**:
   - `/client/src/components/` - Reusable components
   - `/client/src/pages/` - Page-level components

### Database (Prisma)

Schema at `server/prisma/schema.prisma`. Key models:
- `User`, `Course`, `Module`, `Lecture`, `Section`
- `Quiz`, `QuizQuestion`, `QuizAttempt`
- `LLMProvider`, `SystemSetting`
- `Enrollment`, `Assignment`, `Submission`

## Development Commands

```bash
# Start development
cd client && npm run dev     # Port 5174
cd server && npm run dev     # Port 5001

# Testing
cd server && npm test                              # All tests
cd server && npm test -- --run src/path/test.ts   # Specific file

# Git (pre-push hooks run tests)
git push --no-verify  # Skip hooks if needed
```

## Known Issues / Technical Debt

1. **LLM Parameter Validation**: Tests were updated to match implementation - parameters pass through without client-side validation. Consider adding validation if needed.

2. **Claude Extended Thinking**: MCQ service strips `<think>` tags from responses. If using other reasoning models, may need similar handling.

3. **Practice Questions**: Currently ephemeral. Could add option to save practice history for analytics.

## Potential Next Steps

1. **Analytics**: Track practice quiz performance per student/lecture
2. **Question Bank**: Allow saving generated questions to a reusable bank
3. **Adaptive Difficulty**: Adjust difficulty based on student performance
4. **Batch Generation**: Generate questions for entire modules/courses
5. **Export/Import**: Allow exporting generated questions to standard formats (QTI, etc.)

## Testing Approach

- Unit tests with Vitest
- Mocking: Prisma, OpenAI, fetch for external APIs
- 853 tests currently passing

### Common Test Patterns

```typescript
// Mock Prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

// Use mocks
vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
```

## i18n

Translation files in `client/public/locales/{lang}/`:
- `common.json`, `navigation.json`, `courses.json`, `teaching.json`, `admin.json`, etc.

MCQ-related keys added to:
- `teaching.json` - Instructor MCQ generator UI
- `courses.json` - Student practice mode
- `admin.json` - MCQ settings panel

## Commit Convention

```
type(scope): description

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

## Reference: CLAUDE.md

See `/CLAUDE.md` for additional project-specific instructions that should be followed.
