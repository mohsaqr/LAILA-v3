import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, ChevronRight, Trash2, FileText, Upload, Sparkles, Edit3, Check, X, MessageCircle, ClipboardList } from 'lucide-react';
import { LectureSection, UpdateSectionData } from '../../types';
import { TextSection } from './TextSection';
import { FileSection } from './FileSection';
import { AISection } from './AISection';
import { ChatbotSection } from './ChatbotSection';
import { AssignmentSectionEditor } from './AssignmentSectionEditor';

interface SectionEditorProps {
  section: LectureSection;
  index: number;
  totalSections: number;
  onUpdate: (sectionId: number, data: UpdateSectionData) => void;
  onDelete: (sectionId: number) => void;
  onMoveUp: (sectionId: number) => void;
  onMoveDown: (sectionId: number) => void;
  lectureTitle?: string;
  courseTitle?: string;
  courseId?: number;
  readOnly?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (sectionId: number) => void;
}

const SECTION_TYPE_STYLES: Record<string, {
  labelKey: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  text: {
    labelKey: 'section_type_text',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  file: {
    labelKey: 'section_type_file',
    icon: Upload,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  'ai-generated': {
    labelKey: 'section_type_ai_generated',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  chatbot: {
    labelKey: 'section_type_chatbot',
    icon: MessageCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  assignment: {
    labelKey: 'section_type_assignment',
    icon: ClipboardList,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
};

export const SectionEditor = ({
  section,
  index,
  totalSections,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  lectureTitle,
  courseTitle,
  courseId,
  readOnly = false,
  isExpanded = true,
  onToggleExpand,
}: SectionEditorProps) => {
  const { t } = useTranslation(['teaching']);
  const typeStyles = SECTION_TYPE_STYLES[section.type] || SECTION_TYPE_STYLES.text;
  const typeLabel = t(typeStyles.labelKey);
  const TypeIcon = typeStyles.icon;

  // Get a brief preview of content for collapsed state
  const getContentPreview = () => {
    if (section.content) {
      const text = section.content.replace(/[#*`\[\]]/g, '').trim();
      return text.length > 60 ? text.substring(0, 60) + '...' : text;
    }
    if (section.fileName) return `${t('file')}: ${section.fileName}`;
    if (section.type === 'chatbot') return section.chatbotTitle || t('chatbot_configured');
    return t('no_content_yet');
  };

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title || '');

  // Sync titleDraft with section.title when it changes externally
  useEffect(() => {
    setTitleDraft(section.title || '');
  }, [section.title]);

  const handleTitleSave = () => {
    onUpdate(section.id, { title: titleDraft.trim() || undefined });
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTitleDraft(section.title || '');
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleContentChange = (content: string) => {
    onUpdate(section.id, { content });
  };

  const handleFileChange = (data: UpdateSectionData) => {
    onUpdate(section.id, data);
  };

  const handleRemoveFile = () => {
    onUpdate(section.id, {
      fileName: undefined,
      fileUrl: undefined,
      fileType: undefined,
      fileSize: undefined,
    });
  };

  const handleSectionDataChange = (data: UpdateSectionData) => {
    onUpdate(section.id, data);
  };

  const renderSectionContent = () => {
    switch (section.type) {
      case 'text':
        return (
          <TextSection
            section={section}
            onChange={handleContentChange}
            readOnly={readOnly}
          />
        );
      case 'file':
        return (
          <FileSection
            section={section}
            onFileChange={handleFileChange}
            onRemoveFile={handleRemoveFile}
            readOnly={readOnly}
          />
        );
      case 'ai-generated':
        return (
          <AISection
            section={section}
            onChange={handleContentChange}
            lectureTitle={lectureTitle}
            courseTitle={courseTitle}
            readOnly={readOnly}
          />
        );
      case 'chatbot':
        return (
          <ChatbotSection
            section={section}
            onChange={handleSectionDataChange}
            readOnly={readOnly}
          />
        );
      case 'assignment':
        return (
          <AssignmentSectionEditor
            section={section}
            courseId={courseId || 0}
            onChange={handleSectionDataChange}
            readOnly={readOnly}
          />
        );
      default:
        return <div className="text-gray-500">{t('unknown_section_type')}</div>;
    }
  };

  // Display title - either the custom title or a default based on type
  const displayTitle = section.title || t('section_title_default', { type: typeLabel });

  if (readOnly) {
    return (
      <div className={`rounded-lg border ${typeStyles.borderColor} overflow-hidden`}>
        <div className={`px-4 py-2 ${typeStyles.bgColor} border-b ${typeStyles.borderColor}`}>
          <div className={`flex items-center gap-2 text-sm ${typeStyles.color}`}>
            <TypeIcon className="w-4 h-4" />
            <span className="font-medium">{displayTitle}</span>
          </div>
        </div>
        <div className="p-4 bg-white">{renderSectionContent()}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${typeStyles.borderColor} overflow-hidden`}>
      {/* Section Header - Clickable to expand/collapse */}
      <div
        className={`flex items-center justify-between px-4 py-2 ${typeStyles.bgColor} ${isExpanded ? `border-b ${typeStyles.borderColor}` : ''} ${onToggleExpand ? 'cursor-pointer' : ''}`}
        onClick={() => !isEditingTitle && onToggleExpand?.(section.id)}
      >
        <div className={`flex items-center gap-2 text-sm ${typeStyles.color} flex-1 min-w-0`}>
          {/* Expand/Collapse indicator */}
          {onToggleExpand && (
            <ChevronRight
              className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
          <TypeIcon className="w-4 h-4 flex-shrink-0" />

          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                placeholder={`${typeLabel} Section`}
                className="flex-1 min-w-0 px-2 py-0.5 text-sm font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                autoFocus
              />
              <button
                onClick={handleTitleSave}
                className="p-1 rounded hover:bg-white/50 transition-colors text-green-600"
                title={t('save_title')}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleTitleCancel}
                className="p-1 rounded hover:bg-white/50 transition-colors text-gray-500"
                title={t('cancel')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium truncate">{displayTitle}</span>
              <span className="text-gray-400 font-normal flex-shrink-0">#{index + 1}</span>
              {/* Show preview when collapsed */}
              {!isExpanded && (
                <span className="text-gray-400 font-normal text-xs truncate ml-2 hidden sm:inline">
                  — {getContentPreview()}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                className="p-1 rounded hover:bg-white/50 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
                title={t('edit_title')}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {/* Reorder buttons */}
          <button
            onClick={() => onMoveUp(section.id)}
            disabled={index === 0}
            className="p-1.5 rounded hover:bg-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_up')}
          >
            <ChevronUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onMoveDown(section.id)}
            disabled={index === totalSections - 1}
            className="p-1.5 rounded hover:bg-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_down')}
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(section.id)}
            className="p-1.5 rounded hover:bg-red-100 transition-colors ml-2"
            title={t('delete_section')}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Section Content - Only shown when expanded */}
      {isExpanded && (
        <div className="p-4 bg-white">{renderSectionContent()}</div>
      )}
    </div>
  );
};

// Add Section Toolbar Component
interface AddSectionToolbarProps {
  onAddSection: (type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment') => void;
}

export const AddSectionToolbar = ({ onAddSection }: AddSectionToolbarProps) => {
  const { t } = useTranslation(['teaching']);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      <span className="text-sm text-gray-500 mr-2">{t('add_section')}:</span>
      <button
        onClick={() => onAddSection('text')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
      >
        <FileText className="w-4 h-4" />
        {t('section_type_text')}
      </button>
      <button
        onClick={() => onAddSection('file')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4" />
        {t('section_type_file')}
      </button>
      <button
        onClick={() => onAddSection('ai-generated')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        {t('section_type_ai')}
      </button>
      <button
        onClick={() => onAddSection('chatbot')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {t('section_type_chatbot')}
      </button>
      <button
        onClick={() => onAddSection('assignment')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
      >
        <ClipboardList className="w-4 h-4" />
        {t('section_type_assignment')}
      </button>
    </div>
  );
};
