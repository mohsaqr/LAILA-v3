import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import analytics from './services/analytics';

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
import { CoursePlayer } from './pages/CoursePlayer';
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

// Teaching pages
import {
  TeachDashboard,
  CourseCreate,
  CourseEdit,
  CurriculumEditor,
  LectureEditor,
  CodeLabEditor,
  AssignmentManager,
  SubmissionReview,
  ChatbotLogs,
  TeacherGradebook,
} from './pages/teach';

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
} from './pages/admin';
import { LLMSettings } from './pages/admin/LLMSettings';
import { PromptBlocksManagement } from './pages/admin/PromptBlocksManagement';

// User pages
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';

// AI Tools pages
import { AIBuilder, Chatbots, PromptHelper, BiasResearch, DataAnalyzer } from './pages/ai-tools';

function App() {
  const { setLoading, token } = useAuthStore();

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
        <Route path="/catalog/:id" element={<CourseDetails />} />

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

        {/* Course Player - accessible from course pages */}
        <Route
          path="/courses/:courseId/player"
          element={
            <ProtectedRoute>
              <CoursePlayer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses/:courseId/player/:lectureId"
          element={
            <ProtectedRoute>
              <CoursePlayer />
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

        {/* Code Lab routes (Student) */}
        <Route
          path="/courses/:courseId/code-labs/:codeLabId"
          element={
            <ProtectedRoute>
              <CodeLabPage />
            </ProtectedRoute>
          }
        />

        {/* AI Tools */}
        <Route path="/ai-tools" element={<AITools />} />
        <Route path="/ai-tools/builder" element={<AIBuilder />} />
        <Route path="/ai-tools/bias-research" element={<BiasResearch />} />
        <Route path="/ai-tools/prompt-helper" element={<PromptHelper />} />
        <Route path="/ai-tools/data-analyzer" element={<DataAnalyzer />} />
        <Route path="/ai-tools/chatbots" element={<Chatbots />} />

        {/* AI Tutors */}
        <Route
          path="/ai-tutors"
          element={
            <ProtectedRoute>
              <AITutors />
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
        <Route
          path="/teach"
          element={
            <ProtectedRoute requireInstructor>
              <TeachDashboard />
            </ProtectedRoute>
          }
        />
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
