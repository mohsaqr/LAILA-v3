-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "is_instructor" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" TEXT,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT,
    "setting_type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_configurations" (
    "id" SERIAL NOT NULL,
    "service_name" TEXT NOT NULL,
    "api_key" TEXT,
    "default_model" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit" INTEGER,
    "configuration_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_providers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "provider_type" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "base_url" TEXT,
    "api_key" TEXT,
    "api_version" TEXT,
    "organization_id" TEXT,
    "project_id" TEXT,
    "default_model" TEXT,
    "default_model_id" TEXT,
    "default_temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "default_max_tokens" INTEGER NOT NULL DEFAULT 2048,
    "default_top_p" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "default_top_k" INTEGER,
    "default_frequency_penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "default_presence_penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "default_repeat_penalty" DOUBLE PRECISION,
    "max_context_length" INTEGER,
    "max_output_tokens" INTEGER,
    "default_context_length" INTEGER,
    "default_stop_sequences" TEXT,
    "default_response_format" TEXT,
    "request_timeout" INTEGER NOT NULL DEFAULT 120000,
    "connect_timeout" INTEGER NOT NULL DEFAULT 30000,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay" INTEGER NOT NULL DEFAULT 1000,
    "retry_backoff_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "rate_limit_rpm" INTEGER,
    "rate_limit_tpm" INTEGER,
    "rate_limit_rpd" INTEGER,
    "concurrency_limit" INTEGER NOT NULL DEFAULT 5,
    "supports_streaming" BOOLEAN NOT NULL DEFAULT true,
    "default_streaming" BOOLEAN NOT NULL DEFAULT false,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "supports_function_calling" BOOLEAN NOT NULL DEFAULT false,
    "supports_json_mode" BOOLEAN NOT NULL DEFAULT false,
    "supports_system_message" BOOLEAN NOT NULL DEFAULT true,
    "supports_multiple_system_messages" BOOLEAN NOT NULL DEFAULT false,
    "proxy_url" TEXT,
    "proxy_username" TEXT,
    "proxy_password" TEXT,
    "custom_headers" TEXT,
    "skip_tls_verify" BOOLEAN NOT NULL DEFAULT false,
    "custom_ca_cert" TEXT,
    "health_check_enabled" BOOLEAN NOT NULL DEFAULT true,
    "health_check_interval" INTEGER NOT NULL DEFAULT 60000,
    "last_health_check" TIMESTAMP(3),
    "health_status" TEXT,
    "last_error" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "total_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "total_errors" INTEGER NOT NULL DEFAULT 0,
    "average_latency" DOUBLE PRECISION,
    "metadata" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_models" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "model_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model_type" TEXT NOT NULL DEFAULT 'chat',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "context_length" INTEGER,
    "max_output_tokens" INTEGER,
    "default_temperature" DOUBLE PRECISION,
    "default_max_tokens" INTEGER,
    "default_top_p" DOUBLE PRECISION,
    "default_top_k" INTEGER,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "supports_function_calling" BOOLEAN NOT NULL DEFAULT false,
    "supports_json_mode" BOOLEAN NOT NULL DEFAULT false,
    "supports_streaming" BOOLEAN NOT NULL DEFAULT true,
    "input_price_per_1m" DOUBLE PRECISION,
    "output_price_per_1m" DOUBLE PRECISION,
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_settings" (
    "id" SERIAL NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT,
    "setting_type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "session_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "module" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "ai_model" TEXT,
    "response_time_sec" DOUBLE PRECISION,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "session_id" TEXT,
    "interaction_type" TEXT,
    "page" TEXT,
    "action" TEXT,
    "element_id" TEXT,
    "element_type" TEXT,
    "element_value" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "additional_data" TEXT,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_submissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "submission_type" TEXT,
    "submission_data" TEXT,
    "vignette_content" TEXT,
    "nationality" TEXT,
    "gender" TEXT,
    "field_of_study" TEXT,
    "academic_level" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_analysis_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "analysis_type" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "analysis_result" TEXT,
    "ai_model" TEXT,
    "processing_time_sec" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',

    CONSTRAINT "data_analysis_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbots" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "creator_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "welcome_message" TEXT,
    "avatar_url" TEXT,
    "personality" TEXT DEFAULT 'friendly',
    "personality_prompt" TEXT,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "suggested_questions" TEXT,
    "dos_rules" TEXT,
    "donts_rules" TEXT,
    "response_style" TEXT DEFAULT 'balanced',
    "max_tokens" INTEGER DEFAULT 1000,
    "model_preference" TEXT,
    "knowledge_context" TEXT,

    CONSTRAINT "chatbots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "instructor_id" INTEGER NOT NULL,
    "difficulty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "collaborative_module_name" TEXT,
    "collaborative_module_enabled" BOOLEAN NOT NULL DEFAULT true,
    "emotional_pulse_enabled" BOOLEAN NOT NULL DEFAULT true,
    "tutor_routing_mode" TEXT NOT NULL DEFAULT 'all',
    "default_tutor_id" INTEGER,
    "curriculum_view_mode" TEXT NOT NULL DEFAULT 'mini-cards',
    "enabled_labs" TEXT,
    "activation_code" TEXT,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_categories" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "label" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "interactive_labs" TEXT,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectures" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "content_type" TEXT NOT NULL DEFAULT 'text',
    "video_url" TEXT,
    "duration" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_sections" (
    "id" SERIAL NOT NULL,
    "lecture_id" INTEGER NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "file_name" TEXT,
    "file_url" TEXT,
    "file_type" TEXT,
    "file_size" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "chatbot_title" TEXT,
    "chatbot_intro" TEXT,
    "chatbot_image_url" TEXT,
    "chatbot_system_prompt" TEXT,
    "chatbot_welcome" TEXT,
    "assignment_id" INTEGER,
    "show_deadline" BOOLEAN NOT NULL DEFAULT true,
    "show_points" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lecture_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_attachments" (
    "id" SERIAL NOT NULL,
    "lecture_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_explain_threads" (
    "id" SERIAL NOT NULL,
    "lecture_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_explain_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_explain_posts" (
    "id" SERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "author_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ai_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_explain_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_labs" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_blocks" (
    "id" SERIAL NOT NULL,
    "code_lab_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "starter_code" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "last_access_at" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_progress" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER NOT NULL,
    "lecture_id" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "time_spent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lecture_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_id" INTEGER,
    "lecture_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "submission_type" TEXT NOT NULL DEFAULT 'text',
    "max_file_size" INTEGER,
    "allowed_file_types" TEXT,
    "due_date" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 100,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "ai_assisted" BOOLEAN NOT NULL DEFAULT false,
    "ai_prompt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "agent_requirements" TEXT,
    "reflection_requirement" TEXT,
    "post_survey_id" INTEGER,
    "post_survey_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_attachments" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT,
    "file_urls" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" DOUBLE PRECISION,
    "feedback" TEXT,
    "graded_at" TIMESTAMP(3),
    "graded_by" INTEGER,
    "ai_feedback" TEXT,
    "agent_config_id" INTEGER,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_announcements" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_conversations" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_conversation_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_interaction_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_fullname" TEXT,
    "user_email" TEXT,
    "session_id" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "course_slug" TEXT,
    "module_id" INTEGER,
    "module_title" TEXT,
    "module_order_index" INTEGER,
    "lecture_id" INTEGER,
    "lecture_title" TEXT,
    "lecture_order_index" INTEGER,
    "section_id" INTEGER NOT NULL,
    "section_order_index" INTEGER,
    "conversation_id" INTEGER,
    "conversation_message_count" INTEGER,
    "message_index" INTEGER,
    "event_type" TEXT NOT NULL,
    "event_sequence" INTEGER,
    "chatbot_title" TEXT,
    "chatbot_intro" TEXT,
    "chatbot_image_url" TEXT,
    "chatbot_system_prompt" TEXT,
    "chatbot_welcome_message" TEXT,
    "message_content" TEXT,
    "message_char_count" INTEGER,
    "message_word_count" INTEGER,
    "response_content" TEXT,
    "response_char_count" INTEGER,
    "response_word_count" INTEGER,
    "response_time" DOUBLE PRECISION,
    "ai_model" TEXT,
    "ai_provider" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "error_message" TEXT,
    "error_code" TEXT,
    "error_stack" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "browser_name" TEXT,
    "browser_version" TEXT,
    "os_name" TEXT,
    "os_version" TEXT,
    "device_type" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "language" TEXT,
    "timezone" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp_ms" BIGINT,
    "session_start_time" TIMESTAMP(3),
    "session_duration" INTEGER,
    "metadata" TEXT,
    "test_mode" TEXT,

    CONSTRAINT "chatbot_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interaction_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_fullname" TEXT,
    "user_email" TEXT,
    "session_id" TEXT,
    "page_url" TEXT,
    "page_path" TEXT,
    "page_title" TEXT,
    "referrer_url" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "module_id" INTEGER,
    "module_title" TEXT,
    "lecture_id" INTEGER,
    "lecture_title" TEXT,
    "event_type" TEXT NOT NULL,
    "event_category" TEXT,
    "event_action" TEXT,
    "event_label" TEXT,
    "event_value" DOUBLE PRECISION,
    "event_sequence" INTEGER,
    "element_id" TEXT,
    "element_type" TEXT,
    "element_text" TEXT,
    "element_href" TEXT,
    "element_classes" TEXT,
    "element_name" TEXT,
    "element_value" TEXT,
    "scroll_depth" INTEGER,
    "viewport_width" INTEGER,
    "viewport_height" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "browser_name" TEXT,
    "browser_version" TEXT,
    "os_name" TEXT,
    "os_version" TEXT,
    "device_type" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "language" TEXT,
    "timezone" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp_ms" BIGINT,
    "session_start_time" TIMESTAMP(3),
    "session_duration" INTEGER,
    "time_on_page" INTEGER,
    "metadata" TEXT,
    "test_mode" TEXT,

    CONSTRAINT "user_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_event_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_fullname" TEXT,
    "user_email" TEXT,
    "session_id" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "module_id" INTEGER,
    "module_title" TEXT,
    "lecture_id" INTEGER,
    "lecture_title" TEXT,
    "section_id" INTEGER,
    "section_title" TEXT,
    "event_type" TEXT NOT NULL,
    "video_position" DOUBLE PRECISION,
    "video_duration" DOUBLE PRECISION,
    "video_percent_watched" DOUBLE PRECISION,
    "scroll_depth_percent" INTEGER,
    "time_on_page_seconds" INTEGER,
    "document_file_name" TEXT,
    "document_file_type" TEXT,
    "ip_address" TEXT,
    "device_type" TEXT,
    "browser_name" TEXT,
    "timezone" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp_ms" BIGINT,

    CONSTRAINT "content_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_event_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_fullname" TEXT,
    "user_email" TEXT,
    "session_id" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "assignment_id" INTEGER,
    "assignment_title" TEXT,
    "submission_id" INTEGER,
    "event_type" TEXT NOT NULL,
    "grade" DOUBLE PRECISION,
    "max_points" DOUBLE PRECISION,
    "previous_grade" DOUBLE PRECISION,
    "attempt_number" INTEGER,
    "time_spent_seconds" INTEGER,
    "feedback_length" INTEGER,
    "ip_address" TEXT,
    "device_type" TEXT,
    "browser_name" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_event_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "actor_fullname" TEXT,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "event_type" TEXT NOT NULL,
    "event_category" TEXT NOT NULL,
    "change_type" TEXT,
    "target_type" TEXT,
    "target_id" INTEGER,
    "target_title" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "target_user_id" INTEGER,
    "target_user_fullname" TEXT,
    "target_user_email" TEXT,
    "previous_values" TEXT,
    "new_values" TEXT,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_event_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_fullname" TEXT,
    "user_email" TEXT NOT NULL,
    "session_id" TEXT,
    "session_duration" INTEGER,
    "event_type" TEXT NOT NULL,
    "failure_reason" TEXT,
    "attempt_count" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "browser_name" TEXT,
    "browser_version" TEXT,
    "os_name" TEXT,
    "os_version" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_agent_configs" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_title" TEXT,
    "persona_description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "dos_rules" TEXT,
    "donts_rules" TEXT,
    "welcome_message" TEXT,
    "avatar_image_url" TEXT,
    "pedagogical_role" TEXT,
    "personality" TEXT,
    "personality_prompt" TEXT,
    "response_style" TEXT,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "suggested_questions" TEXT,
    "knowledge_context" TEXT,
    "selected_prompt_blocks" TEXT,
    "reflection_responses" TEXT,
    "total_design_time" INTEGER,
    "test_conversation_count" INTEGER,
    "iteration_count" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_draft" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "student_agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configuration_logs" (
    "id" SERIAL NOT NULL,
    "agent_config_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_fullname" TEXT,
    "user_email" TEXT,
    "assignment_id" INTEGER NOT NULL,
    "assignment_title" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "change_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previous_config_snapshot" TEXT,
    "new_config_snapshot" TEXT NOT NULL,
    "changed_fields" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "session_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_configuration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_test_conversations" (
    "id" SERIAL NOT NULL,
    "agent_config_id" INTEGER NOT NULL,
    "tester_id" INTEGER NOT NULL,
    "tester_role" TEXT NOT NULL,
    "tester_fullname" TEXT,
    "tester_email" TEXT,
    "config_version" INTEGER NOT NULL,
    "config_snapshot" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "agent_test_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_test_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "message_index" INTEGER NOT NULL,
    "ai_model" TEXT,
    "ai_provider" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "response_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_test_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_test_interaction_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "user_fullname" TEXT,
    "user_email" TEXT,
    "user_role" TEXT,
    "session_id" TEXT,
    "agent_config_id" INTEGER NOT NULL,
    "agent_name" TEXT,
    "agent_title" TEXT,
    "agent_version" INTEGER,
    "assignment_id" INTEGER NOT NULL,
    "assignment_title" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "conversation_id" INTEGER,
    "conversation_message_count" INTEGER,
    "message_index" INTEGER,
    "event_type" TEXT NOT NULL,
    "event_sequence" INTEGER,
    "agent_config_snapshot" TEXT,
    "message_content" TEXT,
    "message_char_count" INTEGER,
    "message_word_count" INTEGER,
    "response_content" TEXT,
    "response_char_count" INTEGER,
    "response_word_count" INTEGER,
    "response_time" DOUBLE PRECISION,
    "ai_model" TEXT,
    "ai_provider" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "error_message" TEXT,
    "error_code" TEXT,
    "error_stack" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "browser_name" TEXT,
    "browser_version" TEXT,
    "os_name" TEXT,
    "os_version" TEXT,
    "device_type" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "language" TEXT,
    "timezone" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp_ms" BIGINT,
    "session_start_time" TIMESTAMP(3),
    "session_duration" INTEGER,
    "metadata" TEXT,

    CONSTRAINT "agent_test_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_grade_logs" (
    "id" SERIAL NOT NULL,
    "agent_config_id" INTEGER NOT NULL,
    "grader_id" INTEGER NOT NULL,
    "grader_fullname" TEXT,
    "grader_email" TEXT,
    "student_id" INTEGER NOT NULL,
    "student_fullname" TEXT,
    "student_email" TEXT,
    "assignment_id" INTEGER NOT NULL,
    "assignment_title" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "max_points" INTEGER,
    "previous_grade" DOUBLE PRECISION,
    "new_grade" DOUBLE PRECISION NOT NULL,
    "previous_feedback" TEXT,
    "new_feedback" TEXT,
    "config_version" INTEGER NOT NULL,
    "config_snapshot" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "session_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_grade_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT,
    "assigned_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_enrollment_jobs" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_log" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "batch_enrollment_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_enrollment_results" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "row_number" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "user_id" INTEGER,
    "enrollment_id" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_enrollment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "admin_email" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "previous_values" TEXT,
    "new_values" TEXT,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_activity_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_email" TEXT,
    "user_fullname" TEXT,
    "user_role" TEXT,
    "session_id" TEXT,
    "verb" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" INTEGER,
    "object_title" TEXT,
    "object_subtype" TEXT,
    "course_id" INTEGER,
    "course_title" TEXT,
    "course_slug" TEXT,
    "module_id" INTEGER,
    "module_title" TEXT,
    "module_order" INTEGER,
    "lecture_id" INTEGER,
    "lecture_title" TEXT,
    "lecture_order" INTEGER,
    "section_id" INTEGER,
    "section_title" TEXT,
    "section_order" INTEGER,
    "success" BOOLEAN DEFAULT true,
    "score" DOUBLE PRECISION,
    "max_score" DOUBLE PRECISION,
    "progress" DOUBLE PRECISION,
    "duration" INTEGER,
    "extensions" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_type" TEXT,
    "browser_name" TEXT,

    CONSTRAINT "learning_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_design_event_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "agent_config_id" INTEGER,
    "session_id" TEXT NOT NULL,
    "design_session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_category" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER,
    "field_name" TEXT,
    "previous_value" TEXT,
    "new_value" TEXT,
    "change_type" TEXT,
    "character_count" INTEGER,
    "word_count" INTEGER,
    "time_on_tab" INTEGER,
    "total_design_time" INTEGER,
    "active_tab" TEXT,
    "used_template" BOOLEAN NOT NULL DEFAULT false,
    "template_name" TEXT,
    "used_suggestion" BOOLEAN NOT NULL DEFAULT false,
    "suggestion_source" TEXT,
    "role_selected" TEXT,
    "personality_selected" TEXT,
    "prompt_block_id" TEXT,
    "prompt_block_category" TEXT,
    "selected_block_ids" TEXT,
    "reflection_prompt_id" TEXT,
    "reflection_prompt_text" TEXT,
    "reflection_response" TEXT,
    "reflection_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "test_conversation_id" INTEGER,
    "test_message_count" INTEGER,
    "ip_address" TEXT,
    "device_type" TEXT,
    "browser_name" TEXT,
    "user_agent" TEXT,
    "agent_config_snapshot" TEXT,

    CONSTRAINT "agent_design_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_blocks" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "description" TEXT,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_block_categories" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_block_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "active_agent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_conversations" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "chatbot_id" INTEGER NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ai_model" TEXT,
    "ai_provider" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "response_time_ms" INTEGER,
    "temperature" DOUBLE PRECISION,
    "routing_reason" TEXT,
    "routing_confidence" DOUBLE PRECISION,
    "synthesized_from" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_interaction_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "session_id" INTEGER,
    "conversation_id" INTEGER,
    "message_id" INTEGER,
    "chatbot_id" INTEGER,
    "chatbot_name" TEXT,
    "chatbot_display_name" TEXT,
    "event_type" TEXT NOT NULL,
    "user_message" TEXT,
    "assistant_message" TEXT,
    "message_char_count" INTEGER,
    "response_char_count" INTEGER,
    "mode" TEXT,
    "ai_model" TEXT,
    "ai_provider" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "response_time_ms" INTEGER,
    "routing_reason" TEXT,
    "routing_confidence" DOUBLE PRECISION,
    "routing_alternatives" TEXT,
    "agent_contributions" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "error_stack" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_surveys" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "survey_id" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" SERIAL NOT NULL,
    "survey_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "options" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" SERIAL NOT NULL,
    "survey_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "module_id" INTEGER,
    "context" TEXT NOT NULL DEFAULT 'standalone',
    "context_id" INTEGER,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" SERIAL NOT NULL,
    "response_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer_value" TEXT NOT NULL,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotional_pulses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "emotion" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'chatbot',
    "context_id" INTEGER,
    "agent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotional_pulses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_tutors" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "chatbot_id" INTEGER NOT NULL,
    "custom_name" TEXT,
    "custom_description" TEXT,
    "custom_system_prompt" TEXT,
    "custom_welcome_message" TEXT,
    "custom_personality" TEXT,
    "custom_temperature" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_tutors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_tutor_conversations" (
    "id" SERIAL NOT NULL,
    "course_tutor_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_tutor_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_tutor_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_tutor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_labs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lab_type" TEXT NOT NULL,
    "config" TEXT,
    "created_by" INTEGER NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_templates" (
    "id" SERIAL NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lab_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_assignments" (
    "id" SERIAL NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_id" INTEGER,

    CONSTRAINT "lab_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "time_limit" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "passing_score" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "show_results" TEXT NOT NULL DEFAULT 'after_submit',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    "available_from" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "question_type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" TEXT,
    "correct_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "points_earned" DOUBLE PRECISION,
    "points_total" DOUBLE PRECISION,
    "time_taken" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "ip_address" TEXT,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" SERIAL NOT NULL,
    "attempt_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT,
    "is_correct" BOOLEAN,
    "points_awarded" DOUBLE PRECISION,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forums" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "allow_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_threads" (
    "id" SERIAL NOT NULL,
    "forum_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_posts" (
    "id" SERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_agent_id" INTEGER,
    "ai_agent_name" TEXT,
    "ai_requested_by" INTEGER,

    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_html" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "creator_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "verification_code" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" TIMESTAMP(3),
    "metadata" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "data" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "email_enrollment" BOOLEAN NOT NULL DEFAULT true,
    "email_assignment_due" BOOLEAN NOT NULL DEFAULT true,
    "email_grade_posted" BOOLEAN NOT NULL DEFAULT true,
    "email_announcement" BOOLEAN NOT NULL DEFAULT true,
    "email_forum_reply" BOOLEAN NOT NULL DEFAULT true,
    "email_certificate" BOOLEAN NOT NULL DEFAULT true,
    "email_digest_frequency" TEXT NOT NULL DEFAULT 'daily',
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_grade_posted" BOOLEAN NOT NULL DEFAULT true,
    "in_app_deadline" BOOLEAN NOT NULL DEFAULT true,
    "in_app_announcement" BOOLEAN NOT NULL DEFAULT true,
    "in_app_forum_reply" BOOLEAN NOT NULL DEFAULT true,
    "in_app_certificate" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "prerequisite_course_id" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "min_progress" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "course_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" SERIAL NOT NULL,
    "rubric_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_points" DOUBLE PRECISION NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "levels" TEXT NOT NULL,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_setting_key_key" ON "user_settings"("user_id", "setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "system_settings"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "api_configurations_service_name_key" ON "api_configurations"("service_name");

-- CreateIndex
CREATE UNIQUE INDEX "llm_providers_name_key" ON "llm_providers"("name");

-- CreateIndex
CREATE INDEX "llm_providers_is_enabled_is_default_idx" ON "llm_providers"("is_enabled", "is_default");

-- CreateIndex
CREATE INDEX "llm_providers_provider_type_idx" ON "llm_providers"("provider_type");

-- CreateIndex
CREATE INDEX "llm_providers_provider_idx" ON "llm_providers"("provider");

-- CreateIndex
CREATE INDEX "llm_models_provider_id_idx" ON "llm_models"("provider_id");

-- CreateIndex
CREATE INDEX "llm_models_is_enabled_is_default_idx" ON "llm_models"("is_enabled", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "llm_models_provider_id_model_id_key" ON "llm_models"("provider_id", "model_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_settings_setting_key_key" ON "llm_settings"("setting_key");

-- CreateIndex
CREATE INDEX "chat_logs_user_id_idx" ON "chat_logs"("user_id");

-- CreateIndex
CREATE INDEX "chat_logs_timestamp_idx" ON "chat_logs"("timestamp");

-- CreateIndex
CREATE INDEX "chat_logs_module_idx" ON "chat_logs"("module");

-- CreateIndex
CREATE INDEX "user_interactions_user_id_idx" ON "user_interactions"("user_id");

-- CreateIndex
CREATE INDEX "user_interactions_timestamp_idx" ON "user_interactions"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "chatbots_name_key" ON "chatbots"("name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_instructor_id_idx" ON "courses"("instructor_id");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_title_key" ON "categories"("title");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_course_id_category_id_key" ON "course_categories"("course_id", "category_id");

-- CreateIndex
CREATE INDEX "course_modules_course_id_idx" ON "course_modules"("course_id");

-- CreateIndex
CREATE INDEX "lectures_module_id_idx" ON "lectures"("module_id");

-- CreateIndex
CREATE INDEX "lecture_sections_lecture_id_idx" ON "lecture_sections"("lecture_id");

-- CreateIndex
CREATE INDEX "lecture_sections_assignment_id_idx" ON "lecture_sections"("assignment_id");

-- CreateIndex
CREATE INDEX "lecture_explain_threads_lecture_id_idx" ON "lecture_explain_threads"("lecture_id");

-- CreateIndex
CREATE INDEX "lecture_explain_threads_user_id_idx" ON "lecture_explain_threads"("user_id");

-- CreateIndex
CREATE INDEX "lecture_explain_posts_thread_id_idx" ON "lecture_explain_posts"("thread_id");

-- CreateIndex
CREATE INDEX "lecture_explain_posts_parent_id_idx" ON "lecture_explain_posts"("parent_id");

-- CreateIndex
CREATE INDEX "code_labs_module_id_idx" ON "code_labs"("module_id");

-- CreateIndex
CREATE INDEX "code_blocks_code_lab_id_idx" ON "code_blocks"("code_lab_id");

-- CreateIndex
CREATE INDEX "enrollments_user_id_idx" ON "enrollments"("user_id");

-- CreateIndex
CREATE INDEX "enrollments_course_id_idx" ON "enrollments"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_course_id_key" ON "enrollments"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_progress_enrollment_id_lecture_id_key" ON "lecture_progress"("enrollment_id", "lecture_id");

-- CreateIndex
CREATE INDEX "assignments_course_id_idx" ON "assignments"("course_id");

-- CreateIndex
CREATE INDEX "assignments_post_survey_id_idx" ON "assignments"("post_survey_id");

-- CreateIndex
CREATE INDEX "assignments_lecture_id_idx" ON "assignments"("lecture_id");

-- CreateIndex
CREATE INDEX "assignments_module_id_idx" ON "assignments"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_agent_config_id_key" ON "assignment_submissions"("agent_config_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_assignment_id_idx" ON "assignment_submissions"("assignment_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_user_id_idx" ON "assignment_submissions"("user_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_graded_by_idx" ON "assignment_submissions"("graded_by");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignment_id_user_id_key" ON "assignment_submissions"("assignment_id", "user_id");

-- CreateIndex
CREATE INDEX "course_announcements_course_id_idx" ON "course_announcements"("course_id");

-- CreateIndex
CREATE INDEX "chatbot_conversations_section_id_idx" ON "chatbot_conversations"("section_id");

-- CreateIndex
CREATE INDEX "chatbot_conversations_user_id_idx" ON "chatbot_conversations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_conversations_section_id_user_id_key" ON "chatbot_conversations"("section_id", "user_id");

-- CreateIndex
CREATE INDEX "chatbot_conversation_messages_conversation_id_idx" ON "chatbot_conversation_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_user_id_idx" ON "chatbot_interaction_logs"("user_id");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_section_id_idx" ON "chatbot_interaction_logs"("section_id");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_session_id_idx" ON "chatbot_interaction_logs"("session_id");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_timestamp_idx" ON "chatbot_interaction_logs"("timestamp");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_event_type_idx" ON "chatbot_interaction_logs"("event_type");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_course_id_idx" ON "chatbot_interaction_logs"("course_id");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_lecture_id_idx" ON "chatbot_interaction_logs"("lecture_id");

-- CreateIndex
CREATE INDEX "chatbot_interaction_logs_test_mode_idx" ON "chatbot_interaction_logs"("test_mode");

-- CreateIndex
CREATE INDEX "user_interaction_logs_user_id_idx" ON "user_interaction_logs"("user_id");

-- CreateIndex
CREATE INDEX "user_interaction_logs_session_id_idx" ON "user_interaction_logs"("session_id");

-- CreateIndex
CREATE INDEX "user_interaction_logs_timestamp_idx" ON "user_interaction_logs"("timestamp");

-- CreateIndex
CREATE INDEX "user_interaction_logs_event_type_idx" ON "user_interaction_logs"("event_type");

-- CreateIndex
CREATE INDEX "user_interaction_logs_page_path_idx" ON "user_interaction_logs"("page_path");

-- CreateIndex
CREATE INDEX "user_interaction_logs_course_id_idx" ON "user_interaction_logs"("course_id");

-- CreateIndex
CREATE INDEX "user_interaction_logs_test_mode_idx" ON "user_interaction_logs"("test_mode");

-- CreateIndex
CREATE INDEX "content_event_logs_user_id_course_id_lecture_id_event_type__idx" ON "content_event_logs"("user_id", "course_id", "lecture_id", "event_type", "timestamp");

-- CreateIndex
CREATE INDEX "assessment_event_logs_user_id_course_id_assignment_id_event_idx" ON "assessment_event_logs"("user_id", "course_id", "assignment_id", "event_type", "timestamp");

-- CreateIndex
CREATE INDEX "system_event_logs_actor_id_event_type_event_category_target_idx" ON "system_event_logs"("actor_id", "event_type", "event_category", "target_type", "course_id", "timestamp");

-- CreateIndex
CREATE INDEX "auth_event_logs_user_id_user_email_event_type_timestamp_ip__idx" ON "auth_event_logs"("user_id", "user_email", "event_type", "timestamp", "ip_address");

-- CreateIndex
CREATE INDEX "student_agent_configs_assignment_id_idx" ON "student_agent_configs"("assignment_id");

-- CreateIndex
CREATE INDEX "student_agent_configs_user_id_idx" ON "student_agent_configs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_agent_configs_assignment_id_user_id_key" ON "student_agent_configs"("assignment_id", "user_id");

-- CreateIndex
CREATE INDEX "agent_configuration_logs_agent_config_id_idx" ON "agent_configuration_logs"("agent_config_id");

-- CreateIndex
CREATE INDEX "agent_configuration_logs_user_id_idx" ON "agent_configuration_logs"("user_id");

-- CreateIndex
CREATE INDEX "agent_configuration_logs_assignment_id_idx" ON "agent_configuration_logs"("assignment_id");

-- CreateIndex
CREATE INDEX "agent_configuration_logs_timestamp_idx" ON "agent_configuration_logs"("timestamp");

-- CreateIndex
CREATE INDEX "agent_configuration_logs_change_type_idx" ON "agent_configuration_logs"("change_type");

-- CreateIndex
CREATE INDEX "agent_test_conversations_agent_config_id_idx" ON "agent_test_conversations"("agent_config_id");

-- CreateIndex
CREATE INDEX "agent_test_conversations_tester_id_idx" ON "agent_test_conversations"("tester_id");

-- CreateIndex
CREATE INDEX "agent_test_conversations_started_at_idx" ON "agent_test_conversations"("started_at");

-- CreateIndex
CREATE INDEX "agent_test_messages_conversation_id_idx" ON "agent_test_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "agent_test_messages_message_index_idx" ON "agent_test_messages"("message_index");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_user_id_idx" ON "agent_test_interaction_logs"("user_id");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_agent_config_id_idx" ON "agent_test_interaction_logs"("agent_config_id");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_assignment_id_idx" ON "agent_test_interaction_logs"("assignment_id");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_conversation_id_idx" ON "agent_test_interaction_logs"("conversation_id");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_session_id_idx" ON "agent_test_interaction_logs"("session_id");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_timestamp_idx" ON "agent_test_interaction_logs"("timestamp");

-- CreateIndex
CREATE INDEX "agent_test_interaction_logs_event_type_idx" ON "agent_test_interaction_logs"("event_type");

-- CreateIndex
CREATE INDEX "agent_grade_logs_agent_config_id_idx" ON "agent_grade_logs"("agent_config_id");

-- CreateIndex
CREATE INDEX "agent_grade_logs_grader_id_idx" ON "agent_grade_logs"("grader_id");

-- CreateIndex
CREATE INDEX "agent_grade_logs_student_id_idx" ON "agent_grade_logs"("student_id");

-- CreateIndex
CREATE INDEX "agent_grade_logs_assignment_id_idx" ON "agent_grade_logs"("assignment_id");

-- CreateIndex
CREATE INDEX "agent_grade_logs_timestamp_idx" ON "agent_grade_logs"("timestamp");

-- CreateIndex
CREATE INDEX "course_roles_course_id_idx" ON "course_roles"("course_id");

-- CreateIndex
CREATE INDEX "course_roles_user_id_idx" ON "course_roles"("user_id");

-- CreateIndex
CREATE INDEX "course_roles_assigned_by_idx" ON "course_roles"("assigned_by");

-- CreateIndex
CREATE UNIQUE INDEX "course_roles_user_id_course_id_key" ON "course_roles"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "batch_enrollment_jobs_course_id_idx" ON "batch_enrollment_jobs"("course_id");

-- CreateIndex
CREATE INDEX "batch_enrollment_jobs_created_by_idx" ON "batch_enrollment_jobs"("created_by");

-- CreateIndex
CREATE INDEX "batch_enrollment_jobs_status_idx" ON "batch_enrollment_jobs"("status");

-- CreateIndex
CREATE INDEX "batch_enrollment_results_job_id_idx" ON "batch_enrollment_results"("job_id");

-- CreateIndex
CREATE INDEX "batch_enrollment_results_email_idx" ON "batch_enrollment_results"("email");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_idx" ON "admin_audit_logs"("target_type");

-- CreateIndex
CREATE INDEX "admin_audit_logs_timestamp_idx" ON "admin_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "learning_activity_logs_user_id_idx" ON "learning_activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "learning_activity_logs_course_id_idx" ON "learning_activity_logs"("course_id");

-- CreateIndex
CREATE INDEX "learning_activity_logs_verb_idx" ON "learning_activity_logs"("verb");

-- CreateIndex
CREATE INDEX "learning_activity_logs_object_type_idx" ON "learning_activity_logs"("object_type");

-- CreateIndex
CREATE INDEX "learning_activity_logs_timestamp_idx" ON "learning_activity_logs"("timestamp");

-- CreateIndex
CREATE INDEX "learning_activity_logs_user_id_course_id_timestamp_idx" ON "learning_activity_logs"("user_id", "course_id", "timestamp");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_user_id_idx" ON "agent_design_event_logs"("user_id");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_assignment_id_idx" ON "agent_design_event_logs"("assignment_id");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_agent_config_id_idx" ON "agent_design_event_logs"("agent_config_id");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_session_id_idx" ON "agent_design_event_logs"("session_id");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_design_session_id_idx" ON "agent_design_event_logs"("design_session_id");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_event_type_idx" ON "agent_design_event_logs"("event_type");

-- CreateIndex
CREATE INDEX "agent_design_event_logs_timestamp_idx" ON "agent_design_event_logs"("timestamp");

-- CreateIndex
CREATE INDEX "prompt_blocks_category_idx" ON "prompt_blocks"("category");

-- CreateIndex
CREATE INDEX "prompt_blocks_is_active_idx" ON "prompt_blocks"("is_active");

-- CreateIndex
CREATE INDEX "prompt_blocks_order_index_idx" ON "prompt_blocks"("order_index");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_block_categories_slug_key" ON "prompt_block_categories"("slug");

-- CreateIndex
CREATE INDEX "prompt_block_categories_is_active_idx" ON "prompt_block_categories"("is_active");

-- CreateIndex
CREATE INDEX "prompt_block_categories_order_index_idx" ON "prompt_block_categories"("order_index");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_sessions_user_id_course_id_key" ON "tutor_sessions"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "tutor_conversations_session_id_idx" ON "tutor_conversations"("session_id");

-- CreateIndex
CREATE INDEX "tutor_conversations_chatbot_id_idx" ON "tutor_conversations"("chatbot_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_conversations_session_id_chatbot_id_key" ON "tutor_conversations"("session_id", "chatbot_id");

-- CreateIndex
CREATE INDEX "tutor_messages_conversation_id_idx" ON "tutor_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "tutor_messages_created_at_idx" ON "tutor_messages"("created_at");

-- CreateIndex
CREATE INDEX "tutor_interaction_logs_user_id_idx" ON "tutor_interaction_logs"("user_id");

-- CreateIndex
CREATE INDEX "tutor_interaction_logs_session_id_idx" ON "tutor_interaction_logs"("session_id");

-- CreateIndex
CREATE INDEX "tutor_interaction_logs_chatbot_id_idx" ON "tutor_interaction_logs"("chatbot_id");

-- CreateIndex
CREATE INDEX "tutor_interaction_logs_event_type_idx" ON "tutor_interaction_logs"("event_type");

-- CreateIndex
CREATE INDEX "tutor_interaction_logs_timestamp_idx" ON "tutor_interaction_logs"("timestamp");

-- CreateIndex
CREATE INDEX "surveys_created_by_id_idx" ON "surveys"("created_by_id");

-- CreateIndex
CREATE INDEX "module_surveys_course_id_idx" ON "module_surveys"("course_id");

-- CreateIndex
CREATE INDEX "module_surveys_module_id_idx" ON "module_surveys"("module_id");

-- CreateIndex
CREATE INDEX "module_surveys_survey_id_idx" ON "module_surveys"("survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_surveys_module_id_survey_id_key" ON "module_surveys"("module_id", "survey_id");

-- CreateIndex
CREATE INDEX "survey_questions_survey_id_idx" ON "survey_questions"("survey_id");

-- CreateIndex
CREATE INDEX "survey_responses_survey_id_idx" ON "survey_responses"("survey_id");

-- CreateIndex
CREATE INDEX "survey_responses_user_id_idx" ON "survey_responses"("user_id");

-- CreateIndex
CREATE INDEX "survey_responses_module_id_idx" ON "survey_responses"("module_id");

-- CreateIndex
CREATE INDEX "survey_answers_response_id_idx" ON "survey_answers"("response_id");

-- CreateIndex
CREATE INDEX "survey_answers_question_id_idx" ON "survey_answers"("question_id");

-- CreateIndex
CREATE INDEX "emotional_pulses_user_id_created_at_idx" ON "emotional_pulses"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "emotional_pulses_context_context_id_idx" ON "emotional_pulses"("context", "context_id");

-- CreateIndex
CREATE INDEX "emotional_pulses_created_at_idx" ON "emotional_pulses"("created_at");

-- CreateIndex
CREATE INDEX "course_tutors_course_id_idx" ON "course_tutors"("course_id");

-- CreateIndex
CREATE INDEX "course_tutors_chatbot_id_idx" ON "course_tutors"("chatbot_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_tutors_course_id_chatbot_id_key" ON "course_tutors"("course_id", "chatbot_id");

-- CreateIndex
CREATE INDEX "course_tutor_conversations_course_tutor_id_idx" ON "course_tutor_conversations"("course_tutor_id");

-- CreateIndex
CREATE INDEX "course_tutor_conversations_user_id_idx" ON "course_tutor_conversations"("user_id");

-- CreateIndex
CREATE INDEX "course_tutor_messages_conversation_id_idx" ON "course_tutor_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "custom_labs_created_by_idx" ON "custom_labs"("created_by");

-- CreateIndex
CREATE INDEX "custom_labs_lab_type_idx" ON "custom_labs"("lab_type");

-- CreateIndex
CREATE INDEX "custom_labs_is_public_idx" ON "custom_labs"("is_public");

-- CreateIndex
CREATE INDEX "lab_templates_lab_id_idx" ON "lab_templates"("lab_id");

-- CreateIndex
CREATE INDEX "lab_assignments_lab_id_idx" ON "lab_assignments"("lab_id");

-- CreateIndex
CREATE INDEX "lab_assignments_course_id_idx" ON "lab_assignments"("course_id");

-- CreateIndex
CREATE INDEX "lab_assignments_module_id_idx" ON "lab_assignments"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_assignments_lab_id_course_id_key" ON "lab_assignments"("lab_id", "course_id");

-- CreateIndex
CREATE INDEX "quizzes_course_id_idx" ON "quizzes"("course_id");

-- CreateIndex
CREATE INDEX "quizzes_module_id_idx" ON "quizzes"("module_id");

-- CreateIndex
CREATE INDEX "quizzes_is_published_idx" ON "quizzes"("is_published");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts"("user_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_status_idx" ON "quiz_attempts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_quiz_id_user_id_attempt_number_key" ON "quiz_attempts"("quiz_id", "user_id", "attempt_number");

-- CreateIndex
CREATE INDEX "quiz_answers_attempt_id_idx" ON "quiz_answers"("attempt_id");

-- CreateIndex
CREATE INDEX "quiz_answers_question_id_idx" ON "quiz_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answers_attempt_id_question_id_key" ON "quiz_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "forums_course_id_idx" ON "forums"("course_id");

-- CreateIndex
CREATE INDEX "forums_module_id_idx" ON "forums"("module_id");

-- CreateIndex
CREATE INDEX "forum_threads_forum_id_idx" ON "forum_threads"("forum_id");

-- CreateIndex
CREATE INDEX "forum_threads_author_id_idx" ON "forum_threads"("author_id");

-- CreateIndex
CREATE INDEX "forum_threads_is_pinned_idx" ON "forum_threads"("is_pinned");

-- CreateIndex
CREATE INDEX "forum_posts_thread_id_idx" ON "forum_posts"("thread_id");

-- CreateIndex
CREATE INDEX "forum_posts_author_id_idx" ON "forum_posts"("author_id");

-- CreateIndex
CREATE INDEX "forum_posts_parent_id_idx" ON "forum_posts"("parent_id");

-- CreateIndex
CREATE INDEX "forum_posts_ai_agent_id_idx" ON "forum_posts"("ai_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verification_code_key" ON "certificates"("verification_code");

-- CreateIndex
CREATE INDEX "certificates_user_id_idx" ON "certificates"("user_id");

-- CreateIndex
CREATE INDEX "certificates_course_id_idx" ON "certificates"("course_id");

-- CreateIndex
CREATE INDEX "certificates_verification_code_idx" ON "certificates"("verification_code");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_user_id_course_id_key" ON "certificates"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "course_prerequisites_course_id_idx" ON "course_prerequisites"("course_id");

-- CreateIndex
CREATE INDEX "course_prerequisites_prerequisite_course_id_idx" ON "course_prerequisites"("prerequisite_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_prerequisites_course_id_prerequisite_course_id_key" ON "course_prerequisites"("course_id", "prerequisite_course_id");

-- CreateIndex
CREATE INDEX "rubrics_course_id_idx" ON "rubrics"("course_id");

-- CreateIndex
CREATE INDEX "rubrics_created_by_id_idx" ON "rubrics"("created_by_id");

-- CreateIndex
CREATE INDEX "rubric_criteria_rubric_id_idx" ON "rubric_criteria"("rubric_id");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_models" ADD CONSTRAINT "llm_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "llm_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_submissions" ADD CONSTRAINT "user_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_analysis_logs" ADD CONSTRAINT "data_analysis_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_sections" ADD CONSTRAINT "lecture_sections_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_sections" ADD CONSTRAINT "lecture_sections_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_attachments" ADD CONSTRAINT "lecture_attachments_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_explain_threads" ADD CONSTRAINT "lecture_explain_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_explain_threads" ADD CONSTRAINT "lecture_explain_threads_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_explain_posts" ADD CONSTRAINT "lecture_explain_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "lecture_explain_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_explain_posts" ADD CONSTRAINT "lecture_explain_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "lecture_explain_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_labs" ADD CONSTRAINT "code_labs_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_blocks" ADD CONSTRAINT "code_blocks_code_lab_id_fkey" FOREIGN KEY ("code_lab_id") REFERENCES "code_labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_post_survey_id_fkey" FOREIGN KEY ("post_survey_id") REFERENCES "surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_attachments" ADD CONSTRAINT "assignment_attachments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "student_agent_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_announcements" ADD CONSTRAINT "course_announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_announcements" ADD CONSTRAINT "course_announcements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "lecture_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_conversation_messages" ADD CONSTRAINT "chatbot_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_interaction_logs" ADD CONSTRAINT "chatbot_interaction_logs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "lecture_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_interaction_logs" ADD CONSTRAINT "chatbot_interaction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interaction_logs" ADD CONSTRAINT "user_interaction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_agent_configs" ADD CONSTRAINT "student_agent_configs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configuration_logs" ADD CONSTRAINT "agent_configuration_logs_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "student_agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_test_conversations" ADD CONSTRAINT "agent_test_conversations_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "student_agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_test_messages" ADD CONSTRAINT "agent_test_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_test_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_test_interaction_logs" ADD CONSTRAINT "agent_test_interaction_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_test_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_grade_logs" ADD CONSTRAINT "agent_grade_logs_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "student_agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollment_jobs" ADD CONSTRAINT "batch_enrollment_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollment_jobs" ADD CONSTRAINT "batch_enrollment_jobs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollment_results" ADD CONSTRAINT "batch_enrollment_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "batch_enrollment_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_activity_logs" ADD CONSTRAINT "learning_activity_logs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_activity_logs" ADD CONSTRAINT "learning_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_design_event_logs" ADD CONSTRAINT "agent_design_event_logs_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "student_agent_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_design_event_logs" ADD CONSTRAINT "agent_design_event_logs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_conversations" ADD CONSTRAINT "tutor_conversations_chatbot_id_fkey" FOREIGN KEY ("chatbot_id") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_conversations" ADD CONSTRAINT "tutor_conversations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tutor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_messages" ADD CONSTRAINT "tutor_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "tutor_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_surveys" ADD CONSTRAINT "module_surveys_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_surveys" ADD CONSTRAINT "module_surveys_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_surveys" ADD CONSTRAINT "module_surveys_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotional_pulses" ADD CONSTRAINT "emotional_pulses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_tutors" ADD CONSTRAINT "course_tutors_chatbot_id_fkey" FOREIGN KEY ("chatbot_id") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_tutors" ADD CONSTRAINT "course_tutors_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_tutor_conversations" ADD CONSTRAINT "course_tutor_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_tutor_conversations" ADD CONSTRAINT "course_tutor_conversations_course_tutor_id_fkey" FOREIGN KEY ("course_tutor_id") REFERENCES "course_tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_tutor_messages" ADD CONSTRAINT "course_tutor_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "course_tutor_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_labs" ADD CONSTRAINT "custom_labs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_templates" ADD CONSTRAINT "lab_templates_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "custom_labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "custom_labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forums" ADD CONSTRAINT "forums_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forums" ADD CONSTRAINT "forums_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_forum_id_fkey" FOREIGN KEY ("forum_id") REFERENCES "forums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_ai_requested_by_fkey" FOREIGN KEY ("ai_requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_ai_agent_id_fkey" FOREIGN KEY ("ai_agent_id") REFERENCES "chatbots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

