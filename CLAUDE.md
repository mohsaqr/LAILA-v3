# CLAUDE.md - LAILA LMS v3.0

LAILA (Learn with AI Laboratory) is an AI-powered Learning Management System.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, SQLite
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, React Query, Zustand
- **AI:** OpenAI GPT / Google Gemini integration

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@laila.edu | admin123 |
| Instructor | instructor@laila.edu | instructor123 |
| Student | student@laila.edu | student123 |

## Project Structure

```
LAILA-v3/
├── package.json            # Root monorepo config
├── server/                 # Express backend
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, error handling
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Prisma, validation
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── seed.ts         # Seeding script
├── client/                 # React frontend
│   └── src/
│       ├── App.tsx         # Routes
│       ├── api/            # API client
│       ├── components/     # UI components
│       │   ├── common/     # Shared (Button, Card, Modal, etc.)
│       │   ├── layout/     # Layout components
│       │   └── teach/      # Teaching interface components
│       ├── pages/          # Page components
│       │   ├── auth/       # Login, Register
│       │   └── teach/      # Teaching dashboard, editors
│       ├── hooks/          # Custom hooks
│       ├── store/          # Zustand stores
│       └── types/          # TypeScript types
└── .env.example            # Environment template
```

## Available Scripts

```bash
# Development
npm run dev                 # Start both servers
npm run dev:server          # Backend only
npm run dev:client          # Frontend only

# Build
npm run build               # Build both
npm run build:server        # Backend only
npm run build:client        # Frontend only

# Database
npm run db:push             # Push schema changes
npm run db:seed             # Seed demo data
npm run db:studio           # Open Prisma Studio
npm run db:reset            # Reset database

# Utilities
npm run install:all         # Install all dependencies
npm run clean               # Remove node_modules
```

## API Endpoints

### Authentication
```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me
POST   /api/auth/logout
```

### Courses
```
GET    /api/courses                    # List courses (public)
GET    /api/courses/:id                # Course details
GET    /api/courses/my-courses         # Instructor's courses
POST   /api/courses                    # Create (instructor)
PUT    /api/courses/:id                # Update
DELETE /api/courses/:id                # Delete
POST   /api/courses/:id/publish        # Publish
POST   /api/courses/:id/unpublish      # Unpublish
```

### Modules & Lectures
```
GET    /api/courses/:id/modules        # List modules
POST   /api/courses/:id/modules        # Create module
PUT    /api/courses/modules/:id        # Update module
DELETE /api/courses/modules/:id        # Delete module
PUT    /api/courses/:id/modules/reorder

POST   /api/courses/modules/:id/lectures
GET    /api/courses/lectures/:id
PUT    /api/courses/lectures/:id
DELETE /api/courses/lectures/:id
```

### Enrollments
```
GET    /api/enrollments                # My enrollments
POST   /api/enrollments                # Enroll in course
GET    /api/enrollments/course/:id/progress
POST   /api/enrollments/lectures/:id/complete
```

### Assignments
```
GET    /api/assignments/course/:id     # Course assignments
POST   /api/assignments/course/:id     # Create assignment
GET    /api/assignments/:id            # Assignment details
PUT    /api/assignments/:id            # Update
DELETE /api/assignments/:id            # Delete
POST   /api/assignments/:id/submit     # Submit work
GET    /api/assignments/:id/submissions
POST   /api/assignments/submissions/:id/grade
```

## Frontend Routes

### Public
- `/login` - Login page
- `/register` - Registration
- `/catalog` - Course catalog
- `/catalog/:id` - Course details

### Student (authenticated)
- `/dashboard` - User dashboard
- `/learn` - My enrolled courses
- `/learn/:courseId` - Course player
- `/ai-tools` - AI tools hub

### Instructor
- `/teach` - Teaching dashboard
- `/teach/create` - Create new course
- `/teach/courses/:id/edit` - Edit course details
- `/teach/courses/:id/curriculum` - Manage modules & lectures
- `/teach/courses/:id/lectures/:lectureId` - Edit lecture content
- `/teach/courses/:id/assignments` - Manage assignments
- `/teach/courses/:id/assignments/:assignmentId/submissions` - Grade

### Admin
- `/admin` - Admin panel

## Database Models (Prisma)

Key models in `server/prisma/schema.prisma`:
- **User** - with isAdmin, isInstructor flags
- **Course** - title, description, status (draft/published)
- **CourseModule** - ordered sections within course
- **Lecture** - content (text/video/mixed)
- **Enrollment** - student-course relationship
- **LectureProgress** - completion tracking
- **Assignment** - with due dates, points
- **AssignmentSubmission** - student work + grades

## Conventions

### API Response Format
```typescript
{ success: boolean, data?: T, error?: string }
```

### Frontend Patterns
- React Query for server state
- Zustand for auth state (persisted)
- TailwindCSS utility classes
- lucide-react for icons
- react-hot-toast for notifications

### File Organization
- Routes handle HTTP only, delegate to services
- Services contain business logic
- Validation with Zod schemas

## Environment Variables

### Server (`server/.env`)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-secret-key
PORT=5000
OPENAI_API_KEY=optional
GOOGLE_AI_API_KEY=optional
```

### Client (`client/.env`)
```
VITE_API_URL=http://localhost:5000/api
```

## Notes

1. JWT token stored in localStorage via Zustand persist
2. Protected routes check `useAuthStore` for auth
3. Instructor routes require `isInstructor: true` or `isAdmin: true`
4. Frontend proxies API calls through Vite in development
