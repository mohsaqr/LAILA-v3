# LAILA - Learning Analytics and Intelligent Learning Assistant

A multi-agent tutoring platform built around pedagogically distinct AI personas. LAILA provides seven pre-built tutor agents, a student agent builder for learning-through-design, and deploys agents across five interaction surfaces within a full learning management system.

## Features

### Multi-Agent Tutoring System
- **7 built-in agents** in two categories:
  - *Professional tutors*: Socratic Guide, Helpful Guide, Project Coach
  - *Peer personas*: Carmen, Laila, Beatrice, Study Buddy
- **4 routing modes**: Manual selection, intelligent keyword-based routing, collaborative multi-agent responses, random encounter
- **Collaborative styles**: Parallel, sequential, debate, and random multi-agent interactions
- **5 deployment surfaces**: Global tutoring, course-level tutors, forum AI participation, lecture-embedded chatbots, lecture AI helper (explain & discuss)

### Student Agent Builder
- 10 pedagogical role templates (Peer Tutor, Socratic Guide, Writing Coach, Debate Partner, etc.)
- 7 personality presets with 38 modular prompt building blocks across 6 categories
- Live testing environment with versioned configuration snapshots
- Design process analytics: iteration tracking, change audit trail, design event logging
- Graded coursework submissions with instructor review interface

### AI-Powered Content Generation
- **MCQ Generation**: Quiz questions with configurable difficulty (easy/medium/hard), 3-5 options, auto-generated explanations
- **Practice Questions**: Students generate self-study questions from lecture content
- **Survey Generation**: 5 survey types (general feedback, course evaluation, Likert scale, learning strategies, custom)

### Assessment Engine
- Multiple question types: multiple choice, true/false, short answer, fill-in-the-blank
- Time limits, max attempts, question/option shuffling, availability windows
- Auto-grading, auto-save, and resume support

### Custom Labs & Code Execution
- 10 lab types: TNA, Statistics, Network Analysis, Sequence Analysis, Data Visualization, Regression, Clustering, Time Series, Text Analysis, Custom
- Browser-based R execution via WebR with Monaco editor
- Pre-built templates for established instruments (MSLQ, COLLES, R-SPQ-2F)
- Lab assignment to courses with access control

### Multi-Provider LLM Infrastructure
- Supports OpenAI, Anthropic, Google Gemini, Ollama, LM Studio, Groq, and OpenAI-compatible endpoints
- 50+ configuration parameters per provider
- Health checking, usage statistics, provider fallback
- Local-first deployment via Ollama/LM Studio

### Learning Analytics
- Per-message interaction logging across all surfaces
- Unified xAPI-inspired activity logging (actor-verb-object)
- Emotional Pulse: 7-state self-report (productive, stimulated, frustrated, learning, enjoying, bored, quitting)
- Client-side behavioral analytics with scroll depth tracking
- CSV, JSON, and Excel export

### Course Management
- Modules and lectures with rich content sections
- Student enrollment and progress tracking
- Assignment system with submissions and grading
- Discussion forums with AI participation
- Teaching dashboard with instructor analytics

### Additional
- **Internationalization**: English, Finnish, Arabic (RTL), Spanish
- **Dark/Light theme** with persistent preference
- **PWA support** for installable app
- **Role-based access**: Student, Instructor, Admin

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| AI Providers | OpenAI, Anthropic, Google Gemini, Ollama, LM Studio, Groq |
| Code Execution | WebR (WebAssembly R), Monaco Editor |
| Testing | Vitest (900+ tests) |
| Auth | JWT |

## Project Structure

```
LAILA-v3/
├── client/                 # React frontend (Vite)
│   ├── public/locales/     # i18n translation files (en, fi, es, ar)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── config/         # Pedagogical roles, prompt blocks
│   │   ├── pages/          # Page components
│   │   ├── styles/         # CSS (Tailwind)
│   │   ├── i18n/           # i18n configuration
│   │   └── store/          # Zustand stores
│   └── package.json
├── server/                 # Express backend
│   ├── prisma/             # Database schema and seed data
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utilities (prisma, logger)
│   └── package.json
└── CLAUDE.md               # AI agent context file
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- At least one AI provider API key (OpenAI, Anthropic, Gemini, or local Ollama)

### Installation

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Set up environment
cp .env.example server/.env    # Configure database URL and API keys

# Initialize database
cd server
npx prisma migrate dev
npx prisma db seed
```

### Development

```bash
# Start both client and server (from root)
npm run dev

# Or separately:
cd client && npm run dev     # Frontend on port 5174
cd server && npm run dev     # Backend on port 5001
```

### Access

- **Frontend:** http://localhost:5174
- **Backend:** http://localhost:5001
- **Database UI:** `cd server && npx prisma studio`

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@laila.edu | admin123 |
| Instructor | instructor@laila.edu | instructor123 |
| Student | student@laila.edu | student123 |

## Testing

```bash
cd server && npm test                                # Run all 900+ tests
cd server && npm test -- --run src/path/to/test.ts   # Run specific test file
cd server && npm test -- --run -t "test name"        # Run specific test by name
```

## Documentation

See [LAILA-Multi-Agent-System-Report.html](LAILA-Multi-Agent-System-Report.html) for the full technical report covering agent architecture, persona design, routing strategies, prompt construction, and learning analytics.

## Author & Maintainer

**Mohammed Saqr**
Professor of Computer Science, University of Eastern Finland

- Website: [www.saqr.me](https://www.saqr.me)
- Email: mohammed.saqr@uef.fi

## License

MIT
