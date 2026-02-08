import { useState, useMemo } from 'react';
import { FileText, Check, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { LecturePDFInfo, PDFPageRanges } from '../../api/lectureAIHelper';

interface PDFPageSelectorProps {
  pdfs: LecturePDFInfo[];
  onContinue: (pageRanges: PDFPageRanges) => void;
}

// Threshold for showing page selector (PDFs with more than this many pages require selection)
const LARGE_PDF_THRESHOLD = 5;

export const PDFPageSelector = ({ pdfs, onContinue }: PDFPageSelectorProps) => {
  const { isDark } = useTheme();

  // Initialize page ranges - small PDFs default to "all", large PDFs need selection
  const [pageRanges, setPageRanges] = useState<PDFPageRanges>(() => {
    const initial: PDFPageRanges = {};
    pdfs.forEach(pdf => {
      if (pdf.pageCount <= LARGE_PDF_THRESHOLD) {
        initial[pdf.fileName] = 'all';
      }
    });
    return initial;
  });

  const [customRanges, setCustomRanges] = useState<Record<string, string>>({});

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgSecondary: isDark ? '#374151' : '#f9fafb',
    bgHover: isDark ? '#4b5563' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#4b5563' : '#e5e7eb',
    accent: '#3b82f6',
    accentLight: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    success: '#10b981',
    successLight: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
  };

  // Get large PDFs that need page selection
  const largePdfs = useMemo(() =>
    pdfs.filter(pdf => pdf.pageCount > LARGE_PDF_THRESHOLD),
    [pdfs]
  );

  // Get small PDFs that are auto-included
  const smallPdfs = useMemo(() =>
    pdfs.filter(pdf => pdf.pageCount <= LARGE_PDF_THRESHOLD),
    [pdfs]
  );

  // Check if all required selections are made
  const allSelectionsComplete = useMemo(() => {
    return largePdfs.every(pdf => pageRanges[pdf.fileName]);
  }, [largePdfs, pageRanges]);

  // Generate preset page range buttons for a PDF
  const getPresetRanges = (pageCount: number): string[] => {
    const presets: string[] = [];
    const chunkSize = 5;

    for (let i = 1; i <= pageCount; i += chunkSize) {
      const end = Math.min(i + chunkSize - 1, pageCount);
      presets.push(`${i}-${end}`);
    }

    if (presets.length > 1) {
      presets.push('all');
    }

    return presets;
  };

  const handlePresetClick = (fileName: string, range: string) => {
    setPageRanges(prev => ({ ...prev, [fileName]: range }));
    setCustomRanges(prev => ({ ...prev, [fileName]: '' }));
  };

  const handleCustomRangeChange = (fileName: string, value: string) => {
    setCustomRanges(prev => ({ ...prev, [fileName]: value }));
    if (value.trim()) {
      setPageRanges(prev => ({ ...prev, [fileName]: value.trim() }));
    }
  };

  const handleContinue = () => {
    onContinue(pageRanges);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center mb-4">
        <FileText className="w-10 h-10 mx-auto mb-2" style={{ color: colors.accent }} />
        <h3 className="font-medium" style={{ color: colors.textPrimary }}>
          This lecture has PDF documents
        </h3>
        <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
          Select which pages to include in the AI context
        </p>
      </div>

      {/* Large PDFs requiring selection */}
      {largePdfs.map(pdf => {
        const presets = getPresetRanges(pdf.pageCount);
        const selectedRange = pageRanges[pdf.fileName];
        const customValue = customRanges[pdf.fileName] || '';
        const isCustomActive = customValue && selectedRange === customValue;

        return (
          <div
            key={`${pdf.source}-${pdf.id}`}
            className="rounded-lg p-4"
            style={{
              backgroundColor: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
            }}
          >
            {/* PDF name and page count */}
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5" style={{ color: colors.accent }} />
              <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                {pdf.fileName}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                backgroundColor: colors.bgHover,
                color: colors.textSecondary
              }}>
                {pdf.pageCount} pages
              </span>
            </div>

            {/* Preset range buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {presets.map(range => {
                const isSelected = selectedRange === range && !isCustomActive;
                return (
                  <button
                    key={range}
                    onClick={() => handlePresetClick(pdf.fileName, range)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: isSelected ? colors.accentLight : colors.bgHover,
                      color: isSelected ? colors.accent : colors.textSecondary,
                      border: isSelected ? `1px solid ${colors.accent}` : `1px solid transparent`,
                    }}
                  >
                    {range === 'all' ? 'All' : range}
                  </button>
                );
              })}
            </div>

            {/* Custom range input */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                Or custom:
              </span>
              <input
                type="text"
                value={customValue}
                onChange={(e) => handleCustomRangeChange(pdf.fileName, e.target.value)}
                placeholder="e.g., 1-3,7-10"
                className="flex-1 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{
                  backgroundColor: colors.bg,
                  border: `1px solid ${isCustomActive ? colors.accent : colors.border}`,
                  color: colors.textPrimary,
                }}
              />
            </div>

            {/* Selection indicator */}
            {selectedRange && (
              <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: colors.success }}>
                <Check className="w-3 h-3" />
                <span>Pages {selectedRange === 'all' ? `1-${pdf.pageCount}` : selectedRange} selected</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Small PDFs auto-included */}
      {smallPdfs.length > 0 && (
        <div className="space-y-2">
          {smallPdfs.map(pdf => (
            <div
              key={`${pdf.source}-${pdf.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: colors.successLight,
                border: `1px solid ${colors.success}`,
              }}
            >
              <Check className="w-4 h-4" style={{ color: colors.success }} />
              <FileText className="w-4 h-4" style={{ color: colors.success }} />
              <span className="text-sm" style={{ color: colors.textPrimary }}>
                {pdf.fileName}
              </span>
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                ({pdf.pageCount} pages) - All pages included
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!allSelectionsComplete}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: allSelectionsComplete ? colors.accent : colors.bgHover,
          color: allSelectionsComplete ? '#ffffff' : colors.textSecondary,
        }}
      >
        Continue to Ask Questions
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Help text for incomplete selection */}
      {!allSelectionsComplete && largePdfs.length > 0 && (
        <p className="text-center text-xs" style={{ color: colors.textSecondary }}>
          Please select pages for all large PDFs to continue
        </p>
      )}
    </div>
  );
};
