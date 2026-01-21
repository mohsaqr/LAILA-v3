# Code Lab Feature - Plan

## Overview

Add a new "Code Lab" content type alongside Lectures and Assignments within course modules. Code Labs contain multiple chained code blocks that share the same R environment, allowing variables and data to flow between blocks.

**Key Points:**
- Code Lab is a **new module element** (sibling to Lecture, Assignment)
- Contains multiple **Code Blocks** that can be chained
- All blocks share one **WebR session** (variables persist across blocks)
- Students can run code and ask AI for debugging help
- Feature is **optional** - instructors choose to add Code Labs or not

---

## Architecture

```
Course
└── Module (e.g., "Week 1: Data Basics")
    ├── Lecture (existing)
    ├── Assignment (existing)
    └── CodeLab (NEW) ─── "Data Filtering Lab"
        ├── CodeBlock 1: "Filter by Time"
        ├── CodeBlock 2: "Filter by Number" (uses Block 1 output)
        └── CodeBlock 3: "Combine Filters" (uses Block 1 & 2)
```

**Chaining Example:**
```r
# Block 1: Load and filter by time
data <- read.csv("...")
time_filtered <- data[data$date > "2024-01-01", ]

# Block 2: Filter by number (uses time_filtered from Block 1)
number_filtered <- time_filtered[time_filtered$count > 100, ]

# Block 3: Combine (variables from both blocks available)
final <- merge(time_filtered, number_filtered)
```

---

## Technical Approach: WebR

**WebR** = R compiled to WebAssembly, runs in browser.

- Single WebR session per Code Lab (variables persist across blocks)
- No server-side R execution needed
- Secure browser sandboxing
- ~15-20MB initial load (cached)

---

## Database Schema

### New Models

```prisma
model CodeLab {
  id          Int         @id @default(autoincrement())
  moduleId    Int         @map("module_id")
  title       String
  description String?
  order       Int         @default(0)
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  module      Module      @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  blocks      CodeBlock[]

  @@index([moduleId])
  @@map("code_labs")
}

model CodeBlock {
  id           Int      @id @default(autoincrement())
  codeLabId    Int      @map("code_lab_id")
  title        String
  instructions String?  // What the student should do
  starterCode  String?  @map("starter_code")  // Pre-filled code
  order        Int      @default(0)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  codeLab      CodeLab  @relation(fields: [codeLabId], references: [id], onDelete: Cascade)

  @@index([codeLabId])
  @@map("code_blocks")
}
```

### Update Module Model

```prisma
model Module {
  // ... existing fields
  codeLabs    CodeLab[]  // Add this relation
}
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| **Database** |
| `server/prisma/schema.prisma` | Modify | Add CodeLab, CodeBlock models |
| **Backend** |
| `server/src/routes/codeLab.routes.ts` | Create | CRUD for Code Labs & Blocks |
| `server/src/services/codeLab.service.ts` | Create | Business logic |
| `server/src/index.ts` | Modify | Register routes |
| **Client - Components** |
| `client/src/components/code/CodeLabPlayer.tsx` | Create | Student view of entire lab |
| `client/src/components/code/CodeBlockRunner.tsx` | Create | Single block with editor + output |
| `client/src/components/code/CodeOutput.tsx` | Create | Output display component |
| `client/src/hooks/useWebR.ts` | Create | WebR session management |
| **Client - Instructor** |
| `client/src/components/teach/CodeLabEditor.tsx` | Create | Create/edit Code Labs |
| `client/src/components/teach/CodeBlockEditor.tsx` | Create | Edit individual blocks |
| **Client - Pages** |
| `client/src/pages/CodeLabPage.tsx` | Create | Full page for Code Lab |
| **Client - API** |
| `client/src/api/codeLabs.ts` | Create | API client |
| **Client - Types** |
| `client/src/types/index.ts` | Modify | Add CodeLab, CodeBlock types |
| **Client - Routing** |
| `client/src/App.tsx` | Modify | Add route for Code Lab page |
| **Curriculum Page** |
| `client/src/pages/teach/Curriculum.tsx` | Modify | Add "Code Lab" button |

---

## UI Design

### Student View - Code Lab Player
```
┌─────────────────────────────────────────────────────────────┐
│ 🧪 Data Filtering Lab                                       │
│ Module: Week 2 - Data Processing                            │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Block 1: Filter by Time                                 │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Instructions: Load the dataset and filter...            │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ # R Code Editor                                     │ │ │
│ │ │ data <- read.csv("sample.csv")                      │ │ │
│ │ │ time_filtered <- data[data$date > "2024-01-01", ]   │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │ [▶ Run]                              [🤖 Ask AI Help]   │ │
│ │ Output:                                                 │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Filtered 150 rows to 42 rows                        │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                            ↓                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Block 2: Filter by Number                               │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Instructions: Use time_filtered from above...           │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ number_filtered <- time_filtered[...]               │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │ [▶ Run]                              [🤖 Ask AI Help]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                            ↓                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Block 3: Combine Results                                │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [◀ Back to Course]                    [▶ Run All Blocks]    │
└─────────────────────────────────────────────────────────────┘
```

### Instructor - Code Lab Editor
```
┌─────────────────────────────────────────────────────────────┐
│ Edit Code Lab                                    [Save] [×] │
├─────────────────────────────────────────────────────────────┤
│ Title: [Data Filtering Lab________________]                 │
│ Description: [Learn to filter datasets in R_______]         │
├─────────────────────────────────────────────────────────────┤
│ Blocks:                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ≡ Block 1: Filter by Time                    [Edit] [×] │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ≡ Block 2: Filter by Number                  [Edit] [×] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                      [+ Add Block]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

```
# Code Labs
GET    /api/code-labs/:id           - Get lab with blocks
POST   /api/code-labs               - Create lab
PUT    /api/code-labs/:id           - Update lab
DELETE /api/code-labs/:id           - Delete lab

# Code Blocks
POST   /api/code-labs/:labId/blocks     - Add block
PUT    /api/code-labs/:labId/blocks/:id - Update block
DELETE /api/code-labs/:labId/blocks/:id - Delete block
PUT    /api/code-labs/:labId/blocks/reorder - Reorder blocks
```

---

## AI Debug Integration

When student clicks "Ask AI Help":
1. Collect context: all code from previous blocks + current block + output/error
2. Open chat modal with pre-filled context
3. Use existing chat infrastructure (no new backend needed)

```
System: Student is working on Code Lab "Data Filtering Lab", Block 2.
Previous blocks executed:
Block 1 code: [code]
Block 1 output: [output]

Current block code: [code]
Current error: [error message]
```

---

## Dependencies

```bash
cd client
npm install webr @monaco-editor/react
```

---

## Verification

1. **Database**
   - Run `npx prisma migrate dev`
   - Verify CodeLab and CodeBlock tables created

2. **Instructor Flow**
   - Open course curriculum
   - Click "Add Code Lab" on a module
   - Create lab with title
   - Add 3 blocks with instructions and starter code
   - Reorder blocks via drag-and-drop
   - Save successfully

3. **Student Flow**
   - Navigate to Code Lab from course player
   - See all blocks in order with instructions
   - Run Block 1 - see output
   - Run Block 2 - verify it can access Block 1 variables
   - Click "Ask AI Help" - verify context includes all blocks

4. **Build Check**
   - `cd client && npm run build` passes
   - `cd server && npm run build` passes

---

## Implementation Steps

### Phase 1: Database Schema ✅

- [x] **1.1** Add CodeLab and CodeBlock models to `server/prisma/schema.prisma`
  ```prisma
  model CodeLab {
    id          Int         @id @default(autoincrement())
    moduleId    Int         @map("module_id")
    title       String
    description String?
    orderIndex  Int         @default(0) @map("order_index")
    isPublished Boolean     @default(false) @map("is_published")
    createdAt   DateTime    @default(now()) @map("created_at")
    updatedAt   DateTime    @updatedAt @map("updated_at")

    module      CourseModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
    blocks      CodeBlock[]

    @@index([moduleId])
    @@map("code_labs")
  }

  model CodeBlock {
    id           Int      @id @default(autoincrement())
    codeLabId    Int      @map("code_lab_id")
    title        String
    instructions String?  @db.Text
    starterCode  String?  @map("starter_code") @db.Text
    orderIndex   Int      @default(0) @map("order_index")
    createdAt    DateTime @default(now()) @map("created_at")
    updatedAt    DateTime @updatedAt @map("updated_at")

    codeLab      CodeLab  @relation(fields: [codeLabId], references: [id], onDelete: Cascade)

    @@index([codeLabId])
    @@map("code_blocks")
  }
  ```

- [x] **1.2** Add `codeLabs` relation to `CourseModule` model
  ```prisma
  model CourseModule {
    // ... existing fields
    codeLabs    CodeLab[]
  }
  ```

- [x] **1.3** Run migration (used `prisma db push`)
  ```bash
  cd server && npx prisma migrate dev --name add_code_labs
  ```

---

### Phase 2: Backend Service ✅

- [x] **2.1** Create `server/src/services/codeLab.service.ts`
  - Implement ownership verification (module → course → instructor)
  - Methods:
    - `getCodeLabsForModule(moduleId: number)`
    - `getCodeLabById(codeLabId: number)`
    - `createCodeLab(moduleId: number, instructorId: number, data, isAdmin: boolean)`
    - `updateCodeLab(codeLabId: number, instructorId: number, data, isAdmin: boolean)`
    - `deleteCodeLab(codeLabId: number, instructorId: number, isAdmin: boolean)`
    - `reorderCodeLabs(moduleId: number, instructorId: number, codeLabIds: number[], isAdmin: boolean)`
    - `createCodeBlock(codeLabId: number, instructorId: number, data, isAdmin: boolean)`
    - `updateCodeBlock(blockId: number, instructorId: number, data, isAdmin: boolean)`
    - `deleteCodeBlock(blockId: number, instructorId: number, isAdmin: boolean)`
    - `reorderCodeBlocks(codeLabId: number, instructorId: number, blockIds: number[], isAdmin: boolean)`

---

### Phase 3: Backend Routes ✅

- [x] **3.1** Create `server/src/routes/codeLab.routes.ts`
  ```typescript
  // Code Labs
  GET    /api/code-labs/module/:moduleId  - Get code labs for module
  GET    /api/code-labs/:id               - Get lab with blocks
  POST   /api/code-labs                   - Create lab { moduleId, title, description? }
  PUT    /api/code-labs/:id               - Update lab { title?, description?, isPublished? }
  DELETE /api/code-labs/:id               - Delete lab
  PUT    /api/code-labs/module/:moduleId/reorder - Reorder labs { codeLabIds: number[] }

  // Code Blocks
  POST   /api/code-labs/:labId/blocks           - Add block { title, instructions?, starterCode? }
  PUT    /api/code-labs/:labId/blocks/:blockId  - Update block
  DELETE /api/code-labs/:labId/blocks/:blockId  - Delete block
  PUT    /api/code-labs/:labId/blocks/reorder   - Reorder blocks { blockIds: number[] }
  ```

- [x] **3.2** Register routes in `server/src/index.ts`
  ```typescript
  import codeLabRoutes from './routes/codeLab.routes';
  app.use('/api/code-labs', codeLabRoutes);
  ```

---

### Phase 4: Client Types ✅

- [x] **4.1** Add types to `client/src/types/index.ts`
  ```typescript
  export interface CodeLab {
    id: number;
    moduleId: number;
    title: string;
    description: string | null;
    orderIndex: number;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    blocks?: CodeBlock[];
  }

  export interface CodeBlock {
    id: number;
    codeLabId: number;
    title: string;
    instructions: string | null;
    starterCode: string | null;
    orderIndex: number;
    createdAt: string;
    updatedAt: string;
  }
  ```

---

### Phase 5: Client API ✅

- [x] **5.1** Create `client/src/api/codeLabs.ts`
  ```typescript
  export const codeLabsApi = {
    // Code Labs
    getCodeLabsForModule: async (moduleId: number) => {...},
    getCodeLabById: async (codeLabId: number) => {...},
    createCodeLab: async (data: { moduleId: number; title: string; description?: string }) => {...},
    updateCodeLab: async (codeLabId: number, data: Partial<CodeLab>) => {...},
    deleteCodeLab: async (codeLabId: number) => {...},
    reorderCodeLabs: async (moduleId: number, codeLabIds: number[]) => {...},

    // Code Blocks
    createCodeBlock: async (codeLabId: number, data: { title: string; instructions?: string; starterCode?: string }) => {...},
    updateCodeBlock: async (codeLabId: number, blockId: number, data: Partial<CodeBlock>) => {...},
    deleteCodeBlock: async (codeLabId: number, blockId: number) => {...},
    reorderCodeBlocks: async (codeLabId: number, blockIds: number[]) => {...},
  };
  ```

---

### Phase 6: Instructor UI - Curriculum Integration

- [ ] **6.1** Modify `client/src/pages/teach/CurriculumEditor.tsx`
  - Add "Add Code Lab" button to each module (alongside Add Lecture)
  - Add CodeLab items in module list (with edit/delete buttons)
  - Query code labs with modules
  - Add create/update/delete mutations for code labs

- [ ] **6.2** Create `client/src/components/teach/CodeLabItem.tsx`
  - Display code lab title with flask/beaker icon
  - Show block count badge
  - Edit and delete buttons
  - Link to code lab editor

---

### Phase 7: Instructor UI - Code Lab Editor

- [ ] **7.1** Create `client/src/pages/teach/CodeLabEditor.tsx`
  - Full page editor for a single code lab
  - Form for title and description
  - List of code blocks (reorderable)
  - Add/edit/delete blocks
  - Save and publish controls

- [ ] **7.2** Create `client/src/components/teach/CodeBlockEditor.tsx`
  - Edit block title
  - Edit instructions (rich text or markdown)
  - Edit starter code (Monaco editor)
  - Preview mode

- [ ] **7.3** Add route in `client/src/App.tsx`
  ```typescript
  <Route path="/teach/courses/:courseId/code-labs/:codeLabId" element={<CodeLabEditor />} />
  ```

---

### Phase 8: Student UI - WebR Integration

- [ ] **8.1** Install dependencies
  ```bash
  cd client && npm install webr @monaco-editor/react
  ```

- [ ] **8.2** Create `client/src/hooks/useWebR.ts`
  - Initialize WebR session
  - Execute R code
  - Capture output (stdout, stderr, plots)
  - Handle errors
  - Session cleanup on unmount

---

### Phase 9: Student UI - Code Lab Player ✅

- [x] **9.1** Create `client/src/pages/CodeLabPage.tsx`
  - Route: `/courses/:courseSlug/code-labs/:codeLabId`
  - Fetch code lab with blocks
  - Initialize WebR session
  - Render CodeLabPlayer component

- [x] **9.2** Create `client/src/components/code/CodeLabPlayer.tsx`
  - Display lab title and description
  - Render all blocks in order with visual chaining
  - Reset session button
  - Back to course navigation

- [x] **9.3** Create `client/src/components/code/CodeBlockRunner.tsx`
  - Display block title and instructions
  - Monaco editor for code (initialized with starterCode)
  - "Run" button to execute code
  - "Ask AI Help" button
  - Show execution status (running, success, error)

- [x] **9.4** Create `client/src/components/code/CodeOutput.tsx`
  - Display text output
  - Display errors (styled red)
  - Display plots/visualizations (base64 images)

- [x] **9.5** Add route in `client/src/App.tsx`
  ```typescript
  <Route path="/courses/:courseSlug/code-labs/:codeLabId" element={<CodeLabPage />} />
  ```

---

### Phase 10: AI Debug Integration ✅

- [x] **10.1** Create `client/src/components/code/CodeLabAIHelper.tsx`
  - Modal with chat interface
  - Pre-populate context with:
    - Lab and block info
    - All previous blocks' code and output
    - Current block code and error
  - Use existing chat API
  - Added block execution tracking to CodeLabPage
  - Integrated AI helper modal with context from all executed blocks

---

### Phase 11: Course Player Integration ✅

- [x] **11.1** Modify course player sidebar to show code labs
  - Add Code Lab items in module content list (after lectures)
  - FlaskConical icon differentiation from lectures (emerald color)
  - Link to CodeLabPage
  - "Lab" badge to distinguish from regular content

- [x] **11.2** Update enrollment service to include code labs
  - Include code labs when fetching course data for enrolled students

---

## Progress Tracking

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database Schema | ✅ Complete |
| 2 | Backend Service | ✅ Complete |
| 3 | Backend Routes | ✅ Complete |
| 4 | Client Types | ✅ Complete |
| 5 | Client API | ✅ Complete |
| 6 | Curriculum Integration | ✅ Complete |
| 7 | Code Lab Editor | ✅ Complete |
| 8 | WebR Integration | ✅ Complete |
| 9 | Code Lab Player | ✅ Complete |
| 10 | AI Debug Integration | ✅ Complete |
| 11 | Course Player Integration | ✅ Complete |

---

## Notes

- Follow existing patterns from Lecture implementation
- Use `orderIndex` for ordering (consistent with modules/lectures)
- Service methods must verify ownership chain: module → course → instructor
- React Query for data fetching with invalidation on mutations
- Monaco Editor for code editing (consistent code experience)
- WebR session persists across blocks within same Code Lab page
