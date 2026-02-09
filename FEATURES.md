# LAILA V3 - Features Documentation

## Overview

LAILA (Learning Analytics and Intelligent Learning Assistant) is a comprehensive learning management system with AI-powered features, detailed analytics, and a modern user interface.

---

## Core Features

### 1. User Management
- **User Registration & Authentication**
  - Email/password authentication with JWT tokens
  - Role-based access control (Student, Instructor, Admin)
  - Password reset functionality
  - Session management with secure cookies

- **User Roles**
  - **Students**: Enroll in courses, complete assignments, interact with chatbots
  - **Instructors**: Create and manage courses, grade assignments, view analytics
  - **Admins**: Full system access, user management, system settings

### 2. Course Management
- **Course Creation & Organization**
  - Hierarchical structure: Courses → Modules → Lectures → Sections
  - Draft/Published status management
  - Course thumbnails and descriptions
  - Enrollment management (open, invite-only, batch enrollment)

- **Content Types**
  - Text sections with rich formatting
  - File uploads (PDFs, documents, images)
  - AI-generated content sections
  - Interactive chatbot sections
  - Embedded assignments

### 3. Assignment System
- **Assignment Types**
  - Text-based submissions
  - File upload submissions
  - Mixed (text + file) submissions
  - AI Agent-graded assignments

- **Grading Features**
  - Manual instructor grading
  - AI-assisted grading with customizable rubrics
  - Feedback and score tracking
  - Multiple submission attempts

### 4. AI-Powered Chatbots
- **Section Chatbots**
  - Configurable system prompts
  - Custom welcome messages
  - Context-aware responses based on course content
  - Conversation history tracking

- **AI Agent Assignments**
  - Interactive AI tutors for assignments
  - Configurable agent personalities
  - Automated feedback and guidance

---

## Analytics & Logging System

### 5. Unified Learning Activity Log
A comprehensive, xAPI-inspired logging system that tracks all learning activities.

- **Tracked Actions (Verbs)**
  - `enrolled` / `unenrolled` - Course enrollment changes
  - `viewed` - Content viewing (courses, lectures, sections)
  - `started` / `completed` - Activity lifecycle
  - `progressed` - Progress updates with percentages
  - `paused` / `resumed` / `seeked` - Video interactions
  - `scrolled` - Page scroll depth
  - `downloaded` - File downloads
  - `submitted` / `graded` - Assignment workflow
  - `messaged` / `received` / `cleared` - Chatbot interactions

- **Object Types**
  - Course, Module, Lecture, Section
  - Video, Assignment, Chatbot, File, Quiz

- **Context Tracking**
  - Full course hierarchy (course → module → lecture → section)
  - User information (ID, email, name, role)
  - Session tracking
  - Device and browser information

### 6. Chatbot Interaction Logging
Detailed tracking of all chatbot conversations:
- Message content and response content
- AI model used and response time
- Token usage (prompt, completion, total)
- Conversation threading
- Error tracking

### 7. User Interaction Tracking
Client-side behavior analytics:
- Page views and navigation paths
- Click tracking with element details
- Scroll depth monitoring
- Form interactions
- Session duration and time on page

---

## Admin Dashboard

### 8. Admin Features
- **User Management Panel**
  - Create, edit, delete users
  - Role assignment
  - Account activation/deactivation
  - Batch user import

- **Logs Dashboard** (`/admin/logs`)
  - **Activity Log Tab**: View all learning activities with filters
    - Filter by verb, object type, date range
    - Paginated results
    - Export to CSV

  - **Chatbot Logs Tab**: Detailed chatbot interaction history
    - Individual message view (user/bot separated)
    - Conversation context and metadata
    - Response time and AI model tracking
    - Export to JSON

  - **User Interactions Tab**: Client behavior analytics
    - Event type breakdown
    - Top pages visited
    - Device and browser statistics
    - Export to JSON

- **Course Management**
  - View all courses
  - Enrollment statistics
  - Course status management

### 9. Export Capabilities
- Activity logs export (CSV format)
- Chatbot logs export (JSON format)
- User interactions export (JSON format)
- Filtered exports with date ranges

---

## Technical Features

### 10. API Architecture
- RESTful API design
- JWT-based authentication
- Request validation with Zod schemas
- Async error handling
- CORS configuration

### 11. Database
- SQLite with Prisma ORM
- Efficient indexing for log queries
- Relational data model
- Migration support

### 12. Frontend
- React 18 with TypeScript
- Vite for fast development
- TanStack Query for data fetching
- Zustand for state management
- Tailwind CSS for styling
- Responsive design

### 13. Security
- Password hashing with bcrypt
- JWT token authentication
- Role-based route protection
- Input validation and sanitization
- CORS protection

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Token verification

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Enrollments
- `POST /api/enrollments` - Enroll in course
- `GET /api/enrollments` - List user enrollments
- `DELETE /api/enrollments/:id` - Unenroll

### Activity Logging
- `POST /api/activity-log` - Log single activity
- `POST /api/activity-log/batch` - Log multiple activities
- `GET /api/activity-log` - Query logs with filters
- `GET /api/activity-log/stats` - Get aggregated statistics
- `GET /api/activity-log/export` - Export logs (CSV/JSON)

### Analytics
- `POST /api/analytics/interactions` - Store user interactions
- `POST /api/analytics/chatbot-interaction` - Store chatbot interaction
- `GET /api/analytics/interactions/summary` - Get interaction summary
- `GET /api/analytics/chatbot/summary` - Get chatbot summary
- `GET /api/analytics/export/interactions` - Export interactions
- `GET /api/analytics/export/chatbot` - Export chatbot logs

### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/user-management/users` - List all users
- `POST /api/user-management/users` - Create user
- `PUT /api/user-management/users/:id` - Update user
- `DELETE /api/user-management/users/:id` - Delete user

---

## Configuration

### Environment Variables
```env
# Server
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# Client
CLIENT_URL=http://localhost:5173

# AI Services (optional)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Default Admin Account
- Email: `admin@laila.edu`
- Password: `admin123`

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd LAILA-v3
```

2. Install server dependencies
```bash
cd server
npm install
```

3. Set up the database
```bash
npx prisma migrate dev
npx prisma db seed
```

4. Start the server
```bash
npm run dev
```

5. Install client dependencies (new terminal)
```bash
cd client
npm install
```

6. Start the client
```bash
npm run dev
```

7. Access the application at `http://localhost:5173`

---

## Version History

### V3.0.0 (Current)
- Unified learning activity logging system
- Consolidated admin logs dashboard
- Enhanced chatbot interaction tracking
- Improved export functionality
- xAPI-inspired verb/object taxonomy
- Client-side behavior analytics

---

## License

MIT License - See LICENSE file for details.
