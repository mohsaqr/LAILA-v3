# LAILA Course Structure Improvement Proposal

## Current Structure Overview

```
Course
├── CourseModule (ordered)
│   ├── Lecture → LectureSection (text/file/ai/chatbot/assignment)
│   ├── CodeLab → CodeBlock
│   ├── Assignment
│   ├── Quiz
│   ├── Forum
│   └── LabAssignment
├── CourseTutor (AI tutors)
├── Certificate
└── CoursePrerequisite
```

The current structure is functional but has several areas for improvement.

---

## Identified Issues

### 1. Flat Section Model
`LectureSection` uses a single table with nullable fields for all content types (text, file, chatbot, assignment). This leads to:
- Sparse data (many NULL columns)
- Complex queries to determine section type
- Difficulty adding new section types

### 2. Rigid Module → Lecture Hierarchy
Every piece of content must be nested under a Lecture, even when it doesn't fit (e.g., standalone assessments, resources).

### 3. No Learning Paths
Course prerequisites exist, but there's no fine-grained control over content unlocking within a course based on progress or performance.

### 4. Limited Content Reusability
Content is tightly coupled to courses. No way to reuse lectures, assignments, or quizzes across multiple courses.

### 5. No Adaptive Learning
AI tutors exist but content delivery isn't adaptive based on student performance or learning style.

### 6. Missing Collaborative Structures
Forums exist but no support for:
- Peer review assignments
- Group projects
- Study groups

### 7. No Content Versioning
No audit trail for course content changes.

---

## Proposed Structure

### Option A: Enhanced Hierarchy (Minimal Changes)

Keep the existing structure but add:

```
Course
├── CourseModule
│   ├── ModuleItem (NEW - unified content wrapper)
│   │   ├── type: lecture | quiz | assignment | codelab | forum | resource
│   │   ├── orderIndex
│   │   └── unlockConditions (NEW)
│   └── Lecture
│       └── LectureSection (unchanged)
├── LearningPath (NEW)
│   └── PathNode (references ModuleItems with conditions)
├── ContentLibrary (NEW - reusable content)
└── CourseTutor
```

**Pros:** Minimal migration, backward compatible
**Cons:** Still has some structural limitations

---

### Option B: Flexible Content Model (Recommended)

A more flexible structure that treats all content uniformly:

```
Course
├── CourseUnit (replaces Module - more generic naming)
│   ├── title, description, orderIndex, unlockConditions
│   └── UnitContent (NEW - polymorphic content container)
│       ├── id, unitId, orderIndex, contentType, contentId
│       └── unlockConditions
│
├── Content Types (all standalone, reusable):
│   ├── Article (replaces text sections)
│   ├── VideoLesson (extracted from Lecture)
│   ├── InteractiveLesson (multi-section, replaces Lecture)
│   ├── Assessment (unified Quiz + Assignment)
│   ├── CodeExercise (replaces CodeLab/CodeBlock)
│   ├── Discussion (replaces Forum)
│   └── Resource (files, links, references)
│
├── LearningPath
│   ├── id, courseId, title, description, isDefault
│   └── PathStep
│       ├── contentRef (UnitContent or standalone)
│       ├── orderIndex
│       ├── isRequired
│       └── unlockConditions
│
├── ContentGroup (NEW - for grouping related content)
│   └── GroupItem (references any content)
│
└── AdaptiveRule (NEW - AI-driven content suggestions)
    ├── triggerCondition (quiz_score < 70, time_spent > threshold)
    └── action (suggest_content, unlock_path, notify_tutor)
```

**Key Benefits:**
1. **Content Reusability** - Any content can be shared across courses
2. **Flexible Organization** - Units can contain any mix of content types
3. **Learning Paths** - Multiple paths through the same content
4. **Adaptive Learning** - Rules-based content suggestions
5. **Cleaner Data Model** - No sparse tables

---

## Detailed Schema Changes (Option B)

### New Models

```prisma
// Replaces CourseModule with more generic naming
model CourseUnit {
  id            String   @id @default(cuid())
  courseId      String
  title         String
  description   String?
  label         String?  // "Week 1", "Unit 3", etc.
  orderIndex    Int
  isPublished   Boolean  @default(false)

  // Unlock conditions
  unlockType    UnlockType @default(ALWAYS)
  unlockAfterUnitId String?
  unlockAfterDate   DateTime?
  minPriorProgress  Int?     // Minimum % completion of prior units

  course        Course   @relation(fields: [courseId], references: [id])
  contents      UnitContent[]

  @@index([courseId, orderIndex])
}

enum UnlockType {
  ALWAYS
  AFTER_UNIT
  AFTER_DATE
  AFTER_PROGRESS
  MANUAL
}

// Polymorphic content container
model UnitContent {
  id            String   @id @default(cuid())
  unitId        String
  contentType   ContentType
  contentId     String   // References the actual content
  orderIndex    Int
  isRequired    Boolean  @default(true)

  // Override display settings
  customTitle   String?
  customDescription String?

  // Unlock conditions (inherits from unit if null)
  unlockType    UnlockType?
  prerequisites String[]  // IDs of other UnitContent that must be completed

  unit          CourseUnit @relation(fields: [unitId], references: [id])
  progress      ContentProgress[]

  @@index([unitId, orderIndex])
  @@index([contentType, contentId])
}

enum ContentType {
  ARTICLE
  VIDEO
  INTERACTIVE_LESSON
  ASSESSMENT
  CODE_EXERCISE
  DISCUSSION
  RESOURCE
  EXTERNAL_LINK
}

// Standalone article content
model Article {
  id            String   @id @default(cuid())
  title         String
  content       String   // Rich text / Markdown
  summary       String?
  readingTime   Int?     // Estimated minutes
  authorId      String
  isPublic      Boolean  @default(false)

  author        User     @relation(fields: [authorId], references: [id])
  attachments   ArticleAttachment[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Video lesson (extracted from Lecture)
model VideoLesson {
  id            String   @id @default(cuid())
  title         String
  description   String?
  videoUrl      String
  duration      Int?     // seconds
  transcript    String?
  authorId      String
  isPublic      Boolean  @default(false)

  author        User     @relation(fields: [authorId], references: [id])
  chapters      VideoChapter[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model VideoChapter {
  id            String   @id @default(cuid())
  videoId       String
  title         String
  startTime     Int      // seconds

  video         VideoLesson @relation(fields: [videoId], references: [id])

  @@index([videoId])
}

// Multi-section interactive lesson (like current Lecture)
model InteractiveLesson {
  id            String   @id @default(cuid())
  title         String
  description   String?
  authorId      String
  isPublic      Boolean  @default(false)

  author        User     @relation(fields: [authorId], references: [id])
  sections      LessonSection[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model LessonSection {
  id            String   @id @default(cuid())
  lessonId      String
  orderIndex    Int
  sectionType   LessonSectionType

  // Content based on type (only one populated)
  textContent   String?
  videoUrl      String?
  chatbotId     String?
  assessmentId  String?
  codeExerciseId String?

  // AI generation metadata
  aiGenerated   Boolean  @default(false)
  aiPrompt      String?

  lesson        InteractiveLesson @relation(fields: [lessonId], references: [id])

  @@index([lessonId, orderIndex])
}

enum LessonSectionType {
  TEXT
  VIDEO
  CHATBOT
  ASSESSMENT
  CODE_EXERCISE
  EMBED
}

// Unified assessment model (combines Quiz + Assignment)
model Assessment {
  id              String   @id @default(cuid())
  title           String
  description     String?
  instructions    String?
  assessmentType  AssessmentType
  authorId        String
  isPublic        Boolean  @default(false)

  // Timing
  timeLimit       Int?     // minutes, null = unlimited
  availableFrom   DateTime?
  availableUntil  DateTime?

  // Attempts
  maxAttempts     Int      @default(1)

  // Grading
  totalPoints     Int
  passingScore    Int?     // percentage
  gradingType     GradingType @default(AUTO)
  rubricId        String?

  // AI features
  aiAssisted      Boolean  @default(false)
  aiPrompt        String?

  // Quiz-specific
  shuffleQuestions Boolean @default(false)
  shuffleOptions   Boolean @default(false)
  showResults     ResultVisibility @default(AFTER_SUBMIT)

  // Assignment-specific
  submissionType  SubmissionType?
  peerReviewEnabled Boolean @default(false)
  peerReviewCount   Int?    // How many peers review each submission

  author          User     @relation(fields: [authorId], references: [id])
  rubric          Rubric?  @relation(fields: [rubricId], references: [id])
  questions       AssessmentQuestion[]
  submissions     AssessmentSubmission[]
  peerReviews     PeerReview[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum AssessmentType {
  QUIZ
  ASSIGNMENT
  EXAM
  SURVEY
  PEER_REVIEW
}

enum GradingType {
  AUTO
  MANUAL
  AI_ASSISTED
  PEER
  HYBRID
}

enum ResultVisibility {
  IMMEDIATE
  AFTER_SUBMIT
  AFTER_DUE_DATE
  AFTER_GRADING
  NEVER
}

enum SubmissionType {
  TEXT
  FILE
  CODE
  MIXED
  AI_AGENT
}

// Peer review for assignments
model PeerReview {
  id              String   @id @default(cuid())
  assessmentId    String
  submissionId    String
  reviewerId      String

  score           Int?
  feedback        String?
  rubricScores    Json?    // { criterionId: score }

  status          ReviewStatus @default(PENDING)
  assignedAt      DateTime @default(now())
  completedAt     DateTime?

  assessment      Assessment @relation(fields: [assessmentId], references: [id])
  submission      AssessmentSubmission @relation(fields: [submissionId], references: [id])
  reviewer        User     @relation(fields: [reviewerId], references: [id])

  @@unique([submissionId, reviewerId])
}

enum ReviewStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}

// Learning path for guided progression
model LearningPath {
  id            String   @id @default(cuid())
  courseId      String
  title         String
  description   String?
  isDefault     Boolean  @default(false)
  isAdaptive    Boolean  @default(false) // AI-adjusted based on performance

  course        Course   @relation(fields: [courseId], references: [id])
  steps         PathStep[]
  enrollments   PathEnrollment[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([courseId])
}

model PathStep {
  id            String   @id @default(cuid())
  pathId        String
  unitContentId String?  // Reference to UnitContent
  orderIndex    Int
  isRequired    Boolean  @default(true)
  isMilestone   Boolean  @default(false) // Marks significant progress points

  // Branching conditions
  nextStepDefault String? // Default next step
  branchRules     Json?   // Rules for conditional branching

  path          LearningPath @relation(fields: [pathId], references: [id])

  @@index([pathId, orderIndex])
}

model PathEnrollment {
  id            String   @id @default(cuid())
  pathId        String
  userId        String
  currentStepId String?
  progress      Float    @default(0)

  startedAt     DateTime @default(now())
  completedAt   DateTime?

  path          LearningPath @relation(fields: [pathId], references: [id])
  user          User     @relation(fields: [userId], references: [id])

  @@unique([pathId, userId])
}

// Adaptive learning rules
model AdaptiveRule {
  id            String   @id @default(cuid())
  courseId      String
  name          String
  description   String?
  isActive      Boolean  @default(true)
  priority      Int      @default(0)

  // Trigger conditions (JSON for flexibility)
  triggerType   TriggerType
  triggerConfig Json     // { metric: "quiz_score", operator: "<", value: 70 }

  // Actions
  actionType    ActionType
  actionConfig  Json     // { contentId: "xxx", message: "..." }

  course        Course   @relation(fields: [courseId], references: [id])

  @@index([courseId, isActive])
}

enum TriggerType {
  ASSESSMENT_SCORE
  TIME_SPENT
  ATTEMPT_COUNT
  PROGRESS_STALL
  ENGAGEMENT_DROP
  CUSTOM
}

enum ActionType {
  SUGGEST_CONTENT
  UNLOCK_CONTENT
  SEND_NOTIFICATION
  NOTIFY_INSTRUCTOR
  ADJUST_PATH
  TRIGGER_TUTOR
}

// Content progress tracking (replaces LectureProgress)
model ContentProgress {
  id            String   @id @default(cuid())
  userId        String
  unitContentId String

  status        ProgressStatus @default(NOT_STARTED)
  progress      Float    @default(0)  // 0-100
  timeSpent     Int      @default(0)  // seconds

  startedAt     DateTime?
  completedAt   DateTime?
  lastAccessAt  DateTime @default(now())

  // For video content
  videoPosition Int?     // seconds

  // For assessments
  bestScore     Float?
  attempts      Int      @default(0)

  user          User     @relation(fields: [userId], references: [id])
  unitContent   UnitContent @relation(fields: [unitContentId], references: [id])

  @@unique([userId, unitContentId])
  @@index([userId])
}

enum ProgressStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  SKIPPED
}
```

---

## Migration Strategy

### Phase 1: Add New Models (Non-Breaking)
1. Add new tables alongside existing ones
2. Create data migration scripts to populate new tables from old data
3. Update API to support both old and new structures

### Phase 2: Update Frontend
1. Create new components for the flexible structure
2. Add feature flag to toggle between old/new UI
3. Migrate course by course

### Phase 3: Deprecate Old Models
1. Remove old API endpoints
2. Drop old tables
3. Full migration to new structure

---

## UI/UX Improvements

### 1. Course Builder Redesign

```
┌─────────────────────────────────────────────────────────────┐
│  Course: Introduction to Machine Learning                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📚 UNITS                          │  📝 CONTENT LIBRARY    │
│  ─────────────                     │  ─────────────────     │
│  ▼ Unit 1: Foundations             │  Articles (12)         │
│    ├─ 📄 What is ML? (Article)     │  Videos (8)            │
│    ├─ 🎬 History of AI (Video)     │  Assessments (5)       │
│    ├─ 💬 Ask the Tutor (Chat)      │  Code Exercises (15)   │
│    └─ ✅ Quiz: Basics (Assessment) │                        │
│                                     │  + Create New          │
│  ▼ Unit 2: Linear Regression       │                        │
│    ├─ 📄 Theory (Article)          │  ─────────────────     │
│    ├─ 💻 Code Lab (Exercise)       │  🛤️ LEARNING PATHS    │
│    └─ 📝 Assignment                 │  ─────────────────     │
│                                     │  Default Path          │
│  + Add Unit                         │  Fast Track            │
│                                     │  Deep Dive             │
│                                     │  + Create Path         │
└─────────────────────────────────────────────────────────────┘
```

### 2. Learning Path Editor

Visual drag-and-drop path builder showing:
- Content nodes
- Prerequisites/dependencies
- Branching conditions
- Progress milestones

### 3. Student View

```
┌─────────────────────────────────────────────────────────────┐
│  Your Progress: 45% ████████░░░░░░░░░                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🎯 CURRENT: Unit 2 - Linear Regression                     │
│  ───────────────────────────────────────                    │
│                                                              │
│  ✅ Theory Article                    Completed              │
│  🔄 Code Lab: Simple Regression       In Progress (60%)     │
│  🔒 Assignment: Predict Housing       Locked (complete lab) │
│                                                              │
│  💡 AI TUTOR SUGGESTION                                     │
│  ─────────────────────                                      │
│  Based on your quiz score, we recommend reviewing:          │
│  📄 "Understanding Gradient Descent" (5 min read)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary of Key Improvements

| Feature | Current | Proposed |
|---------|---------|----------|
| Content Organization | Fixed hierarchy | Flexible units with any content type |
| Content Reuse | Not supported | Full library with cross-course sharing |
| Learning Paths | None | Multiple paths with branching |
| Adaptive Learning | Basic AI tutors | Rules-based content suggestions |
| Assessments | Separate Quiz/Assignment | Unified Assessment with types |
| Peer Review | Not supported | Built-in peer review workflow |
| Progress Tracking | Per-lecture | Per-content-item with detailed metrics |
| Unlock Conditions | None | Flexible prerequisite system |

---

## Recommended Next Steps

1. **Review this proposal** - Get stakeholder feedback
2. **Prioritize features** - Which improvements are most valuable?
3. **Prototype** - Build a small proof-of-concept
4. **Detailed design** - API contracts, component designs
5. **Implementation** - Phased rollout with feature flags

---

## Questions for Discussion

1. Should we support content versioning for audit trails?
2. Is multi-language content support needed?
3. Should learning paths be instructor-created or AI-generated?
4. What level of analytics granularity is needed?
5. Should we support SCORM/xAPI for external content integration?
