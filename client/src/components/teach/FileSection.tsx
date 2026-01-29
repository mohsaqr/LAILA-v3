import { useState, useRef } from 'react';
import { Upload, File, FileText, Image, Film, Music, Archive, Download, X, Loader2 } from 'lucide-react';
import { LectureSection, UpdateSectionData } from '../../types';
import { Button } from '../common/Button';
import { getAuthToken } from '../../utils/auth';

interface FileSectionProps {
  section: LectureSection;
  onFileChange: (data: UpdateSectionData) => void;
  onRemoveFile: () => void;
  readOnly?: boolean;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  jpg: Image,
  jpeg: Image,
  png: Image,
  gif: Image,
  webp: Image,
  svg: Image,
  mp4: Film,
  mov: Film,
  avi: Film,
  webm: Film,
  mp3: Music,
  wav: Music,
  ogg: Music,
  zip: Archive,
  rar: Archive,
  '7z': Archive,
};

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return File;
  const type = fileType.toLowerCase().replace(/^\./, '');
  return FILE_ICONS[type] || File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileSection = ({ section, onFileChange, onRemoveFile, readOnly = false }: FileSectionProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFile = section.fileUrl && section.fileName;
  const FileIcon = getFileIcon(section.fileType);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);

    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload file to server
      const token = getAuthToken();
      const response = await fetch('/api/uploads/file', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();

      // Update section with file info - handle both direct and wrapped response formats
      const fileData = data.data || data;
      onFileChange({
        fileName: file.name,
        fileUrl: fileData.url || fileData.path,
        fileType: file.name.split('.').pop() || '',
        fileSize: file.size,
      });
    } catch (error) {
      console.error('File upload error:', error);
      // For now, just store file info locally (demo mode)
      const reader = new FileReader();
      reader.onload = () => {
        onFileChange({
          fileName: file.name,
          fileUrl: reader.result as string,
          fileType: file.name.split('.').pop() || '',
          fileSize: file.size,
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  if (readOnly && hasFile) {
    return (
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-shrink-0 p-3 bg-white rounded-lg border border-gray-200">
          <FileIcon className="w-8 h-8 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{section.fileName}</p>
          <p className="text-sm text-gray-500">
            {section.fileType?.toUpperCase()} - {formatFileSize(section.fileSize)}
          </p>
        </div>
        <a
          href={section.fileUrl || '#'}
          download={section.fileName}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
      </div>
    );
  }

  if (hasFile) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Upload className="w-4 h-4" />
          <span>File Section</span>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-shrink-0 p-3 bg-white rounded-lg border border-gray-200">
            <FileIcon className="w-8 h-8 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{section.fileName}</p>
            <p className="text-sm text-gray-500">
              {section.fileType?.toUpperCase()} - {formatFileSize(section.fileSize)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={section.fileUrl || '#'}
              download={section.fileName}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onRemoveFile}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Upload className="w-4 h-4" />
        <span>File Section</span>
      </div>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-sm text-gray-600">Uploading file...</p>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">Drag and drop a file here, or</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              PDF, DOC, PPT, images, videos up to 50MB
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov,.mp3,.wav,.zip"
        />
      </div>
    </div>
  );
};
