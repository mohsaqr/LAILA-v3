# Remaining Pre-Deployment Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 remaining issues before classroom deployment: upload enforcement, gradebook N+1, combined quiz+assignment grades, assignment weights, and SnaStepGuide i18n.

**Architecture:** Each fix is independent. Upload enforcement adds per-assignment validation via query param. Gradebook N+1 reuses existing efficient endpoint. Combined gradebook extends the server to include quiz data. Weights add a schema field. SnaStepGuide extracts text to i18n keys.

**Tech Stack:** Express/Multer (server), Prisma (ORM), React/TanStack Query (client), react-i18next (i18n)

---

## Chunk 1: Upload Enforcement + Gradebook N+1

### Task 1: Server-side allowedFileTypes/maxFileSize enforcement

**Files:**
- Modify: `server/src/routes/upload.routes.ts:310-355`
- Modify: `client/src/pages/AssignmentView.tsx` (pass assignmentId in upload)
- Modify: `client/src/api/uploads.ts` (accept optional assignmentId)

**Approach:** Client passes `assignmentId` as a query param on the upload URL. Server looks up the assignment's `allowedFileTypes` and `maxFileSize` before accepting the file. Falls back to current defaults when fields are null.

The key insight: multer's `fileFilter` has access to `req`, so we can read `req.query.assignmentId`, look up the assignment, and enforce dynamically. For `maxFileSize`, we validate post-upload (since multer limits are set at config time, not per-request) and delete the file if it exceeds the assignment's limit.

- [ ] **Step 1: Update upload route to read assignmentId and enforce per-assignment rules**

In `server/src/routes/upload.routes.ts`, replace the static `assignmentSubmissionFilter` and route handler with a dynamic one that queries the assignment:

```typescript
// Assignment submission upload — any authenticated student, per-assignment enforcement
router.post(
  '/assignment-submission',
  authenticateToken,
  assignmentSubmissionUpload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : null;

    if (assignmentId) {
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { allowedFileTypes: true, maxFileSize: true },
      });

      if (assignment) {
        // Enforce file type
        if (assignment.allowedFileTypes) {
          const ext = path.extname(req.file.originalname).toLowerCase();
          const allowed = assignment.allowedFileTypes.split(',').map(t => t.trim().toLowerCase());
          if (!allowed.some(a => a === ext || a === req.file!.mimetype)) {
            fs.unlinkSync(req.file.path);
            res.status(400).json({ success: false, error: `File type ${ext} is not allowed. Accepted: ${assignment.allowedFileTypes}` });
            return;
          }
        }

        // Enforce file size (in MB)
        if (assignment.maxFileSize && req.file.size > assignment.maxFileSize * 1024 * 1024) {
          fs.unlinkSync(req.file.path);
          res.status(400).json({ success: false, error: `File too large. Maximum size is ${assignment.maxFileSize}MB.` });
          return;
        }
      }
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: { url: fileUrl, originalName: req.file.originalname, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype },
    });
  }
);
```

- [ ] **Step 2: Pass assignmentId from client upload handler**

In `client/src/api/uploads.ts`, update `uploadAssignmentSubmission` to accept optional `assignmentId`:

```typescript
uploadAssignmentSubmission: async (file: File, assignmentId?: number): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const params = assignmentId ? `?assignmentId=${assignmentId}` : '';
  const response = await apiClient.post<ApiResponse<UploadResponse>>(
    `/uploads/assignment-submission${params}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data.data!;
},
```

In `client/src/pages/AssignmentView.tsx`, update `handleFileUpload` to pass the assignment ID:

```typescript
const { url } = await uploadsApi.uploadAssignmentSubmission(file, parsedAssignmentId);
```

- [ ] **Step 3: Add prisma import to upload.routes.ts**

Add `import prisma from '../utils/prisma.js';` and `import path from 'path';` (path already imported).

- [ ] **Step 4: Commit**

```
fix: enforce per-assignment allowedFileTypes and maxFileSize on server
```

---

### Task 2: Fix Student Gradebook N+1 queries

**Files:**
- Modify: `client/src/pages/StudentGradebook.tsx`

**Approach:** Replace N individual `getMySubmission()` calls with single `getMyGradebook()` call (endpoint already exists), then filter by courseId client-side.

- [ ] **Step 1: Replace N+1 queries with aggregated endpoint**

Rewrite the data fetching in `StudentGradebook.tsx` to use `assignmentsApi.getMyGradebook()` and filter by `courseId`:

```typescript
const { data: gradebookData, isLoading } = useQuery({
  queryKey: ['myGradebook'],
  queryFn: () => assignmentsApi.getMyGradebook(),
});

const courseGradebook = useMemo(() => {
  if (!gradebookData) return null;
  return gradebookData.find((c: any) => c.courseId === parsedCourseId) ?? null;
}, [gradebookData, parsedCourseId]);
```

Then derive assignments and submissions from `courseGradebook.assignments` instead of separate queries.

- [ ] **Step 2: Remove the Promise.all N-query pattern and individual submission queries**

- [ ] **Step 3: Commit**

```
perf: replace N+1 submission queries with aggregated getMyGradebook endpoint
```

---

## Chunk 2: Combined Quiz+Assignment Gradebook

### Task 3: Extend server gradebook to include quiz scores

**Files:**
- Modify: `server/src/services/assignment.service.ts` (`getStudentGradebook` and `getCourseGradebook`)
- Modify: `client/src/pages/DashboardGradebook.tsx`
- Modify: `client/src/pages/StudentGradebook.tsx`
- Modify: `client/src/pages/teach/TeacherGradebook.tsx`

**Approach:** Add quiz data alongside assignments in the gradebook response. Each quiz becomes a "grade item" with its own points earned/total. The combined percentage uses sum of all earned / sum of all possible.

- [ ] **Step 1: Extend `getStudentGradebook` to include quiz attempts**

In `server/src/services/assignment.service.ts`, after fetching assignments and submissions, also fetch quizzes and attempts for each enrolled course:

```typescript
const quizzes = await prisma.quiz.findMany({
  where: { courseId: enrollment.courseId, isPublished: true },
  select: { id: true, title: true, questions: { select: { points: true } } },
});

const quizAttempts = await prisma.quizAttempt.findMany({
  where: { userId, quizId: { in: quizzes.map(q => q.id) } },
  orderBy: { completedAt: 'desc' },
  distinct: ['quizId'], // best/latest attempt per quiz
  select: { quizId: true, pointsEarned: true, pointsTotal: true, score: true, completedAt: true },
});
```

Add `quizzes` array to the returned course object alongside `assignments`.

- [ ] **Step 2: Extend `getCourseGradebook` similarly for the teacher view**

Add quiz columns and per-student quiz scores to the gradebook.

- [ ] **Step 3: Update DashboardGradebook to display combined totals**

Show both assignment grades and quiz grades, with a combined percentage.

- [ ] **Step 4: Update StudentGradebook to show quizzes**

Add a "Quizzes" section below assignments.

- [ ] **Step 5: Update TeacherGradebook to show quiz columns**

Add quiz columns to the gradebook table (read-only, since quizzes are auto-graded).

- [ ] **Step 6: Commit**

```
feat: include quiz scores in all gradebook views
```

---

## Chunk 3: Assignment Weights + SnaStepGuide i18n

### Task 4: Add assignment weight field

**Files:**
- Modify: `server/prisma/schema.prisma` (Assignment model)
- Modify: `server/src/services/assignment.service.ts` (grade calculation)
- Modify: `server/src/utils/validation.ts` (assignment schemas)
- Modify: `client/src/pages/teach/CurriculumEditor.tsx` (weight input in form)
- Modify: `client/src/pages/teach/TeacherGradebook.tsx` (weighted totals display)

**Approach:** Add optional `weight Float? @default(1.0)` to Assignment. Weight defaults to 1.0 (equal weighting). Gradebook calculation becomes `sum(grade * weight) / sum(points * weight)`. Teachers can set weight per assignment in the curriculum editor. No category system needed — weights are sufficient.

- [ ] **Step 1: Add weight field to schema**

```prisma
model Assignment {
  // ... existing fields
  weight        Float?    @default(1.0)
}
```

- [ ] **Step 2: Run prisma db push**

```bash
cd server && npx prisma db push
```

- [ ] **Step 3: Update validation schema**

In `validation.ts`, add `weight: z.number().min(0).max(10).optional()` to `createAssignmentSchema` and `updateAssignmentSchema`.

- [ ] **Step 4: Update gradebook calculation**

In `getCourseGradebook`, change totals to use weighted calculation:

```typescript
const weight = assignment.weight ?? 1.0;
totalEarned += (submission?.grade ?? 0) * weight;
totalPossible += assignment.points * weight;
```

- [ ] **Step 5: Add weight input to CurriculumEditor assignment modal**

Add a number input for weight (0.0-10.0, step 0.1, default 1.0) in the assignment creation/edit form.

- [ ] **Step 6: Show weights in TeacherGradebook header**

Display weight next to assignment title in the gradebook column header when weight !== 1.0.

- [ ] **Step 7: Commit**

```
feat: add assignment weight field for weighted gradebook calculation
```

---

### Task 5: SnaStepGuide i18n

**Files:**
- Modify: `client/src/components/sna-exercise/SnaStepGuide.tsx`
- Modify: `client/public/locales/en/courses.json`
- Modify: `client/public/locales/fi/courses.json`
- Modify: `client/public/locales/ar/courses.json`
- Modify: `client/public/locales/es/courses.json`

**Approach:** Extract all hardcoded English text to i18n keys under `sna.guide_*` namespace. Add translations for all 4 languages. There are ~55 text blocks across 4 guide components (MetricsGuide, CentralityGuide, CommunitiesGuide, AdjacencyGuide).

- [ ] **Step 1: Add useTranslation to SnaStepGuide and replace all hardcoded text**

Add `import { useTranslation } from 'react-i18next';` and `const { t } = useTranslation(['courses']);` to each guide component. Replace every `<P>...</P>`, `<SectionTitle>...</SectionTitle>`, `<SubTitle>...</SubTitle>` with `t('sna.guide_*')` calls.

- [ ] **Step 2: Add all English keys to en/courses.json**

Add ~55 keys like:
```json
"sna.guide_metrics_density_title": "Density",
"sna.guide_metrics_density_body": "Density is the ratio of actual edges...",
```

- [ ] **Step 3: Add Finnish translations to fi/courses.json**

- [ ] **Step 4: Add Spanish translations to es/courses.json**

- [ ] **Step 5: Add Arabic translations to ar/courses.json**

- [ ] **Step 6: Commit**

```
feat(i18n): translate SnaStepGuide to all 4 languages
```

---

## Verification

After all tasks:
1. Upload a .txt file to an assignment with `allowedFileTypes: ".pdf"` → should be rejected by server
2. Open StudentGradebook → network tab should show 1 request, not N
3. Open DashboardGradebook for a course with quizzes → quiz scores appear alongside assignments
4. Create assignment with weight=2.0, grade it, verify gradebook totals are weighted
5. Switch language to Finnish → SNA step guide renders in Finnish
