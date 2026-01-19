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
import { MyLearning } from './pages/MyLearning';
import { CoursePlayer } from './pages/CoursePlayer';
import { AITools } from './pages/AITools';
import { StudentAssignments } from './pages/StudentAssignments';
import { AssignmentView } from './pages/AssignmentView';

// Teaching pages
import {
  TeachDashboard,
  CourseCreate,
  CourseEdit,
  CurriculumEditor,
  LectureEditor,
  AssignmentManager,
  SubmissionReview,
  ChatbotLogs,
} from './pages/teach';

// Admin pages
import { AdminDashboard, AnalyticsDashboard } from './pages/admin';

// User pages
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';

// AI Tools pages
import { Chatbots, PromptHelper, BiasResearch, DataAnalyzer } from './pages/ai-tools';

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
        <Route path="/catalog" element={<Catalog />} />
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
          path="/learn"
          element={
            <ProtectedRoute>
              <MyLearning />
            </ProtectedRoute>
          }
        />

        <Route
          path="/learn/:courseId"
          element={
            <ProtectedRoute>
              <CoursePlayer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/learn/:courseId/lecture/:lectureId"
          element={
            <ProtectedRoute>
              <CoursePlayer />
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

        {/* AI Tools */}
        <Route path="/ai-tools" element={<AITools />} />
        <Route path="/ai-tools/bias-research" element={<BiasResearch />} />
        <Route path="/ai-tools/prompt-helper" element={<PromptHelper />} />
        <Route path="/ai-tools/data-analyzer" element={<DataAnalyzer />} />
        <Route path="/ai-tools/chatbots" element={<Chatbots />} />

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
          path="/admin/analytics"
          element={
            <ProtectedRoute requireAdmin>
              <AnalyticsDashboard />
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
