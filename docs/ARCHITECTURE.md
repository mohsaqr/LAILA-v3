# LAILA V3 - Architecture Documentation

## Overview

LAILA (Learning and AI-powered Instructional Analytics) is a comprehensive learning management system with integrated AI tools for educational research. The platform is built as a full-stack TypeScript application with a React frontend and Express.js backend.

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| TanStack Query | Server state management |
| Zustand | Client state management |
| React Router v6 | Client-side routing |
| Tailwind CSS | Styling |
| Lucide React | Icons |
| React Hot Toast | Notifications |
| Tiptap | Rich text editor (forums, course descriptions, text sections, assignment instructions) |
| DOMPurify | HTML sanitization for user-generated content |
| Socket.IO Client | Real-time WebSocket connection |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express.js | Web framework |
| TypeScript | Type safety |
| Prisma | ORM & database toolkit |
| SQLite | Database (local dev, `prisma/local/`) |
| PostgreSQL | Database (production, `prisma/prod/`) |
| Socket.IO | Real-time WebSocket server |
| JWT | Authentication |
| Multer | File uploads |
| OpenAI SDK | AI integrations |

---

## Project Structure

```
LAILA-v3/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── api/              # API client functions
│   │   ├── components/       # Reusable UI components
│   │   │   ├── common/       # Generic components (Card, Button, etc.)
│   │   │   ├── course/       # Course-specific components
│   │   │   ├── layout/       # Layout components (Navbar, etc.)
│   │   │   └── teach/        # Instructor components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   │   ├── admin/        # Admin pages
│   │   │   ├── agent-assignment/  # AI agent assignment pages
│   │   │   ├── ai-tools/     # AI tools pages
│   │   │   ├── auth/         # Authentication pages
│   │   │   └── teach/        # Instructor pages
│   │   ├── services/         # Client services (analytics, etc.)
│   │   ├── store/            # Zustand stores
│   │   ├── types/            # TypeScript type definitions
│   │   ├── App.tsx           # Main app with routes
│   │   └── main.tsx          # Entry point
│   └── package.json
│
├── server/                    # Backend Express application
│   ├── prisma/
│   │   ├── prod/
│   │   │   ├── schema.prisma       # PostgreSQL schema (production, source of truth)
│   │   │   └── migrations/         # PostgreSQL migration files (committed)
│   │   ├── local/                  # Gitignored — auto-generated for local dev
│   │   │   ├── schema.prisma       # SQLite schema (generated from prod)
│   │   │   ├── dev.db              # SQLite database
│   │   │   └── migrations/         # SQLite migration files
│   ├── src/
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic services
│   │   ├── utils/            # Utility functions (prisma, logger, socket)
│   │   └── index.ts          # Server entry point (HTTP + Socket.IO)
│   ├── uploads/              # File upload storage
│   └── package.json
│
├── FEATURES.md               # Feature documentation
├── ARCHITECTURE.md           # This file
└── README.md                 # Project readme
```

---

## Database Schema

### Core Entities

#### User
```prisma
model User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  password      String
  fullname      String
  role          String    @default("student")  // student, instructor, admin
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

#### Course
```prisma
model Course {
  id            Int       @id @default(autoincrement())
  title         String
  slug          String    @unique
  description   String?
  category      String?
  difficulty    String?   // beginner, intermediate, advanced
  isPublished   Boolean   @default(false)
  instructorId  Int
  instructor    User      @relation(...)
  modules       Module[]
  enrollments   Enrollment[]
  assignments   Assignment[]
}
```

#### Module & Lecture
```prisma
model Module {
  id        Int       @id @default(autoincrement())
  title     String
  order     Int
  courseId  Int
  lectures  Lecture[]
}

model Lecture {
  id          Int       @id @default(autoincrement())
  title       String
  content     String?   // Legacy HTML content
  videoUrl    String?
  duration    Int?
  order       Int
  moduleId    Int
  sections    LectureSection[]
  attachments LectureAttachment[]
}
```

#### LectureSection (Content Blocks)
```prisma
model LectureSection {
  id        Int     @id @default(autoincrement())
  type      String  // text, file, ai-generated, chatbot, assignment
  title     String?
  content   String? // HTML content (rich text via Tiptap editor)
  order     Int
  lectureId Int

  // File section fields
  fileUrl   String?
  fileName  String?
  fileType  String?

  // Chatbot section fields
  chatbotId Int?
  chatbot   Chatbot?
}
```

#### Attachment Models
```prisma
model LectureAttachment {
  id, lectureId, fileName, fileUrl, fileType, fileSize?, createdAt
  onDelete: Cascade
}

model AssignmentAttachment {
  id, assignmentId, fileName, fileUrl, fileType, fileSize?, createdAt
  onDelete: Cascade
}
```
Upload endpoints in `upload.routes.ts` with type-specific multer filters. Assignment files: csv/xlsx/png/jpg/pdf, 3 MB limit.

#### Module-Survey Link (Many-to-Many)
```prisma
model ModuleSurvey {
  id, courseId, moduleId, surveyId, addedAt
  @@unique([moduleId, surveyId])
  onDelete: Cascade (from course, module, and survey)
}
```
Surveys can be linked to course modules via the curriculum editor. Self-contained UI in `ModuleItem.tsx` with searchable selection modal.

### AI Components

#### Chatbot (AI Component Library)
```prisma
model Chatbot {
  id                Int      @id @default(autoincrement())
  name              String   @unique
  displayName       String
  description       String?
  systemPrompt      String
  category          String?  // tutor, assistant, chatbot, academic, support, creative
  isActive          Boolean  @default(true)
  isSystem          Boolean  @default(false)

  // Customization
  welcomeMessage    String?
  avatarUrl         String?
  personality       String?  // friendly, professional, academic, casual, socratic, learning, custom
  personalityPrompt String?  // Editable personality instructions
  temperature       Float?   @default(0.7)
  suggestedQuestions String? // JSON array
  dosRules          String?  // JSON array
  dontsRules        String?  // JSON array
  responseStyle     String?  // concise, balanced, detailed
  maxTokens         Int?     @default(1000)
  modelPreference   String?  // gpt-4o, claude-3-sonnet, etc.
  knowledgeContext  String?
}
```

### Analytics & Logging

#### LearningActivityLog (Unified Activity Tracking)
```prisma
model LearningActivityLog {
  id              Int       @id @default(autoincrement())

  // Actor (Who)
  userId          Int
  userEmail       String?
  userFullname    String?
  userRole        String?
  sessionId       String?

  // Verb (Action)
  verb            String    // viewed, started, completed, submitted, etc.

  // Object (What)
  objectType      String    // course, module, lecture, section, assignment, chatbot
  objectId        Int?
  objectTitle     String?
  objectSubtype   String?

  // Context (Where - Course Hierarchy)
  courseId        Int?
  courseTitle     String?
  moduleId        Int?
  moduleTitle     String?
  lectureId       Int?
  lectureTitle    String?
  sectionId       Int?
  sectionTitle    String?

  // Result (Outcome)
  success         Boolean?
  score           Float?
  progress        Float?
  duration        Int?

  // Extended Data
  extensions      String?   // JSON for additional data
  timestamp       DateTime  @default(now())
  deviceType      String?
  browserName     String?
}
```

---

## Application Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React App                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Pages     │  │  Components │  │      Hooks          │ │
│  │             │  │             │  │                     │ │
│  │ - Dashboard │  │ - Card      │  │ - useAuth           │ │
│  │ - Catalog   │  │ - Button    │  │ - useActivityLogger │ │
│  │ - Course... │  │ - Loading   │  │                     │ │
│  │ - AITools   │  │ - Navbar    │  │                     │ │
│  │ - Admin     │  │ - ChatBot   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────────┐│
│  │    TanStack Query       │  │     Zustand Store         ││
│  │   (Server State)        │  │    (Client State)         ││
│  │                         │  │                           ││
│  │ - Caching               │  │ - authStore (user, token) ││
│  │ - Background refetch    │  │ - Persisted to localStorage│
│  │ - Optimistic updates    │  │                           ││
│  └─────────────────────────┘  └───────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    API Layer                             ││
│  │  api/courses.ts, api/users.ts, api/enrollments.ts, etc. ││
│  │                                                          ││
│  │  axios instance with JWT interceptor                     ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────────┐│
│  │  Activity Logger        │  │  Socket.IO Client         ││
│  │  (Batch-first)          │  │  (Real-time events)       ││
│  │                         │  │                           ││
│  │  - Queues activities    │  │  - notification:new       ││
│  │  - Flushes every 3s    │  │  - Auto-reconnect         ││
│  │  - keepalive on unload  │  │  - Room per user          ││
│  └─────────────────────────┘  └───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   HTTP/REST API + WebSocket
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Express Server + Socket.IO                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Middleware                            ││
│  │  - CORS                                                  ││
│  │  - JSON body parser                                      ││
│  │  - JWT Authentication (authMiddleware)                   ││
│  │  - Admin/Instructor guards                               ││
│  │  - Enrollment checks (service-level + client guard)     ││
│  │  - Rate limiting (auth, upload, API, LLM)               ││
│  │  - Helmet security headers                               ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Routes                                ││
│  │                                                          ││
│  │  /api/auth         - Login, register, profile            ││
│  │  /api/users        - User management                     ││
│  │  /api/courses      - Course CRUD, modules, lectures      ││
│  │  /api/enrollments  - Enrollment, progress tracking       ││
│  │  /api/assignments  - Assignment management               ││
│  │  /api/chatbots     - AI component library                ││
│  │  /api/chat         - AI chat interactions                ││
│  │  /api/activity-log - Learning activity logging           ││
│  │  /api/notifications - Notification CRUD                  ││
│  │  /api/admin        - Admin operations                    ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                Socket.IO Layer                           ││
│  │                                                          ││
│  │  - User rooms (user:{id}) for targeted events            ││
│  │  - notification:new → real-time badge updates            ││
│  │  - emitToUser() helper in utils/socket.ts                ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Services                              ││
│  │                                                          ││
│  │  - learningActivityLog.service.ts (Activity tracking)    ││
│  │  - openai.service.ts (AI integrations)                   ││
│  │  - file.service.ts (File upload handling)                ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 Prisma ORM                               ││
│  │                                                          ││
│  │  - Type-safe database queries                            ││
│  │  - Auto-generated client                                 ││
│  │  - Migration management                                  ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Database                              ││
│  │                                                          ││
│  │  SQLite (local dev)  → prisma/local/dev.db               ││
│  │  PostgreSQL (prod)   → prisma/prod/schema.prisma         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features & Modules

### 1. Course Management

**For Instructors:**
- Create and publish courses
- Organize content into modules and lectures
- Add various content types (text, files, videos, AI chatbots, assignments)
- Lecture editor (`LectureEditor.tsx`): sections auto-save; the "Save Settings" button in the sidebar settings card only saves lesson metadata (content type, video URL, duration, free preview)
- Curriculum editor (`CurriculumEditor.tsx`): section add buttons (Text, File, AI, Chatbot, Assignment) only appear for empty lectures; lectures with sections show "Manage Content" link instead. File sections display inline with download and rename.
- View student progress and chatbot interaction logs

**For Students:**
- Browse course catalog
- Enroll in courses
- Access course content via course player
- Track progress

### 2. AI Builder (Component Library)

The AI Builder allows creation of reusable AI components:

```
┌─────────────────────────────────────────────────────────┐
│                    AI Builder                            │
├─────────────────────────────────────────────────────────┤
│  Tabs:                                                   │
│  ┌──────────┬───────────┬──────────┬────────────┐       │
│  │ Basic    │ Behavior  │ Advanced │ Test Chat  │       │
│  │ Info     │           │          │            │       │
│  └──────────┴───────────┴──────────┴────────────┘       │
│                                                          │
│  Basic Info:                                             │
│  - Name, Display Name, Category                          │
│  - Description, System Prompt                            │
│  - Avatar URL, Welcome Message                           │
│                                                          │
│  Behavior:                                               │
│  - Personality (Friendly, Socratic, Learning Mode, etc.) │
│  - Editable personality prompt                           │
│  - Response Style (Concise, Balanced, Detailed)          │
│  - Do's and Don'ts rules                                 │
│  - Suggested questions                                   │
│                                                          │
│  Advanced:                                               │
│  - Temperature slider (0-1)                              │
│  - Max tokens                                            │
│  - Model preference (GPT-4o, Claude, Gemini, etc.)       │
│  - Knowledge context                                     │
└─────────────────────────────────────────────────────────┘
```

**Personality Types:**
| Type | Description |
|------|-------------|
| Friendly | Warm, supportive, encouraging |
| Professional | Formal, business-like |
| Academic | Scholarly, thorough |
| Casual | Relaxed, conversational |
| Socratic | Argumentative, challenges assumptions, uses questions |
| Learning Mode | Step-by-step scaffolded learning, checks understanding |
| Custom | Fully customizable |

### 3. Learning Activity Logging

Unified logging system tracking all learning activities with **batch-first** architecture:

- Client queues all activities in memory and flushes every **3 seconds** via `POST /api/activity-log/batch`
- On page close, pending activities are sent with `fetch({ keepalive: true })` to prevent data loss
- Reduces HTTP requests by ~90% compared to per-action logging

**Verb Taxonomy:**
| Verb | Description |
|------|-------------|
| enrolled | User enrolled in course |
| viewed | Content viewed (lecture, section, video, file, lab) |
| started | Activity started (quiz, assignment) |
| completed | Activity finished (lecture, module, video) |
| submitted | Work submitted (quiz, assignment, lab, survey) |
| graded | Work graded |
| interacted | Active interaction (tutor chat, lab work, forum, chatbot) |
| expressed | Emotional self-report (emotional pulse) |
| selected | Selection made (tutor agent, lab dataset) |
| downloaded | File downloaded (file, certificate) |

**TNA Learning State Categories (verb:objectType → category):**
| Category | Meaning | Key triggers |
|----------|---------|-------------|
| learning | Consuming content | `viewed:lecture`, `viewed:section`, `viewed:video`, `viewed:lab`, `downloaded:file` |
| browsing | Navigating/exploring | `viewed:course`, `viewed:module`, `enrolled:course` |
| practiced | Hands-on lab work | `interacted:lab`, `selected:lab` |
| regulated | Completing, self-monitoring | `completed:lecture`, `viewed:gradebook`, `viewed:certificate` |
| assessment | Quiz/assignment activity | `started:quiz`, `submitted:assignment`, `submitted:lab` |
| AI_engaged | AI tutor interactions | `interacted:tutor_agent`, `interacted:course_tutor` |
| expressed | Emotional self-report | `expressed:emotional_pulse`, `submitted:survey` |

### 4. AI Tools Suite

| Tool | Purpose |
|------|---------|
| AI Builder | Create reusable AI components |
| AI Assistants | Interact with specialized AI assistants |
| Bias Research | Create and analyze academic vignettes |
| Prompt Engineering | Guided prompt creation (PCTFT framework) |
| Data Interpreter | AI-powered statistical analysis |

### 5. Agent Assignment Submission Flow

Assignments with `submissionType === 'ai_agent'` follow a dedicated submission flow:

- **Client**: `AssignmentView.tsx` redirects ai_agent assignments to `StudentAgentBuilder` (agent-assignment page)
- **Submit**: `agentAssignment.service.submitAgentConfig()` — sets `isDraft: false` on `StudentAgentConfig`, upserts `AssignmentSubmission` with `agentConfigId`
- **Unsubmit**: `agentAssignment.service.unsubmitAgentConfig()` — checks not graded, sets `isDraft: true`, submission `status: 'draft'`
- **Resubmit**: Student edits draft, then calls `submitAgentConfig()` again — the upsert preserves the `agentConfigId` link
- **Guard**: `assignment.service.submitAssignment()` rejects `ai_agent` type assignments with a 400 error, forcing them through the agent-specific endpoint. This prevents accidental text submissions that would overwrite the `agentConfigId` link.
- **Design Analytics TNA**: The Summary & Analytics tab includes TNA charts (ActivityDonutChart, TnaIndexPlot, TnaNetworkGraph) that visualize the design process as a transition network. Event categories are mapped to labels and fed into `dynajs` `tna()` to produce the model.

#### Instructor Submission Routes (Unified)
All instructor submission review goes through unified routes:
```
/teach/courses/{ID}/assignments/{ID}/submissions          → SubmissionReview (both regular & agent)
/teach/courses/{ID}/assignments/{ID}/submissions/{subId}  → SubmissionDetail (regular)
/teach/courses/{ID}/assignments/{ID}/agent-submissions/{subId} → AgentSubmissionReview (agent)
```
`SubmissionReview.tsx` checks `assignment.submissionType` and conditionally fetches via `assignmentsApi.getSubmissions()` or `agentAssignmentsApi.getAgentSubmissions()`.

### 5c. Lab & Interactive Lab Assignment Flow

Assignments can be linked to labs in two ways:

**Lab Template Assignments** (R/Python labs via `LabAssignment` model):
- `AssignmentView.tsx` embeds `LabRunnerUI` when `linkedLab` exists
- The generic "Your Submission" card is hidden — submission goes through `LabAssignmentPanel`
- `LabRunnerUI` accepts `hideSubmit` prop (true when submitted/graded/past due)
- Students capture code+output snapshots → generate PDF report → submit via panel

**Interactive Lab Assignments** (TNA/SNA exercises via `agentRequirements`):
- `AssignmentView.tsx` redirects to `/courses/{id}/tna-exercise` or `/courses/{id}/sna-exercise`
- Exercise pages find their assignment via `agentRequirements` field (no `assignmentId` query param needed)
- Assignment header card shows deadline, points, status badge
- Students capture analysis snapshots → generate PDF → submit via `LabAssignmentPanel`
- SNA capture uses SVG serialization for the network graph (bypasses html2canvas clipping) + html2canvas for analysis cards
- Capture keys are analysis-specific (e.g., `centrality-InDegree-chart`) allowing multiple captures

**Standalone Labs** (no linked assignment):
- `LabAssignment` records with `assignmentId: null` appear as lab items on the course page
- Link to `/labs/{labId}?courseId={courseId}`
- No submit button or report capture

**Post-submission view** (all lab types):
- Students see their submission content (text/HTML) and files (inline PDF preview)
- "Waiting for grading" banner (submitted but not graded)
- Grade card with score, percentage, instructor feedback (when graded)

#### Assignment Resubmission
Students can resubmit any assignment type (text/file, lab, SNA, TNA) **before the instructor grades it**:
- Server: `submitAssignment()` upserts — graded submissions are blocked, submitted ones are overwritten
- Client: A "Resubmit" button appears in the "waiting for grading" state, re-enabling the editor/panel
- Once graded, submission is permanently locked (admin-only bypass)

#### Due Date Timezone Convention
Due dates use a "wall clock" pattern — stored as literal UTC, displayed with `timeZone: 'UTC'`:
- **Save**: `datetime-local` value + `':00.000Z'` (no timezone conversion)
- **Display**: All `toLocaleDateString()` calls use `timeZone: 'UTC'`
- Instructor picks 20:00 → DB stores `T20:00:00.000Z` → all students see 20:00

### 5b. AI Tutor Emotional Awareness

- When a student selects an emotion via `EmotionalPulseWidget`, it is stored client-side and sent with the next chat message as `emotionalPulse`.
- On the server, `sendMessage()` also falls back to the most recent `EmotionalPulse` record (within 30 minutes) from the database.
- The resolved emotion is injected into the system prompt as a `STUDENT EMOTIONAL STATE` section with tailored tone guidance from `EMOTION_GUIDANCE` map (e.g., "Be extra patient and empathetic" for frustrated, "Re-spark interest" for bored).
- Works across all tutor modes: manual, router, random, and collaborative (including all collaborative styles: parallel, sequential, debate, random).

### 5d. SNA & TNA Exercise Pages

Both exercise pages share the same layout pattern:
- **Sidebar**: Dataset picker, column mapping (TNA), model type, build button, download data
- **Main area**: Network graph card (with toolbar) → Analysis tabs → Analysis content
- **Network graph**: Pure React SVG via `TnaNetworkGraph` component (no D3). Supports drag-and-drop, responsive viewBox, node label toggle, font size, directed/undirected toggle, centrality-based node sizing.
- **Graph toolbar**: Searchable Layout/Size by dropdowns, checkboxes (Undirected, Self loops, Edge labels, Node labels), sliders (Node size, Label size, Edge width)
- **Analysis tabs**: Horizontal pill buttons (SNA: Graph Metrics, Centrality, Communities, Adjacency Matrix. TNA: Frequencies, Transitions, Pruning, Centrality, Clusters)
- **Capture**: html2canvas captures network card (toolbar hidden) + analysis card separately, combines vertically. Buttons/tabs excluded via `data-no-capture` attribute.
- **Assignment integration**: Header card with status badge, points, due date, grace period. Submit button bottom right-aligned.

All SVG charts (CentralityBarChart, TnaFrequencyChart, TnaDistributionPlot, TnaIndexPlot, ActivityTimelineChart) use `useContainerWidth` hook with ResizeObserver for responsive width — no hardcoded pixel widths.

### 6. Admin Dashboard

- User management
- Enrollment management (including batch enrollment)
- Activity log viewing and export
- Chatbot Registry — unified view of all chatbots across three sources:
  - **Global** chatbots (`Chatbot` model — AI tutors)
  - **Section** chatbots (`LectureSection` with type `chatbot`)
  - **Agent** chatbots (`StudentAgentConfig` — student-designed agents from agent assignments)
  - Includes usage statistics (conversations, messages, unique users), filtering, sorting, and CSV/Excel/JSON export
- System analytics

---

## Authentication Flow

```
┌──────────┐     POST /api/auth/login      ┌──────────┐
│  Client  │ ──────────────────────────────▶│  Server  │
│          │     {email, password}          │          │
│          │                                │          │
│          │◀────────────────────────────── │          │
│          │     {token, user}              │          │
└──────────┘                                └──────────┘
     │
     │ Store token in Zustand (persisted to localStorage)
     ▼
┌──────────┐     GET /api/courses           ┌──────────┐
│  Client  │ ──────────────────────────────▶│  Server  │
│          │  Authorization: Bearer <token> │          │
│          │                                │          │
│          │◀────────────────────────────── │          │
│          │     [courses...]               │          │
└──────────┘                                └──────────┘
```

---

## Enrollment Guards

Course content is protected by enrollment checks at two levels:

### Server-Side (Service Layer)
Services like `quiz.service`, `assignment.service`, `forum.service`, `lecture.service` check enrollment via `prisma.enrollment.findUnique()`. Admins bypass content access checks; instructors bypass for their own courses. Throws `AppError('...', 403)` if student is not enrolled. All users (including admins/instructors) can enroll, complete lectures, and track progress — no role-based restrictions on enrollment or progress.

### Client-Side (Route Guard)
`RequireEnrollment` component (`client/src/components/layout/RequireEnrollment.tsx`) wraps course content routes in `App.tsx`:
- Checks enrollment via `enrollmentsApi.getEnrollment(courseId)` before rendering
- Admins and instructors bypass automatically
- Supports `courseId` from URL params or query string
- Shows 403 page with "Access Denied" message and navigation buttons
- Results cached for 5 minutes via TanStack Query

**Protected routes**: All student `courses/:courseId/*` routes (lectures, forums, quizzes, analytics, assignments, agent-assignments, code-labs, grades) and `/ai-tutors?courseId=X`.

### Course Tutor Visibility
The `GET /courses/:id` response includes a `tutors` array (type `MergedTutorConfig[]`) loaded via `courseTutorService.getStudentTutors()`. Tutors are visible to:
- Enrolled students
- Course team members (instructor, TAs, co-instructors)
- Admins (bypass enrollment check via `options.isAdmin`)
- All instructors (bypass enrollment check)

The `CollaborativeModule` component on `CourseDetails` page receives tutors as a prop from the course response — no separate API call needed.

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user (returns userId, creates verification code, @uef.fi only) |
| POST | /api/auth/verify-code | Verify 6-digit activation code (returns user + JWT) |
| POST | /api/auth/resend-code | Resend activation code (2-minute expiry) |
| POST | /api/auth/login | Login (blocked if email not verified) |
| POST | /api/auth/forgot-password | Send 6-digit reset code to email (10-min expiry) |
| POST | /api/auth/reset-password | Verify code + set new password (returns user + JWT) |
| GET | /api/auth/profile | Get current user |

### Courses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/courses | List all courses |
| GET | /api/courses/:id | Get course details |
| POST | /api/courses | Create course (instructor) |
| PUT | /api/courses/:id | Update course |
| DELETE | /api/courses/:id | Delete course |

### Enrollments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/enrollments/:courseId | Enroll in course |
| GET | /api/enrollments | Get user enrollments |
| POST | /api/enrollments/:courseId/progress | Update progress |

### AI/Chatbots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/chatbots | List AI components |
| POST | /api/chatbots | Create AI component |
| PUT | /api/chatbots/:id | Update AI component |
| POST | /api/chat | Send chat message |

### Activity Logging
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/activity-log | Log single activity |
| POST | /api/activity-log/batch | Log batch of activities (primary) |
| GET | /api/activity-log | Query logs (admin) |
| GET | /api/activity-log/export | Export logs |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | Get user notifications |
| GET | /api/notifications/unread-count | Get unread badge count |
| PUT | /api/notifications/:id/read | Mark as read |
| PUT | /api/notifications/read-all | Mark all as read |

### Certificates
| Route | Page | Description |
|-------|------|-------------|
| `/certificate/:id` | Certificate.tsx | Certificate info page (metadata, verification code, download) |
| `/certificate/:id/view` | CertificateView.tsx | Full certificate display (Coursera-style with avatar, categories, instructor signature, PDF download, share) |
| `/verify/:code` | Certificate.tsx | Public verification page (no auth required) |

Certificate view page includes: student profile picture, course categories, LAILA branding, instructor avatar with signature line, PDF download via print dialog, share via native Web Share API or copy-link fallback.

### Real-Time (Socket.IO)
| Event | Direction | Description |
|-------|-----------|-------------|
| `notification:new` | Server → Client | New notification created |

---

## File Storage

Files are stored in `server/uploads/` with the following structure:

```
uploads/
├── courses/          # Course-related files
├── assignments/      # Assignment submissions
├── sections/         # Lecture section files
└── avatars/          # User/chatbot avatars
```

---

## Environment Variables

### Server (.env)
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="sk-..."
PORT=5000
```

### Client (.env)
```env
VITE_API_URL="http://localhost:5000/api"
```

---

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Setup database
cd server
npm run setup:local        # Generate local SQLite schema from prod PostgreSQL schema
npm run db:push            # Sync local SQLite database

# Start development servers (auto-runs setup:local)
npm run dev
```

### Database Workflow

**Schema changes (development):**
```bash
# 1. Edit the source of truth
vim server/prisma/prod/schema.prisma

# 2. Regenerate local SQLite schema (also runs automatically on npm run dev)
npm run setup:local

# 3. Sync local database
npm run db:push

# 4. Generate production migration file (no DB connection needed)
npm run db:migrate:prod -- --name <descriptive_name>

# 5. Commit both schema.prisma + the migration file
```

**Production deployment:**
```bash
# Check which migrations are pending
npx prisma migrate status --schema prisma/prod/schema.prisma

# Review pending migration SQL
cat server/prisma/prod/migrations/<timestamp>_<name>/migration.sql

# Apply pending migrations
npx prisma migrate deploy --schema prisma/prod/schema.prisma
```

**Key rules:**
- **Source of truth**: `prisma/prod/schema.prisma` (PostgreSQL)
- **Local dev**: `prisma/local/schema.prisma` (SQLite) — auto-generated, gitignored
- **Always generate a prod migration** after editing `prod/schema.prisma`
- `migrate deploy` only applies new migrations (tracks state in `_prisma_migrations` table)
- Never edit `prisma/local/schema.prisma` manually

### Build
```bash
# Build client
cd client && npm run build

# Build server
cd server && npm run build
```

---

## Deployment Considerations

1. **Database**: Migrate from SQLite to PostgreSQL for production
2. **File Storage**: Use cloud storage (S3, GCS) for files
3. **Environment**: Set secure JWT_SECRET and API keys
4. **CORS**: Configure allowed origins
5. **SSL**: Enable HTTPS
6. **Rate Limiting**: Already implemented (auth, upload, API, LLM limiters)
7. **WebSocket**: Nginx must proxy `/socket.io/` with `Upgrade` headers
8. **CSP**: `connectSrc` must include `ws:` and `wss:` for WebSocket

See `docs/DEPLOYMENT.md` for full deployment guide with automated script.

---

## Contributing

1. Create feature branch from `main`
2. Make changes with clear commit messages
3. Test thoroughly (`cd server && npm test`)
4. Create pull request

---

## License

Proprietary - All rights reserved.
