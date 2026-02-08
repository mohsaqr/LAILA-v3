import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useLanguageStore } from './store/languageStore';
import analytics from './services/analytics';

// Legacy route redirect components for backward compatibility
const LegacyQuizRedirect = () => {
  const { courseId, quizId, attemptId } = useParams();
  const path = attemptId
    ? `/courses/${courseId}/quizzes/${quizId}/results/${attemptId}`
    : `/courses/${courseId}/quizzes/${quizId}`;
  return <Navigate to={path} replace />;
};

const LegacyForumRedirect = () => {
  const { courseId, forumId, threadId } = useParams();
  const path = threadId
    ? `/courses/${courseId}/forums/${forumId}/threads/${threadId}`
    : `/courses/${courseId}/forums/${forumId}`;
  return <Navigate to={path} replace />;
};

const LegacyCourseRedirect = ({ suffix }: { suffix: string }) => {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId}/${suffix}`} replace />;
};

const LegacyCatalogRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/courses/${id}`} replace />;
};

// Layout
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Auth pages
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';

// Main pages
import { Dashboard } from './pages/Dashboard';
import { Catalog } from './pages/Catalog';
import { CourseDetails } from './pages/CourseDetails';
import { ContentView } from './pages/ContentView';
import { AITools } from './pages/AITools';
import { AITutors } from './pages/AITutors';
import { TestCorner } from './pages/TestCorner';
import { StudentAssignments } from './pages/StudentAssignments';
import { AssignmentView } from './pages/AssignmentView';
import { StudentGradebook } from './pages/StudentGradebook';
import { DashboardGradebook } from './pages/DashboardGradebook';
import { DashboardCalendar } from './pages/DashboardCalendar';
import { CodeLabPage } from './pages/CodeLabPage';
import { Labs } from './pages/Labs';
import { LabRunner } from './pages/LabRunner';
import { LabManager } from './pages/teach/LabManager';
import { QuizView } from './pages/QuizView';
import { QuizResults } from './pages/QuizResults';
import { Forum } from './pages/Forum';
import { ForumList } from './pages/ForumList';
import { CourseForumList } from './pages/CourseForumList';
import { Certificate } from './pages/Certificate';
import { CertificateList } from './pages/CertificateList';
import { CourseCertificates } from './pages/CourseCertificates';
import { CourseQuizList } from './pages/CourseQuizList';
import { StudentQuizList } from './pages/StudentQuizList';
import { LectureView } from './pages/LectureView';

// Teaching pages
import {
  CourseCreate,
  CourseEdit,
  CurriculumEditor,
  LectureEditor,
  CodeLabEditor,
  AssignmentManager,
  SubmissionReview,
  ChatbotLogs,
  TeacherGradebook,
  SurveyManager,
  SurveyResponses,
  CourseTutorManager,
  QuizEditor,
  QuizManager,
  QuizList,
  CertificateManager,
  CourseForumManager,
  CourseCertificateManager,
} from './pages/teach';

// Survey pages
import { SurveyStandalone } from './pages/SurveyStandalone';

// Agent Assignment pages
import {
  StudentAgentBuilder,
  AgentSubmissionsList,
  AgentSubmissionReview,
  UseMyAgent,
} from './pages/agent-assignment';

// Admin pages
import {
  AdminDashboard,
  AdminSettings,
  LogsDashboard,
  UsersManagement,
  UserDetail,
  EnrollmentsManagement,
  BatchEnrollment,
  ChatbotRegistry,
} from './pages/admin';
import { LLMSettings } from './pages/admin/LLMSettings';
import { PromptBlocksManagement } from './pages/admin/PromptBlocksManagement';

// User pages
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';

// AI Tools pages
import { AIBuilder, Chatbots, PromptHelper, BiasResearch, DataAnalyzer } from './pages/ai-tools';

function App() {
  const { setLoading, token, user } = useAuthStore();
  const { direction, initFromUser, isInitialized } = useLanguageStore();

  // Initialize language from user preference or localStorage
  useEffect(() => {
    if (!isInitialized) {
      initFromUser(user?.language);
    }
  }, [user?.language, initFromUser, isInitialized]);

  // Apply RTL direction changes
  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  useEffect(() => {
    // Initialize analytics tracking
    analytics.initialize({
      debug: import.meta.env.DEV,
      flushIntervalMs: 30000, // Flush every 30 seconds
    });

    // Initial auth check
    if (token) {
      setLoading(false);
    } else {
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      analytics.destroy();
    };
  }, [token, setLoading]);

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Main layout routes */}
      <Route element={<Layout />}>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/courses" element={<Catalog />} />
        <Route path="/courses/:id" element={<CourseDetails />} />
        {/* Legacy catalog routes - redirect to /courses */}
        <Route path="/catalog" element={<Navigate to="/courses" replace />} />
        <Route path="/catalog/:id" element={<LegacyCatalogRedirect />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/gradebook"
          element={
            <ProtectedRoute>
              <DashboardGradebook />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/calendar"
          element={
            <ProtectedRoute>
              <DashboardCalendar />
            </ProtectedRoute>
          }
        />

        {/* Content View - Full page view for text content */}
        <Route
          path="/content/:type/:id"
          element={
            <ProtectedRoute>
              <ContentView />
            </ProtectedRoute>
          }
        />

        {/* Student Assignment routes */}
        <Route
          path="/courses/:courseId/assignments"
          element={
            <ProtectedRoute>
              <StudentAssignments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/assignments/:assignmentId"
          element={
            <ProtectedRoute>
              <AssignmentView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/grades"
          element={
            <ProtectedRoute>
              <StudentGradebook />
            </ProtectedRoute>
          }
        />

        {/* AI Agent Assignment routes (Student) */}
        <Route
          path="/courses/:courseId/agent-assignments/:assignmentId"
          element={
            <ProtectedRoute>
              <StudentAgentBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/agent-assignments/:assignmentId/use"
          element={
            <ProtectedRoute>
              <UseMyAgent />
            </ProtectedRoute>
          }
        />

        {/* Lecture routes (Student) */}
        <Route
          path="/courses/:courseId/lectures/:lectureId"
          element={
            <ProtectedRoute>
              <LectureView />
            </ProtectedRoute>
          }
        />

        {/* Code Lab routes (Student) */}
        <Route
          path="/courses/:courseId/code-labs/:codeLabId"
          element={
            <ProtectedRoute>
              <CodeLabPage />
            </ProtectedRoute>
          }
        />

        {/* Quiz routes (Student) */}
        <Route
          path="/courses/:courseId/quizzes/:quizId"
          element={
            <ProtectedRoute>
              <QuizView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/quizzes/:quizId/results/:attemptId"
          element={
            <ProtectedRoute>
              <QuizResults />
            </ProtectedRoute>
          }
        />
        {/* Legacy quiz routes - redirect to new pattern */}
        <Route path="/course/:courseId/quiz/:quizId/results/:attemptId" element={<LegacyQuizRedirect />} />
        <Route path="/course/:courseId/quiz/:quizId" element={<LegacyQuizRedirect />} />

        {/* Forum routes */}
        <Route
          path="/courses/:courseId/forums/:forumId"
          element={
            <ProtectedRoute>
              <Forum />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/forums/:forumId/threads/:threadId"
          element={
            <ProtectedRoute>
              <Forum />
            </ProtectedRoute>
          }
        />
        {/* Legacy forum routes - redirect to new pattern */}
        <Route path="/course/:courseId/forum/:forumId/thread/:threadId" element={<LegacyForumRedirect />} />
        <Route path="/course/:courseId/forum/:forumId" element={<LegacyForumRedirect />} />

        {/* Certificate routes */}
        <Route
          path="/certificate/:certificateId"
          element={
            <ProtectedRoute>
              <Certificate />
            </ProtectedRoute>
          }
        />
        <Route path="/verify/:verificationCode" element={<Certificate />} />

        {/* Forums list (all forums across courses) */}
        <Route
          path="/forums"
          element={
            <ProtectedRoute>
              <ForumList />
            </ProtectedRoute>
          }
        />

        {/* Certificates list (user's certificates) */}
        <Route
          path="/certificates"
          element={
            <ProtectedRoute>
              <CertificateList />
            </ProtectedRoute>
          }
        />

        {/* Course-scoped forums list (student) */}
        <Route
          path="/courses/:courseId/forums"
          element={
            <ProtectedRoute>
              <CourseForumList />
            </ProtectedRoute>
          }
        />
        {/* Legacy route */}
        <Route path="/course/:courseId/forums" element={<LegacyCourseRedirect suffix="forums" />} />

        {/* Course-scoped quizzes list (student) */}
        <Route
          path="/courses/:courseId/quizzes"
          element={
            <ProtectedRoute>
              <CourseQuizList />
            </ProtectedRoute>
          }
        />
        {/* Legacy route */}
        <Route path="/course/:courseId/quizzes" element={<LegacyCourseRedirect suffix="quizzes" />} />

        {/* Global quizzes list (student) */}
        <Route
          path="/quizzes"
          element={
            <ProtectedRoute>
              <StudentQuizList />
            </ProtectedRoute>
          }
        />

        {/* Course-scoped certificates (student) */}
        <Route
          path="/courses/:courseId/certificates"
          element={
            <ProtectedRoute>
              <CourseCertificates />
            </ProtectedRoute>
          }
        />
        {/* Legacy route */}
        <Route path="/course/:courseId/certificates" element={<LegacyCourseRedirect suffix="certificates" />} />

        {/* Standalone Survey route */}
        <Route path="/surveys/:id" element={<SurveyStandalone />} />

        {/* AI Tools - Protected to prevent unauthenticated API credit usage */}
        <Route
          path="/ai-tools"
          element={
            <ProtectedRoute>
              <AITools />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-tools/builder"
          element={
            <ProtectedRoute>
              <AIBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-tools/bias-research"
          element={
            <ProtectedRoute>
              <BiasResearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-tools/prompt-helper"
          element={
            <ProtectedRoute>
              <PromptHelper />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-tools/data-analyzer"
          element={
            <ProtectedRoute>
              <DataAnalyzer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-tools/chatbots"
          element={
            <ProtectedRoute>
              <Chatbots />
            </ProtectedRoute>
          }
        />

        {/* AI Tutors */}
        <Route
          path="/ai-tutors"
          element={
            <ProtectedRoute>
              <AITutors />
            </ProtectedRoute>
          }
        />

        {/* Custom Labs */}
        <Route
          path="/labs"
          element={
            <ProtectedRoute>
              <Labs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/labs/:id"
          element={
            <ProtectedRoute>
              <LabRunner />
            </ProtectedRoute>
          }
        />

        {/* Test Corner */}
        <Route
          path="/test-corner"
          element={
            <ProtectedRoute>
              <TestCorner />
            </ProtectedRoute>
          }
        />

        {/* Teaching routes (instructor) */}
        <Route path="/teach" element={<Navigate to="/courses" replace />} />
        <Route
          path="/teach/create"
          element={
            <ProtectedRoute requireInstructor>
              <CourseCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/edit"
          element={
            <ProtectedRoute requireInstructor>
              <CourseEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/curriculum"
          element={
            <ProtectedRoute requireInstructor>
              <CurriculumEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/lectures/:lectureId"
          element={
            <ProtectedRoute requireInstructor>
              <LectureEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/code-labs/:codeLabId"
          element={
            <ProtectedRoute requireInstructor>
              <CodeLabEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/quizzes"
          element={
            <ProtectedRoute requireInstructor>
              <QuizManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/quizzes/:quizId"
          element={
            <ProtectedRoute requireInstructor>
              <QuizEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/assignments"
          element={
            <ProtectedRoute requireInstructor>
              <AssignmentManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/assignments/:assignmentId/submissions"
          element={
            <ProtectedRoute requireInstructor>
              <SubmissionReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/gradebook"
          element={
            <ProtectedRoute requireInstructor>
              <TeacherGradebook />
            </ProtectedRoute>
          }
        />

        {/* AI Agent Assignment routes (Instructor) */}
        <Route
          path="/teach/courses/:id/agent-assignments/:assignmentId/submissions"
          element={
            <ProtectedRoute requireInstructor>
              <AgentSubmissionsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/assignments/:assignmentId/submissions/:submissionId"
          element={
            <ProtectedRoute requireInstructor>
              <AgentSubmissionReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/chatbot-logs"
          element={
            <ProtectedRoute requireInstructor>
              <ChatbotLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/tutors"
          element={
            <ProtectedRoute requireInstructor>
              <CourseTutorManager />
            </ProtectedRoute>
          }
        />

        {/* Course Forum Manager (Instructor) */}
        <Route
          path="/teach/courses/:id/forums"
          element={
            <ProtectedRoute requireInstructor>
              <CourseForumManager />
            </ProtectedRoute>
          }
        />

        {/* Course Certificate Manager (Instructor) */}
        <Route
          path="/teach/courses/:id/certificates"
          element={
            <ProtectedRoute requireInstructor>
              <CourseCertificateManager />
            </ProtectedRoute>
          }
        />

        {/* Lab Management (Instructor) */}
        <Route
          path="/teach/labs"
          element={
            <ProtectedRoute requireInstructor>
              <LabManager />
            </ProtectedRoute>
          }
        />

        {/* Quiz List (Instructor - all quizzes) */}
        <Route
          path="/teach/quizzes"
          element={
            <ProtectedRoute requireInstructor>
              <QuizList />
            </ProtectedRoute>
          }
        />

        {/* Certificate Manager (Instructor) */}
        <Route
          path="/teach/certificates"
          element={
            <ProtectedRoute requireInstructor>
              <CertificateManager />
            </ProtectedRoute>
          }
        />

        {/* Survey Management routes (Instructor) */}
        <Route
          path="/teach/surveys"
          element={
            <ProtectedRoute requireInstructor>
              <SurveyManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/surveys/:surveyId/responses"
          element={
            <ProtectedRoute requireInstructor>
              <SurveyResponses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/surveys"
          element={
            <ProtectedRoute requireInstructor>
              <SurveyManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teach/courses/:id/surveys/:surveyId/responses"
          element={
            <ProtectedRoute requireInstructor>
              <SurveyResponses />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute requireAdmin>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute requireAdmin>
              <LogsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requireAdmin>
              <UsersManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute requireAdmin>
              <UserDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/enrollments"
          element={
            <ProtectedRoute requireAdmin>
              <EnrollmentsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/batch-enrollment"
          element={
            <ProtectedRoute requireAdmin>
              <BatchEnrollment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/llm-settings"
          element={
            <ProtectedRoute requireAdmin>
              <LLMSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/prompt-blocks"
          element={
            <ProtectedRoute requireAdmin>
              <PromptBlocksManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/chatbot-registry"
          element={
            <ProtectedRoute requireAdmin>
              <ChatbotRegistry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Settings & Profile */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
