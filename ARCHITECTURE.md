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

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express.js | Web framework |
| TypeScript | Type safety |
| Prisma | ORM & database toolkit |
| SQLite | Database (development) |
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
│   │   ├── schema.prisma     # Database schema
│   │   └── dev.db            # SQLite database
│   ├── src/
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic services
│   │   ├── utils/            # Utility functions
│   │   └── index.ts          # Server entry point
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
  content   String? // HTML content for text sections
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
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        HTTP/REST API
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Express Server                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Middleware                            ││
│  │  - CORS                                                  ││
│  │  - JSON body parser                                      ││
│  │  - JWT Authentication (authMiddleware)                   ││
│  │  - Admin/Instructor guards                               ││
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
│  │  /api/admin        - Admin operations                    ││
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
│  │                 SQLite Database                          ││
│  │                                                          ││
│  │  server/prisma/dev.db                                    ││
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

Unified logging system tracking all learning activities:

**Verb Taxonomy:**
| Verb | Description |
|------|-------------|
| enrolled | User enrolled in course |
| viewed | Content viewed |
| started | Activity started |
| completed | Activity finished |
| submitted | Work submitted |
| graded | Work graded |
| messaged | Chatbot message sent |
| downloaded | File downloaded |

### 4. AI Tools Suite

| Tool | Purpose |
|------|---------|
| AI Builder | Create reusable AI components |
| AI Assistants | Interact with specialized AI assistants |
| Bias Research | Create and analyze academic vignettes |
| Prompt Engineering | Guided prompt creation (PCTFT framework) |
| Data Interpreter | AI-powered statistical analysis |

### 5. Admin Dashboard

- User management
- Enrollment management (including batch enrollment)
- Activity log viewing and export
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

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
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
| POST | /api/activity-log | Log activity |
| GET | /api/activity-log | Query logs (admin) |
| GET | /api/activity-log/export | Export logs |

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
npx prisma db push
npx prisma generate

# Start development servers
# Terminal 1:
cd server && npm run dev

# Terminal 2:
cd client && npm run dev
```

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
6. **Rate Limiting**: Add rate limiting middleware

---

## Contributing

1. Create feature branch from `LAILA-V3`
2. Make changes with clear commit messages
3. Test thoroughly
4. Create pull request

---

## License

Proprietary - All rights reserved.
