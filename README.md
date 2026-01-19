# LAILA LMS v3.0

**LAILA** (Learn with AI Laboratory) is a modern, AI-powered Learning Management System built with Node.js and React.

## Features

- **Course Management** - Create, edit, and publish courses with modules and lectures
- **Student Enrollment** - Track progress and completion
- **Assignment System** - Create assignments, collect submissions, grade with feedback
- **Teaching Dashboard** - Instructor analytics and course management
- **AI Integration** - OpenAI/Gemini powered tools for education
- **Role-based Access** - Student, Instructor, and Admin roles

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite with Prisma ORM |
| State | React Query, Zustand |
| Auth | JWT |

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url> LAILA-v3
cd LAILA-v3

# Install dependencies
npm run install:all

# Set up environment
cp .env.example server/.env

# Initialize database
npm run db:push
npm run db:seed

# Start development servers
npm run dev
```

### Access

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000
- **Database UI:** `npm run db:studio`

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@laila.edu | admin123 |
| Instructor | instructor@laila.edu | instructor123 |
| Student | student@laila.edu | student123 |

## Project Structure

```
LAILA-v3/
├── server/           # Express API
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── middleware/
│   └── prisma/       # Database schema
├── client/           # React SPA
│   └── src/
│       ├── pages/    # Page components
│       ├── components/
│       └── api/      # API client
└── package.json      # Monorepo scripts
```

## Scripts

```bash
npm run dev           # Start both servers
npm run build         # Build for production
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed demo data
```

## License

MIT
