# LAILA LMS v3.0

**LAILA** (Learn with AI Laboratory) is a modern, AI-powered Learning Management System built with Node.js and React.

## Features

- **Course Management** - Create, edit, and publish courses with modules and lectures
- **Student Enrollment** - Track progress and completion
- **Assignment System** - Create assignments, collect submissions, grade with feedback
- **Teaching Dashboard** - Instructor analytics and course management
- **AI Integration** - OpenAI/Gemini powered tools for education
- **AI Tutors** - Multi-agent AI tutoring system with different personalities
- **Role-based Access** - Student, Instructor, and Admin roles
- **Dark/Light Theme** - Toggle between dark and light modes with persistent preference
- **PWA Support** - Installable Progressive Web App

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite with Prisma ORM |
| State | React Query, Zustand |
| Auth | JWT |
| AI | OpenAI, Google Gemini, OpenRouter |

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
│       ├── hooks/    # Custom hooks (useTheme, useAuth, etc.)
│       ├── store/    # Zustand stores (themeStore, authStore)
│       └── api/      # API client
└── package.json      # Monorepo scripts
```

## Theme System

LAILA supports dark and light themes with automatic persistence:

- Toggle via the sun/moon icon in the navbar
- Toggle via Settings > Appearance > Dark Mode
- Preference saved to `localStorage` as `laila-theme-preference`
- Theme applied before React renders (no flash)

### For Developers

The theme system uses inline styles due to Tailwind dark mode class limitations in the current setup:

```tsx
import { useTheme } from '../hooks/useTheme';

const MyComponent = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div style={{
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      color: isDark ? '#f3f4f6' : '#111827'
    }}>
      Content
    </div>
  );
};
```

## Scripts

```bash
npm run dev           # Start both servers
npm run build         # Build for production
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed demo data
npm run test          # Run tests
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

**Production Build:**
```bash
npm run build
```

**Environment Variables (server/.env):**
```env
DATABASE_URL="file:./prod.db"
JWT_SECRET="your-secure-secret"
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="..."
NODE_ENV="production"
PORT=5000
```

## License

MIT
