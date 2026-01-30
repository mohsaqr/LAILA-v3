# Collaborative Module - Remaining Tasks

## Completed ✅

### Database
- [x] Added `CourseTutor` model (links global tutors to courses with customization)
- [x] Added `CourseTutorConversation` model (student conversations)
- [x] Added `CourseTutorMessage` model (chat messages)
- [x] Added relations to User, Course, Chatbot models
- [x] Ran `prisma db push`

### Backend
- [x] `server/src/services/courseTutor.service.ts` - Full service layer
- [x] `server/src/routes/courseTutor.routes.ts` - All API endpoints
- [x] Registered routes in `server/src/index.ts`

### Frontend
- [x] `client/src/api/courseTutor.ts` - API client
- [x] `client/src/pages/teach/CourseTutorManager.tsx` - Instructor management UI
- [x] `client/src/components/course/CollaborativeModule.tsx` - Student tutor grid
- [x] `client/src/components/course/CourseTutorChat.tsx` - Chat interface
- [x] Added "Tutors" button in TeachDashboard
- [x] Added route `/teach/courses/:id/tutors` in App.tsx
- [x] Added CollaborativeModule section in CourseDetails.tsx

---

## To Do Tomorrow 🔧

### 1. Teaching Dashboard Access
- [ ] User reported no proper link to Teaching Dashboard
- [ ] Sidebar has "Teaching" link for instructors - verify it works
- [ ] Consider adding more visible entry point (top navbar? dashboard card?)

### 2. Verify UI Flow
- [ ] Test instructor flow: TeachDashboard → "Tutors" button → CourseTutorManager
- [ ] Test adding a global tutor to a course
- [ ] Test student flow: CourseDetails → Collaborative Module section
- [ ] Confirm tutors only appear after instructor adds them

### 3. UI Placement Discussion
- [ ] User questioned the CourseDetails integration approach
- [ ] Currently: Collaborative Module appears as a section after Assignments
- [ ] May need adjustment based on user feedback

### 4. Testing Checklist
- [ ] Instructor can add global tutors to a course
- [ ] Instructor can customize name, description, system prompt, welcome message
- [ ] Instructor can remove and reorder tutors
- [ ] Instructor sees usage stats per tutor
- [ ] Student sees Collaborative Module in enrolled courses
- [ ] Student can start new conversation with course tutor
- [ ] Student conversation history persists
- [ ] Customizations merge properly (custom overrides global)
- [ ] Course tutors don't appear in main AI Tutors page
- [ ] Dark mode styling works throughout

---

## File Summary

| File | Status |
|------|--------|
| `server/prisma/schema.prisma` | Modified |
| `server/src/services/courseTutor.service.ts` | Created |
| `server/src/routes/courseTutor.routes.ts` | Created |
| `server/src/index.ts` | Modified |
| `client/src/api/courseTutor.ts` | Created |
| `client/src/pages/teach/CourseTutorManager.tsx` | Created |
| `client/src/pages/teach/index.ts` | Modified |
| `client/src/components/course/CollaborativeModule.tsx` | Created |
| `client/src/components/course/CourseTutorChat.tsx` | Created |
| `client/src/pages/teach/TeachDashboard.tsx` | Modified |
| `client/src/pages/CourseDetails.tsx` | Modified |
| `client/src/App.tsx` | Modified |
