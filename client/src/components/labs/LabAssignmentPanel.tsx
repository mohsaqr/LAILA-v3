import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X, FileDown, Send, CheckCircle, Loader2, ExternalLink, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentsApi } from '../../api/assignments';
import { customLabsApi } from '../../api/customLabs';
import { RichTextEditor } from '../forum/RichTextEditor';
import { Button } from '../common/Button';
import { activityLogger } from '../../services/activityLogger';
import { useAuthStore } from '../../store/authStore';

export interface ReportItem {
  key: string;
  label: string;
  dataUrl: string;
  timestamp: number;
  code?: string;
}

export interface LabSessionConfig {
  labType: 'tna' | 'sna' | 'r' | 'python';
  datasetName: string;
  actorCol?: string; actionCol?: string; timeCol?: string;
  modelType?: string;
  sequenceCount?: number; stateCount?: number; states?: string[];
  edgeCountOriginal?: number; edgeCountPruned?: number; pruneThreshold?: number;
  nodeCount?: number; edgeCount?: number; density?: number;
  isDirected?: boolean; communityMethod?: string; communityCount?: number;
  avgDegree?: number; avgWeight?: number;
}

export interface LabSessionEvent { ts: number; event: string; }

interface LabAssignmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: {
    id: number;
    description: string | null;
    points: number | null;
    dueDate: string | null;
  };
  labContentRef: React.RefObject<HTMLDivElement>;
  labId: number;
  courseId: number;
  hasActiveAnalysis?: boolean;
  activeAnalysisKey?: string;
  visitedAnalyses?: string[];
  sessionConfig?: LabSessionConfig;
  sessionEvents?: LabSessionEvent[];
  courseNumericId?: number;
  assignmentId?: number;
  reportItems?: ReportItem[];
  onSubmitted?: () => void;
  courseName?: string;
  code?: string;
}

export const LabAssignmentPanel = ({
  isOpen,
  onClose,
  assignment,
  labContentRef,
  hasActiveAnalysis,
  activeAnalysisKey,
  visitedAnalyses,
  sessionConfig,
  sessionEvents,
  courseNumericId,
  assignmentId,
  reportItems,
  onSubmitted,
  courseName,
  code,
}: LabAssignmentPanelProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const user = useAuthStore(s => s.user);
  const [response, setResponse] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const { data: existingSubmission, isLoading: submissionLoading } = useQuery({
    queryKey: ['mySubmission', assignment.id],
    queryFn: () => assignmentsApi.getMySubmission(assignment.id),
    enabled: isOpen,
    retry: false,
  });

  // Pre-populate form from existing submission (draft or previous)
  useEffect(() => {
    if (existingSubmission) {
      if (existingSubmission.content && !response) {
        setResponse(existingSubmission.content);
      }
      if (existingSubmission.fileUrls && !pdfUrl) {
        try {
          const urls = JSON.parse(existingSubmission.fileUrls);
          if (Array.isArray(urls) && urls.length > 0) {
            setPdfUrl(urls[0]);
          }
        } catch { /* ignore */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSubmission]);

  const submitMutation = useMutation({
    mutationFn: () =>
      assignmentsApi.submitAssignment(assignment.id, {
        content: response,
        fileUrls: pdfUrl ? [pdfUrl] : [],
        status: 'submitted',
      }),
    onSuccess: () => {
      toast.success(t('submission_success', { defaultValue: 'Assignment submitted successfully!' }));
      setIsResubmitting(false);
      // Log lab assignment submission
      if (courseNumericId && assignmentId) {
        activityLogger.logLabSubmitted(
          sessionConfig?.labType?.toUpperCase() || 'LAB',
          assignmentId,
          courseNumericId,
          { datasetName: sessionConfig?.datasetName, analysesVisited: visitedAnalyses },
        );
      }
      onSubmitted?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common:error'));
    },
  });

  const handleGeneratePdf = async () => {
    if (!hasActiveAnalysis || !sessionConfig) return;
    setIsGeneratingPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const lineH = 6;
      let y = 20;

      // Always render text in black regardless of fill colour
      pdf.setTextColor(0, 0, 0);

      const section = (title: string) => {
        if (y > 250) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
        pdf.setFillColor(230, 235, 245);
        pdf.rect(margin, y - 4, W - margin * 2, 8, 'F');
        pdf.setTextColor(0, 0, 0); // reset after fill draw
        pdf.text(title, margin + 2, y + 1);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
        y += lineH * 1.5;
      };

      const row = (label: string, value: string) => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
        pdf.text(label + ':', margin + 2, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), margin + 50, y);
        y += lineH;
      };

      const para = (text: string) => {
        pdf.setTextColor(0, 0, 0);
        const lines = pdf.splitTextToSize(text, W - margin * 2 - 4);
        lines.forEach((l: string) => {
          if (y > 270) { pdf.addPage(); y = 20; }
          pdf.text(l, margin + 2, y); y += lineH * 0.85;
        });
        y += 2;
      };

      // ── HEADER ──
      pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      const labLabel = sessionConfig.labType === 'tna' ? 'Transition Network Analysis'
        : sessionConfig.labType === 'sna' ? 'Social Network Analysis'
        : sessionConfig.labType === 'python' ? 'Python'
        : 'R';
      pdf.text(`LAILA - ${labLabel} Lab Report`, margin, y); y += 8;
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += lineH;
      pdf.text(`Assignment: ${(assignment.description ?? '-').replace(/[^\x00-\x7F]/g, '-').slice(0, 120)}`, margin, y); y += lineH * 2;

      // ── DATASET & CONFIGURATION ──
      section('1. DATASET & CONFIGURATION');
      row('Dataset', sessionConfig.datasetName || '-');
      if (sessionConfig.labType === 'tna') {
        row('Actor Column', sessionConfig.actorCol || '-');
        row('Action Column', sessionConfig.actionCol || '-');
        row('Time Column', sessionConfig.timeCol || '-');
        row('Model Type', sessionConfig.modelType || '-');
      } else if (sessionConfig.labType === 'sna') {
        row('Network Type', sessionConfig.isDirected ? 'Directed' : 'Undirected');
        row('Community Method', sessionConfig.communityMethod || '-');
      } else {
        row('Language', sessionConfig.labType === 'python' ? 'Python' : 'R');
        row('Template', sessionConfig.datasetName || '-');
      }
      y += 2;

      // ── MODEL SUMMARY ──
      section('2. MODEL SUMMARY');
      if (sessionConfig.labType === 'tna') {
        row('Sequences', String(sessionConfig.sequenceCount ?? 0));
        row('Unique States', String(sessionConfig.stateCount ?? 0));
        row('Edges (original)', String(sessionConfig.edgeCountOriginal ?? 0));
        row('Edges (pruned)', `${sessionConfig.edgeCountPruned ?? 0} at threshold ${sessionConfig.pruneThreshold ?? 0.1}`);
        if (sessionConfig.states?.length) para('States: ' + sessionConfig.states.join(', '));
      } else if (sessionConfig.labType === 'sna') {
        row('Nodes', String(sessionConfig.nodeCount ?? 0));
        row('Edges', String(sessionConfig.edgeCount ?? 0));
        row('Density', sessionConfig.density?.toFixed(4) ?? '-');
        row('Avg Degree', sessionConfig.avgDegree?.toFixed(2) ?? '-');
        row('Avg Weight', sessionConfig.avgWeight?.toFixed(2) ?? '-');
        row('Communities', String(sessionConfig.communityCount ?? '-'));
      } else {
        row('Templates run', visitedAnalyses?.join(', ') || '-');
        row('Snapshots captured', String(reportItems?.length ?? 0));
      }
      y += 2;

      // ── ANALYSES EXPLORED ──
      section('3. ANALYSES EXPLORED');
      row('Tabs visited', visitedAnalyses?.join(', ') || '-');
      row('Active at report time', activeAnalysisKey || '-');
      y += 2;

      // ── SESSION LOG ──
      section('4. SESSION LOG');
      (sessionEvents ?? []).forEach(({ ts, event }) => {
        const time = new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
        pdf.text(`[${time}]  ${event}`, margin + 2, y); y += lineH * 0.9;
      });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
      y += 4;

      // ── CODE & OUTPUT SNAPSHOTS ──
      const snapshotItems = reportItems && reportItems.length > 0
        ? reportItems
        : labContentRef.current
          ? [{ key: activeAnalysisKey ?? 'analysis', label: activeAnalysisKey ?? 'Analysis', dataUrl: '', timestamp: Date.now(), code }]
          : [];

      const renderCode = (codeText: string) => {
        pdf.setFont('courier', 'normal'); pdf.setFontSize(8);
        const codeLines = codeText.split('\n');
        const rowH = lineH * 0.85;
        for (const line of codeLines) {
          const wrapped = pdf.splitTextToSize(line || ' ', W - margin * 2 - 8);
          for (const wl of wrapped) {
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.setFillColor(245, 245, 245);
            pdf.rect(margin, y - 3.5, W - margin * 2, rowH, 'F');
            pdf.setTextColor(60, 60, 60);
            pdf.text(wl, margin + 4, y);
            y += rowH;
          }
        }
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        y += 4;
      };

      for (let i = 0; i < snapshotItems.length; i++) {
        const item = snapshotItems[i];
        pdf.addPage();
        y = 15;
        const sectionNum = i + 5;

        // ── Code for this snapshot ──
        if (item.code && item.code.trim()) {
          section(`${sectionNum}a. CODE - ${item.label.toUpperCase()}`);
          renderCode(item.code);
        }

        // ── Output snapshot ──
        let imgData = item.dataUrl;
        if (!imgData && labContentRef.current) {
          const el = labContentRef.current;
          const canvas = await html2canvas(el, {
            scale: 1.2, useCORS: true, allowTaint: true,
            width: el.scrollWidth, height: el.scrollHeight,
            scrollX: 0, scrollY: 0,
          });
          imgData = canvas.toDataURL('image/jpeg', 0.8);
        }
        if (imgData) {
          const pageH = pdf.internal.pageSize.getHeight();
          const halfPage = (pageH - margin * 2) / 2;
          const remaining = pageH - margin - y;

          // If less than half a page remains, start a new page for the output
          if (remaining < halfPage) {
            pdf.addPage();
            y = 20;
          }

          section(`${sectionNum}${item.code?.trim() ? 'b' : ''}. OUTPUT - ${item.label.toUpperCase()}`);

          const img = new Image();
          await new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.src = imgData;
          });
          const maxW = W - margin * 2;
          const pageBottom = pageH - margin;
          const maxH = pageBottom - y;
          const ratio = img.width / img.height;
          let imgW = maxW;
          let imgH = imgW / ratio;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = imgH * ratio;
          }
          const imgX = margin + (maxW - imgW) / 2;
          pdf.addImage(imgData, 'JPEG', imgX, y, imgW, imgH);
          y += imgH + 4;
        }
      }

      const pdfBlob = pdf.output('blob') as Blob;
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(pdfBlob));
      const sanitizeName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '').replace(/\s+/g, '-').replace(/-+$/, '') || 'untitled';
      const safeCourse = sanitizeName(courseName || 'course');
      const safeStudent = sanitizeName(user?.fullname || 'student');
      const pdfFileName = `${safeCourse}_assignment-${assignment.id}_${safeStudent}.pdf`;
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
      const { url } = await customLabsApi.uploadLabSubmission(pdfFile);
      setPdfUrl(url);

      // Log to platform
      if (courseNumericId && assignmentId) {
        activityLogger.logLabSubmitted(
          sessionConfig.labType.toUpperCase(),
          assignmentId,
          courseNumericId,
          { datasetName: sessionConfig.datasetName, analysesVisited: visitedAnalyses }
        );
      }
      toast.success(t('pdf_generated', { defaultValue: 'PDF report generated!' }));
    } catch (err) {
      console.error(err);
      toast.error(t('pdf_generation_failed', { defaultValue: 'Failed to generate PDF report' }));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' }) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div
        ref={panelRef}
        className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('submit_assignment', { defaultValue: 'Submit Assignment' })}
            </h2>
            <div className="flex items-center gap-3 mt-0.5">
              {assignment.points != null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {assignment.points} {t('points', { defaultValue: 'pts' })}
                </span>
              )}
              {dueDate && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('due', { defaultValue: 'Due' })}: {dueDate}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {submissionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : existingSubmission && existingSubmission.status !== 'draft' && !isResubmitting ? (
            /* Already submitted — show grade/feedback with resubmit option */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-300">
                      {t('already_submitted', { defaultValue: 'Assignment already submitted' })}
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      {new Date(existingSubmission.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {existingSubmission.status === 'submitted' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsResubmitting(true)}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    {t('resubmit', { defaultValue: 'Resubmit' })}
                  </Button>
                )}
              </div>

              {existingSubmission.grade != null && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('your_grade', { defaultValue: 'Your Grade' })}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {existingSubmission.grade}
                    {assignment.points != null && (
                      <span className="text-base font-normal text-gray-500"> / {assignment.points}</span>
                    )}
                  </p>
                </div>
              )}

              {existingSubmission.feedback && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {t('feedback', { defaultValue: 'Feedback' })}
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
                    {existingSubmission.feedback}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Not yet submitted */
            <div className="space-y-4">
              {/* Prompt */}
              {assignment.description && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                    {t('assignment_instructions', { defaultValue: 'Instructions' })}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 whitespace-pre-line">
                    {assignment.description}
                  </p>
                </div>
              )}

              {/* Response editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('your_response', { defaultValue: 'Your Response' })}
                </label>
                <RichTextEditor
                  value={response}
                  onChange={setResponse}
                  placeholder={t('write_response_here', { defaultValue: 'Write your response here...' })}
                />
              </div>

              {/* Queued report snapshots */}
              {reportItems && reportItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Queued snapshots ({reportItems.length})
                  </p>
                  <div className="space-y-1.5">
                    {reportItems.map(item => (
                      <div key={item.key} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <img src={item.dataUrl} alt={item.label} className="h-10 w-16 object-cover rounded border border-gray-200 dark:border-gray-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF snapshot */}
              <div className="space-y-3">
                {!hasActiveAnalysis ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    {sessionConfig?.labType === 'r' || sessionConfig?.labType === 'python'
                      ? 'Run your code first, then use "Add to report" to capture outputs.'
                      : 'Select and run an analysis tab first to generate a meaningful report.'
                    }
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleGeneratePdf}
                      loading={isGeneratingPdf}
                      icon={<FileDown className="w-4 h-4" />}
                    >
                      {t('generate_pdf_snapshot', { defaultValue: 'Generate PDF Report' })}
                    </Button>
                    {pdfUrl && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('pdf_ready', { defaultValue: 'PDF ready' })}
                      </span>
                    )}
                  </div>
                )}

                {/* PDF preview */}
                {pdfPreviewUrl && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {t('pdf_preview', { defaultValue: 'PDF Preview' })}
                      </span>
                      <a
                        href={pdfPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t('open_in_tab', { defaultValue: 'Open in new tab' })}
                      </a>
                    </div>
                    <iframe
                      src={pdfPreviewUrl}
                      className="w-full"
                      style={{ height: '320px' }}
                      title="PDF Preview"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!submissionLoading && (!existingSubmission || existingSubmission.status === 'draft' || isResubmitting) && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { if (isResubmitting) setIsResubmitting(false); onClose(); }}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              loading={submitMutation.isPending}
              disabled={!response.trim() && !pdfUrl}
              icon={<Send className="w-4 h-4" />}
            >
              {isResubmitting
                ? t('resubmit', { defaultValue: 'Resubmit' })
                : t('submit_assignment', { defaultValue: 'Submit' })
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
