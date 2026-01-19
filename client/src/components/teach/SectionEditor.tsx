import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, FileText, Upload, Sparkles, Edit3, Check, X, MessageCircle, ClipboardList } from 'lucide-react';
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
}

const SECTION_TYPE_INFO: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  text: {
    label: 'Text',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  file: {
    label: 'File',
    icon: Upload,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  'ai-generated': {
    label: 'AI Generated',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  chatbot: {
    label: 'Chatbot',
    icon: MessageCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  assignment: {
    label: 'Assignment',
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
}: SectionEditorProps) => {
  const typeInfo = SECTION_TYPE_INFO[section.type] || SECTION_TYPE_INFO.text;
  const TypeIcon = typeInfo.icon;

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
        return <div className="text-gray-500">Unknown section type</div>;
    }
  };

  // Display title - either the custom title or a default based on type
  const displayTitle = section.title || `${typeInfo.label} Section`;

  if (readOnly) {
    return (
      <div className={`rounded-lg border ${typeInfo.borderColor} overflow-hidden`}>
        <div className={`px-4 py-2 ${typeInfo.bgColor} border-b ${typeInfo.borderColor}`}>
          <div className={`flex items-center gap-2 text-sm ${typeInfo.color}`}>
            <TypeIcon className="w-4 h-4" />
            <span className="font-medium">{displayTitle}</span>
          </div>
        </div>
        <div className="p-4 bg-white">{renderSectionContent()}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${typeInfo.borderColor} overflow-hidden`}>
      {/* Section Header */}
      <div className={`flex items-center justify-between px-4 py-2 ${typeInfo.bgColor} border-b ${typeInfo.borderColor}`}>
        <div className={`flex items-center gap-2 text-sm ${typeInfo.color} flex-1 min-w-0`}>
          <TypeIcon className="w-4 h-4 flex-shrink-0" />

          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                placeholder={`${typeInfo.label} Section`}
                className="flex-1 min-w-0 px-2 py-0.5 text-sm font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                autoFocus
              />
              <button
                onClick={handleTitleSave}
                className="p-1 rounded hover:bg-white/50 transition-colors text-green-600"
                title="Save title"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleTitleCancel}
                className="p-1 rounded hover:bg-white/50 transition-colors text-gray-500"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{displayTitle}</span>
              <span className="text-gray-400 font-normal flex-shrink-0">#{index + 1}</span>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="p-1 rounded hover:bg-white/50 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="Edit title"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* Reorder buttons */}
          <button
            onClick={() => onMoveUp(section.id)}
            disabled={index === 0}
            className="p-1.5 rounded hover:bg-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onMoveDown(section.id)}
            disabled={index === totalSections - 1}
            className="p-1.5 rounded hover:bg-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(section.id)}
            className="p-1.5 rounded hover:bg-red-100 transition-colors ml-2"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="p-4 bg-white">{renderSectionContent()}</div>
    </div>
  );
};

// Add Section Toolbar Component
interface AddSectionToolbarProps {
  onAddSection: (type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment') => void;
}

export const AddSectionToolbar = ({ onAddSection }: AddSectionToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      <span className="text-sm text-gray-500 mr-2">Add section:</span>
      <button
        onClick={() => onAddSection('text')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
      >
        <FileText className="w-4 h-4" />
        Text
      </button>
      <button
        onClick={() => onAddSection('file')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4" />
        File
      </button>
      <button
        onClick={() => onAddSection('ai-generated')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        AI
      </button>
      <button
        onClick={() => onAddSection('chatbot')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        Chatbot
      </button>
      <button
        onClick={() => onAddSection('assignment')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
      >
        <ClipboardList className="w-4 h-4" />
        Assignment
      </button>
    </div>
  );
};
