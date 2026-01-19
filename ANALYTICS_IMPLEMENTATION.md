# LAILA Learning Analytics Implementation

## Overview

Research-grade learning analytics logging module designed to capture comprehensive data for educational research. All events include both IDs and human-readable names for easy analysis.

---

## Implementation Status

### Completed

| Component | Status | Description |
|-----------|--------|-------------|
| Database Schema | Done | 4 new logging models added to Prisma |
| Auth Event Logging | Done | Login, logout, password reset tracking |
| System Event Logging | Done | Course/enrollment CRUD operations |
| Chatbot Interaction Logging | Done | Full conversation tracking with config |
| User Interaction Logging | Done | Clicks, navigation, page views |
| CSV Export | Done | 6 individual export endpoints |
| Excel Export | Done | Multi-sheet workbook |
| ZIP Export | Done | Bundled CSV archive |
| JSON Export | Done | Course/chatbot configurations |
| Export UI Panel | Done | Admin dashboard export interface |
| Context Tracking | Done | Course/module/lecture context on Learn pages |

### Not Yet Implemented

| Component | Status | Description |
|-----------|--------|-------------|
| Video Event Tracking | Pending | Play, pause, seek, complete events |
| Content View Duration | Pending | Time spent on lectures |
| Document Download Tracking | Pending | File download events |
| Scroll Depth Tracking | Partial | Basic tracking exists, needs lecture-specific |
| Assessment View Events | Pending | When students view assignments |
| Feedback View Events | Pending | When students view graded feedback |
| Session Timeout Detection | Pending | Detect inactive sessions |

---

## Database Schema

### New Models in `server/prisma/schema.prisma`

#### 1. AuthEventLog
Tracks authentication events with full client context.

```
Fields:
- id, timestamp
- userId, userFullname, userEmail
- sessionId, sessionDuration
- eventType: login_success, login_failure, logout, password_reset
- failureReason, attemptCount
- ipAddress, userAgent
- deviceType, browserName, browserVersion, osName, osVersion
```

#### 2. SystemEventLog
Tracks admin/teacher CRUD operations.

```
Fields:
- id, timestamp
- actorId, actorFullname, actorEmail, actorRole
- eventType, eventCategory, changeType
- targetType: course, module, lecture, section, assignment, chatbot
- targetId, targetTitle
- courseId, courseTitle
- targetUserId, targetUserFullname, targetUserEmail
- previousValues (JSON), newValues (JSON)
- ipAddress
```

#### 3. AssessmentEventLog
Tracks assignment and grading events.

```
Fields:
- id, timestamp, sessionId
- userId, userFullname, userEmail
- courseId, courseTitle
- assignmentId, assignmentTitle, submissionId
- eventType: assignment_view, assignment_submit, grade_received, feedback_view
- grade, maxPoints, previousGrade
- attemptNumber, timeSpentSeconds, feedbackLength
- ipAddress, deviceType, browserName
```

#### 4. ContentEventLog
Tracks content consumption events.

```
Fields:
- id, timestamp, timestampMs, sessionId
- userId, userFullname, userEmail
- courseId, courseTitle, moduleId, moduleTitle
- lectureId, lectureTitle, sectionId, sectionTitle
- eventType: lecture_view, video_play, video_pause, video_complete, document_download, scroll_depth_update
- videoPosition, videoDuration, videoPercentWatched
- scrollDepthPercent, timeOnPageSeconds
- documentFileName, documentFileType
- ipAddress, deviceType, browserName, timezone
```

#### 5. UserInteractionLog (Enhanced)
General user interaction tracking.

```
Fields:
- User context: userId, userFullname, userEmail, sessionId
- Location: pageUrl, pagePath, pageTitle, referrerUrl
- Course context: courseId, courseTitle, moduleId, moduleTitle, lectureId, lectureTitle
- Event: eventType, eventCategory, eventAction, eventLabel, eventValue
- Element: elementId, elementType, elementText, elementHref, elementClasses
- Client: deviceType, browserName, browserVersion, osName, osVersion
- Viewport: scrollDepth, viewportWidth, viewportHeight, timeOnPage
- Session: sessionDuration, timestamp
```

#### 6. ChatbotInteractionLog (Enhanced)
Chatbot conversation tracking with full configuration.

```
Fields:
- User/session context
- Course hierarchy: courseId, courseTitle, moduleId, moduleTitle, lectureId, lectureTitle
- Section: sectionId, sectionTitle, sectionOrder
- Chatbot config: chatbotTitle, chatbotIntro, chatbotSystemPrompt, chatbotWelcome, chatbotImageUrl
- Conversation: conversationId, messageIndex, eventType
- Message: messageContent, messageCharCount, messageWordCount
- Response: responseContent, responseCharCount, responseWordCount, responseTime
- AI: aiModel, aiProvider, promptTokens, completionTokens, totalTokens
- Client info: deviceType, browserName, osName, timezone, ipAddress
```

---

## Backend Services

### Created Files

| File | Purpose |
|------|---------|
| `server/src/services/learningAnalytics.service.ts` | Core logging functions |
| `server/src/services/analyticsExport.service.ts` | CSV/Excel/ZIP/JSON export |
| `server/src/routes/analyticsExport.routes.ts` | Export API endpoints |
| `server/src/routes/learningAnalytics.routes.ts` | Event ingestion endpoints |

### Modified Files

| File | Changes |
|------|---------|
| `server/src/services/auth.service.ts` | Added auth event logging |
| `server/src/services/course.service.ts` | Added CRUD event logging |
| `server/src/services/enrollment.service.ts` | Added enrollment event logging |
| `server/src/services/assignment.service.ts` | Added assessment event logging |
| `server/src/services/analytics.service.ts` | Enhanced with context lookups |
| `server/src/index.ts` | Registered new routes |

---

## API Endpoints

### Export Endpoints

```
GET /api/analytics/export/csv/chatbot-logs
GET /api/analytics/export/csv/user-interactions
GET /api/analytics/export/csv/auth-logs
GET /api/analytics/export/csv/system-events
GET /api/analytics/export/csv/assessment-logs
GET /api/analytics/export/csv/content-events
GET /api/analytics/export/excel/all
GET /api/analytics/export/zip/all
GET /api/analytics/export/json/course-settings

Query Parameters:
- startDate: ISO date string
- endDate: ISO date string
- courseId: number
- userId: number
```

### Event Ingestion Endpoints

```
POST /api/analytics/interactions      - Bulk user interactions
POST /api/analytics/chatbot-interaction - Single chatbot event
POST /api/analytics/content-events    - Content consumption events
POST /api/analytics/assessment-events - Assessment events
```

---

## Frontend Components

### Created Files

| File | Purpose |
|------|---------|
| `client/src/components/admin/ExportPanel.tsx` | Export UI with filters |
| `client/src/services/analytics.ts` | Client-side tracking service |

### Modified Files

| File | Changes |
|------|---------|
| `client/src/pages/admin/AnalyticsDashboard.tsx` | Added Export tab, context display |
| `client/src/pages/CoursePlayer.tsx` | Added data attributes for context |
| `client/src/api/admin.ts` | Added export API functions |
| `client/src/App.tsx` | Initialize analytics service |

---

## CSV Export Columns

### chatbot_logs.csv
```
id, timestamp, timestamp_iso, session_id, session_duration_seconds,
user_id, user_fullname, user_email,
course_id, course_title, module_id, module_title, lecture_id, lecture_title,
section_id, section_title,
conversation_id, message_index, event_type,
chatbot_title, chatbot_intro, chatbot_system_prompt, chatbot_welcome,
message_content, message_char_count, message_word_count,
response_content, response_char_count, response_word_count,
response_time_seconds, ai_model, ai_provider,
prompt_tokens, completion_tokens, total_tokens,
ip_address, device_type, browser_name, os_name, timezone
```

### user_interactions.csv
```
id, timestamp, timestamp_iso, session_id, session_duration_seconds,
user_id, user_fullname, user_email,
page_url, page_path, page_title, referrer_url,
course_id, course_title, module_id, module_title, lecture_id, lecture_title,
event_type, event_category, event_action, event_label, event_value,
element_id, element_type, element_text, element_href,
scroll_depth, time_on_page_seconds,
device_type, browser_name, browser_version, os_name,
viewport_width, viewport_height, language, timezone
```

### auth_logs.csv
```
id, timestamp, timestamp_iso,
user_id, user_fullname, user_email,
event_type, session_id, session_duration_seconds,
failure_reason, attempt_count,
ip_address, device_type, browser_name, browser_version, os_name, os_version
```

### system_events.csv
```
id, timestamp, timestamp_iso,
actor_id, actor_fullname, actor_email, actor_role,
event_type, event_category, change_type,
target_type, target_id, target_title,
course_id, course_title,
target_user_id, target_user_fullname, target_user_email,
previous_values, new_values, ip_address
```

### assessment_logs.csv
```
id, timestamp, timestamp_iso, session_id,
user_id, user_fullname, user_email,
course_id, course_title, assignment_id, assignment_title, submission_id,
event_type, grade, max_points, previous_grade,
attempt_number, time_spent_seconds, feedback_length,
ip_address, device_type, browser_name
```

### content_events.csv
```
id, timestamp, timestamp_iso, session_id,
user_id, user_fullname, user_email,
course_id, course_title, module_id, module_title,
lecture_id, lecture_title, section_id, section_title,
event_type, video_position, video_duration, video_percent_watched,
scroll_depth_percent, time_on_page_seconds,
document_file_name, document_file_type,
ip_address, device_type, browser_name, timezone
```

---

## How Context Tracking Works

### Frontend (CoursePlayer.tsx)
```tsx
// Data attributes added to main container
<div
  data-analytics-context={JSON.stringify({
    courseId, courseTitle,
    moduleId, moduleTitle,
    lectureId, lectureTitle
  })}
  data-course-id={courseId}
  data-module-id={moduleId}
  data-lecture-id={lectureId}
>
```

### Client Analytics (analytics.ts)
```typescript
// extractCourseContext() reads data attributes
// Called on every tracked interaction
// Returns { courseId, moduleId, lectureId }
```

### Backend (analytics.service.ts)
```typescript
// storeInteractions() looks up titles from database
// Maps IDs to human-readable names
// Stores both ID and title for each event
```

---

## Dependencies Added

```bash
# Server
npm install csv-stringify exceljs archiver
npm install -D @types/archiver
```

---

## Testing the System

1. **Auth Logging**: Login/logout and check auth_logs export
2. **CRUD Logging**: Create/edit course and check system_events export
3. **Interaction Logging**: Navigate Learn pages and check user_interactions export
4. **Chatbot Logging**: Use a chatbot and check chatbot_logs export
5. **Export Formats**: Test CSV, Excel, ZIP, JSON downloads

---

## Remaining Work

### High Priority

1. **Video Event Tracking**
   - Add event listeners to video player
   - Track: play, pause, seek, complete, buffer
   - Log video position and watch percentage

2. **Content View Duration**
   - Track time spent on each lecture
   - Send beacon on page unload
   - Calculate engagement metrics

3. **Document Download Tracking**
   - Intercept download clicks
   - Log file name, type, size

### Medium Priority

4. **Assessment View Events**
   - Track when students open assignments
   - Log time between view and submit

5. **Feedback View Events**
   - Track when students view grades/feedback
   - Measure feedback engagement

6. **Session Management**
   - Detect session timeout
   - Track session duration accurately
   - Handle tab switching

### Low Priority

7. **Dashboard Visualizations**
   - Add charts for engagement metrics
   - Cohort comparison views
   - Learning path analysis

8. **Data Retention**
   - Add cleanup jobs for old data
   - Implement data archival

---

## File Structure

```
server/
├── prisma/
│   └── schema.prisma          # Database models
├── src/
│   ├── routes/
│   │   ├── analyticsExport.routes.ts
│   │   └── learningAnalytics.routes.ts
│   └── services/
│       ├── analytics.service.ts
│       ├── analyticsExport.service.ts
│       └── learningAnalytics.service.ts

client/
├── src/
│   ├── components/admin/
│   │   └── ExportPanel.tsx
│   ├── pages/
│   │   ├── admin/AnalyticsDashboard.tsx
│   │   └── CoursePlayer.tsx
│   ├── services/
│   │   └── analytics.ts
│   └── api/
│       └── admin.ts
```
