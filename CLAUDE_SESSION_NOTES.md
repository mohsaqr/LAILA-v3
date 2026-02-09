# LAILA v3 - Session Notes & Conventions

## Project Overview
LAILA is an AI-powered learning platform with:
- **Client**: React + TypeScript + Vite (port 5173)
- **Server**: Node.js + Express + Prisma + TypeScript (port 5001)
- **Database**: PostgreSQL with Prisma ORM

## Directory Structure
```
/Users/mohammedsaqr/Documents/Git/LAILA-v3/
├── client/                 # React frontend
│   ├── src/
│   │   ├── api/           # API client functions
│   │   ├── components/    # React components
│   │   │   └── tutors/    # Tutor-related components
│   │   ├── pages/         # Page components
│   │   │   └── teach/     # Instructor pages
│   │   └── types/         # TypeScript types
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API routes
│   │   ├── types/         # TypeScript types
│   │   └── middleware/    # Express middleware
│   └── prisma/
│       └── schema.prisma  # Database schema
└── package.json
```

---

## AI Tutors System

### Architecture
1. **TutorSession** - Per-user session storing mode and active agent
2. **TutorConversation** - Per-agent conversation within a session
3. **TutorMessage** - Individual messages in conversations
4. **Chatbot** - Tutor agent definitions (category: 'tutor')

### Tutor Modes (TutorMode type)
- `manual` - User selects which tutor responds
- `router` - AI picks best tutor based on message content
- `collaborative` - Multiple tutors respond together
- `random` - Single random tutor responds each time (NEW)

### Course Routing Modes (tutorRoutingMode)
Set by instructor in course settings, maps to session modes:
- `free` - Students freely choose tutors
- `all` - Students see all tutors with recommendations
- `single` - Students only see one default tutor
- `smart` - Auto-route to best tutor (maps to `router` mode)
- `collaborative` - Team mode (maps to `collaborative` mode)
- `random` - Random tutor responds (maps to `random` mode) (NEW)

### Collaborative Styles (CollaborativeStyle)
- `parallel` - All tutors respond simultaneously
- `sequential` - Tutors respond in order, building on previous
- `debate` - Multiple rounds of back-and-forth
- `random` - Random 1-3 tutors respond sequentially

---

## Key Files Modified This Session

### 1. Course Tutor Settings UI
**File**: `client/src/pages/teach/CourseTutorManager.tsx`
- Added `collaborative` and `random` to routing mode options
- UI radio buttons for instructor to select routing mode
- Settings saved via `coursesApi.updateCourseAISettings()`

### 2. API Types
**File**: `client/src/api/courses.ts`
- `tutorRoutingMode` type includes: `'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random'`

### 3. Backend Course Service
**File**: `server/src/services/course.service.ts`
- `updateAISettings()` accepts the new routing modes
- Stores in `Course.tutorRoutingMode` field (String in Prisma)

### 4. Tutor Types (Frontend)
**File**: `client/src/types/tutor.ts`
- `TutorMode = 'manual' | 'router' | 'collaborative' | 'random'`

### 5. Tutor Types (Backend)
**File**: `server/src/types/tutor.types.ts`
- Same TutorMode type definition

### 6. AI Tutors Page
**File**: `client/src/pages/AITutors.tsx`
- Fetches course data to get `tutorRoutingMode`
- Maps course routing to session mode via `mapCourseRoutingToSessionMode()`
- Auto-sets mode when student enters course tutors
- `random` mode uses first agent for unified team chat view

### 7. Tutor Service (Main Logic)
**File**: `server/src/services/tutor.service.ts`

#### Key Methods:
- `sendMessage()` - Routes to handler based on mode
- `handleManualMode()` - Direct chat with selected agent
- `handleRouterMode()` - AI analyzes and routes to best agent
- `handleCollaborativeMode()` - Multiple tutors respond together
- `handleRandomMode()` - Picks single random tutor (NEW)
- `getAgentResponse()` - Gets individual tutor response with guidelines

#### System Prompt Guidelines Added:
```
CRITICAL - HOW TO RESPOND:
- Address the STUDENT directly - they are your audience
- Use "you" to refer to the student
- NEVER start with ANY name followed by colon (no "Beatrice:", no "Tutor:", etc.)
- NEVER repeat or copy previous tutor responses - just give YOUR fresh perspective
- If other tutors responded, briefly build on their IDEAS, then add YOUR insight
- Jump straight into your helpful response - no preamble, no name prefix
```

#### Name Stripping Logic:
```typescript
// Strip any name-like prefix from start of response (UI already shows the name)
cleanedReply = cleanedReply
  .replace(/^\*\*[^*]{1,30}\*\*[:\s]*/i, '') // **Name**:
  .replace(/^[A-Z][a-zA-Z\s]{0,25}:\s*/m, '') // Name: (capitalized word followed by colon)
  .trim();
```

### 8. Collaborative Response Component
**File**: `client/src/components/tutors/CollaborativeResponse.tsx`
- Renders tutor responses with avatars and names
- Shows name in header (line 140): `{contrib.agentDisplayName}`
- Shows contribution content separately
- Staggered reveal animation for responses

---

## Privacy & Data Isolation
**CONFIRMED SAFE** - Conversations are isolated per user:
- `TutorSession.userId` has `@unique` constraint
- `TutorConversation` linked via `sessionId` (user-specific)
- All queries filter by `userId` from auth token
- No cross-user data leakage possible

---

## Common Issues & Fixes

### Issue: Tutor name appearing multiple times
**Cause**: AI includes its name in response + UI also shows name header
**Fix**:
1. System prompt tells AI not to start with name
2. Backend strips any "Name:" prefix from response start

### Issue: Tutors addressing other tutors instead of student
**Cause**: Seeing previous tutor responses in context
**Fix**: System prompt explicitly says to address STUDENT directly, build on ideas but speak TO the student

### Issue: Tutors repeating previous tutor's response
**Cause**: AI copying content from context
**Fix**: System prompt says "NEVER repeat or copy previous tutor responses"

---

## Development Commands

```bash
# Start server (from /server directory)
cd /Users/mohammedsaqr/Documents/Git/LAILA-v3/server
npm run dev

# Build client (from /client directory)
cd /Users/mohammedsaqr/Documents/Git/LAILA-v3/client
npm run build

# Kill server on port 5001
lsof -ti :5001 | xargs kill -9

# Restart server
lsof -ti :5001 | xargs kill -9; sleep 2 && npm run dev
```

---

## Type Definitions to Keep in Sync

When adding new modes, update ALL these files:
1. `client/src/types/tutor.ts` - TutorMode
2. `server/src/types/tutor.types.ts` - TutorMode
3. `client/src/api/courses.ts` - tutorRoutingMode in updateCourseAISettings
4. `server/src/services/course.service.ts` - tutorRoutingMode in updateAISettings
5. `client/src/pages/teach/CourseTutorManager.tsx` - routingMode state and UI
6. `client/src/pages/AITutors.tsx` - CourseRoutingMode and mapCourseRoutingToSessionMode
7. `server/src/services/tutor.service.ts` - sendMessage switch statement

---

## Git Status (Start of Session)
Branch: `collaborative-module-improvements`
Main branch: `master`
Many modified files in both client and server - feature branch work in progress.

---

## Session Summary
1. Added `collaborative` mode to course-level tutor routing settings
2. Added `random` mode (single random tutor responds)
3. Fixed tutor name duplication issues
4. Fixed tutors addressing each other instead of student
5. Added name-stripping logic to clean AI responses
6. Updated system prompts for better response formatting
