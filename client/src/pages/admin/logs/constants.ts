/**
 * Constants for the Logs Dashboard.
 * Event types and color mappings for activity, content, and assessment events.
 */

// Activity Log Verbs (from learning_activity_logs)
export const ACTIVITY_VERBS = [
  'enrolled',
  'unenrolled',
  'viewed',
  'started',
  'completed',
  'progressed',
  'paused',
  'resumed',
  'seeked',
  'scrolled',
  'downloaded',
  'submitted',
  'graded',
  'messaged',
  'received',
  'cleared',
  'interacted',
  'expressed',
  'selected',
  'switched',
] as const;

export type ActivityVerb = (typeof ACTIVITY_VERBS)[number];

// Activity Log Object Types
export const ACTIVITY_OBJECT_TYPES = [
  'course',
  'module',
  'lecture',
  'section',
  'video',
  'assignment',
  'chatbot',
  'file',
  'quiz',
  'emotional_pulse',
  'tutor_agent',
  'tutor_session',
  'tutor_conversation',
] as const;

export type ActivityObjectType = (typeof ACTIVITY_OBJECT_TYPES)[number];

// Content Event Types
export const CONTENT_EVENT_TYPES = [
  'lecture_view',
  'video_play',
  'video_pause',
  'video_complete',
  'video_seek',
  'document_download',
  'scroll_depth_update',
  'lecture_complete',
] as const;

// Assessment Event Types
export const ASSESSMENT_EVENT_TYPES = [
  'assignment_view',
  'assignment_submit',
  'grade_received',
  'feedback_view',
  'assignment_start',
] as const;

export type ContentEventType = (typeof CONTENT_EVENT_TYPES)[number];
export type AssessmentEventType = (typeof ASSESSMENT_EVENT_TYPES)[number];

// Verb color mappings (light and dark mode compatible)
export const verbColors: Record<string, string> = {
  // Enrollment
  enrolled: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  unenrolled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',

  // Viewing
  viewed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  started: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',

  // Progress
  progressed: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  paused: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  resumed: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
  seeked: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300',
  scrolled: 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300',

  // Content
  downloaded: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300',
  submitted: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  graded: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',

  // Communication
  messaged: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  received: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  cleared: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-300',

  // Interaction
  interacted: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-800 dark:text-fuchsia-300',
  expressed: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300',
  selected: 'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-300',
  switched: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
};

// Object Type color mappings
export const objectTypeColors: Record<string, string> = {
  course: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  module: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  lecture: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  section: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  video: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  assignment: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  chatbot: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  file: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-300',
  quiz: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  emotional_pulse: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300',
  tutor_agent: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300',
  tutor_session: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
  tutor_conversation: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-800 dark:text-fuchsia-300',
};

// Legacy event type colors (for backward compatibility with content/assessment events)
export const eventTypeColors: Record<string, string> = {
  // Content events
  lecture_view: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  video_play: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  video_pause: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  video_complete: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  video_seek: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  document_download: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  scroll_depth_update: 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300',
  lecture_complete: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  // Assessment events
  assignment_view: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  assignment_start: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  assignment_submit: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  grade_received: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  feedback_view: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  // Activity log verbs (legacy combined format)
  viewed_course: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  started_lecture: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  completed_lecture: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  progressed_lecture: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  enrolled_course: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  viewed_lecture: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  viewed_section: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  started_video: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  paused_video: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  completed_video: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  submitted_assignment: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  interacted_chatbot: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  messaged_chatbot: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  downloaded_file: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
};

export type TabType = 'activity' | 'interactions' | 'messages' | 'chatbots' | 'forums';

// Chatbot type colors (for Chatbot Registry)
export const chatbotTypeColors: Record<string, string> = {
  global: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  section: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
};
