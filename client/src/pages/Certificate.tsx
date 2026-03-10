import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Award, Download, CheckCircle, XCircle, ChevronLeft, Calendar, User, BarChart3, Share2, BrainCircuit, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useTranslation } from 'react-i18next';
import { certificatesApi } from '../api/certificates';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildCertificateBreadcrumb } from '../utils/breadcrumbs';

export const Certificate = () => {
  const { t } = useTranslation(['courses', 'common', 'navigation']);
  const { certificateId, verificationCode } = useParams<{ certificateId?: string; verificationCode?: string }>();
  const { isDark } = useTheme();
  const rightCardRef = useRef<HTMLDivElement>(null);
  const leftCardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
  };

  // Verification mode
  const { data: verificationResult, isLoading: verifyLoading } = useQuery({
    queryKey: ['certificateVerify', verificationCode],
    queryFn: () => certificatesApi.verifyCertificate(verificationCode!),
    enabled: !!verificationCode,
  });

  // View mode
  const { data: certificate, isLoading: certLoading } = useQuery({
    queryKey: ['certificate', certificateId],
    queryFn: () => certificatesApi.getCertificate(parseInt(certificateId!)),
    enabled: !!certificateId,
  });

  const isLoading = verifyLoading || certLoading;

  if (isLoading) {
    return <Loading text={t('loading_certificate')} />;
  }

  // Verification View
  if (verificationCode) {
    if (!verificationResult?.valid || !verificationResult.certificate) {
      return (
        <div className="min-h-screen py-12" style={{ backgroundColor: colors.bg }}>
          <div className="max-w-md mx-auto px-4">
            <Card>
              <CardBody className="text-center py-8">
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bgRed }}
                >
                  <XCircle className="w-10 h-10" style={{ color: colors.textRed }} />
                </div>
                <h1 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                  {t('certificate_not_found')}
                </h1>
                <p style={{ color: colors.textSecondary }}>
                  {verificationResult?.message || t('certificate_not_found_description')}
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      );
    }

    const cert = verificationResult.certificate;
    const verifyPercentage = cert.grades && cert.grades.total > 0
      ? Math.round((cert.grades.earned / cert.grades.total) * 100)
      : null;

    const renderVerifyTemplate = () => {
      let html = cert.template?.templateHtml || '';
      if (!html) return null;
      html = html.replace(/\{\{studentName\}\}/gi, cert.user?.fullname || '');
      html = html.replace(/\{\{date\}\}/gi, new Date(cert.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      html = html.replace(/\{\{courseName\}\}/gi, cert.course?.title || '');
      html = html.replace(/\{\{instructor\}\}/gi, cert.course?.instructor?.fullname || '');
      return html;
    };

    const verifyTemplateHtml = renderVerifyTemplate();

    return (
      <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Verified Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <CheckCircle className="w-5 h-5" style={{ color: colors.textGreen }} />
            <span className="text-sm font-medium" style={{ color: colors.textGreen }}>
              {t('certificate_verified')}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Card — Student Info */}
            <div className="lg:col-span-1">
              <Card className="overflow-hidden">
                <div className="p-6" style={{ backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }}>
                  {/* LAILA Branding */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                      <BrainCircuit className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                      LAILA
                    </span>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    {cert.user?.avatarUrl ? (
                      <img
                        src={cert.user.avatarUrl}
                        alt={cert.user.fullname}
                        className="w-24 h-24 rounded-full object-cover border-4 mb-4"
                        style={{ borderColor: isDark ? '#3b82f6' : '#bfdbfe' }}
                      />
                    ) : (
                      <div
                        className="w-24 h-24 rounded-full flex items-center justify-center border-4 mb-4"
                        style={{
                          backgroundColor: isDark ? '#1e40af' : '#dbeafe',
                          borderColor: isDark ? '#3b82f6' : '#bfdbfe',
                        }}
                      >
                        <User className="w-10 h-10" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                      </div>
                    )}

                    <h2 className="text-xl font-bold mb-1" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                      {cert.user?.fullname}
                    </h2>
                    <p className="text-sm mb-4" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }}>
                      {cert.course?.title}
                    </p>
                  </div>

                  {/* Issue Date */}
                  <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: isDark ? 'rgba(30, 58, 95, 0.5)' : 'rgba(255,255,255,0.7)' }}>
                    <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                    <div>
                      <p className="text-xs" style={{ color: isDark ? '#93c5fd' : '#6b7280' }}>{t('issue_date')}</p>
                      <p className="font-semibold text-sm" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                        {new Date(cert.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Achievement */}
                  {verifyPercentage !== null && (
                    <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: isDark ? 'rgba(30, 58, 95, 0.5)' : 'rgba(255,255,255,0.7)' }}>
                      <BarChart3 className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                      <div className="flex-1">
                        <p className="text-xs" style={{ color: isDark ? '#93c5fd' : '#6b7280' }}>{t('achievement')}</p>
                        <p className="font-semibold text-sm" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                          {verifyPercentage}%
                        </p>
                        <div className="w-full h-2 rounded-full mt-1" style={{ backgroundColor: isDark ? '#1e40af' : '#bfdbfe' }}>
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(verifyPercentage, 100)}%`,
                              backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Instructor */}
                  <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: isDark ? 'rgba(30, 58, 95, 0.5)' : 'rgba(255,255,255,0.7)' }}>
                    <Award className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                    <div>
                      <p className="text-xs" style={{ color: isDark ? '#93c5fd' : '#6b7280' }}>{t('instructor')}</p>
                      <p className="font-semibold text-sm" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                        {cert.course?.instructor?.fullname}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Card — Certificate Template */}
            <div className="lg:col-span-2">
              <Card>
                <div className="p-6">
                  {verifyTemplateHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: verifyTemplateHtml }}
                    />
                  ) : (
                    <div className="text-center py-16">
                      <Award className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textSecondary }} />
                      <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
                        {t('certificate_completion')}
                      </h3>
                      <p className="text-lg mb-1" style={{ color: colors.textPrimary }}>
                        {cert.user?.fullname}
                      </p>
                      <p className="mb-4" style={{ color: colors.textSecondary }}>
                        {cert.course?.title}
                      </p>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {new Date(cert.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Certificate View
  if (!certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center py-8">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p style={{ color: colors.textPrimary }}>{t('certificate_not_found')}</p>
            <Link to="/dashboard" className="mt-4 inline-block">
              <Button variant="secondary">
                <ChevronLeft size={18} />
                {t('navigation:dashboard')}
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const handleDownload = async () => {
    if (!rightCardRef.current || !leftCardRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;

      // Capture the left card (student info) first
      const leftCanvas = await html2canvas(leftCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
      });
      const leftImgData = leftCanvas.toDataURL('image/png');
      const leftImgHeight = (leftCanvas.height / leftCanvas.width) * contentWidth;
      pdf.addImage(leftImgData, 'PNG', margin, margin, contentWidth, leftImgHeight);

      // Capture the right card (certificate template)
      const rightCanvas = await html2canvas(rightCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
      });
      const rightImgData = rightCanvas.toDataURL('image/png');
      const rightImgHeight = (rightCanvas.height / rightCanvas.width) * contentWidth;

      // Check if right card fits on current page, otherwise add new page
      const currentY = margin + leftImgHeight + 10;
      if (currentY + rightImgHeight > pageHeight - margin) {
        pdf.addPage();
        pdf.addImage(rightImgData, 'PNG', margin, margin, contentWidth, rightImgHeight);
      } else {
        pdf.addImage(rightImgData, 'PNG', margin, currentY, contentWidth, rightImgHeight);
      }

      pdf.save(`certificate-${certificate.verificationCode}.pdf`);
    } catch {
      toast.error(t('common:error'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const breadcrumbItems = buildCertificateBreadcrumb(
    certificate.course?.id,
    certificate.course?.title,
    'Certificate'
  );

  const percentage = certificate.grades && certificate.grades.total > 0
    ? Math.round((certificate.grades.earned / certificate.grades.total) * 100)
    : null;

  const renderTemplate = () => {
    let html = certificate.template?.templateHtml || '';
    if (!html) return null;
    html = html.replace(/\{\{studentName\}\}/gi, certificate.user?.fullname || '');
    html = html.replace(/\{\{date\}\}/gi, new Date(certificate.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    html = html.replace(/\{\{courseName\}\}/gi, certificate.course?.title || '');
    html = html.replace(/\{\{instructor\}\}/gi, certificate.course?.instructor?.fullname || '');
    return html;
  };

  const templateHtml = renderTemplate();

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Card — Student Info */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden">
              <div ref={leftCardRef} className="p-6" style={{ backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }}>
                {/* LAILA Branding */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                    LAILA
                  </span>
                </div>

                <div className="flex flex-col items-center text-center">
                  {/* Profile Picture */}
                  {certificate.user?.avatarUrl ? (
                    <img
                      src={certificate.user.avatarUrl}
                      alt={certificate.user.fullname}
                      className="w-24 h-24 rounded-full object-cover border-4 mb-4"
                      style={{ borderColor: isDark ? '#3b82f6' : '#bfdbfe' }}
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center border-4 mb-4"
                      style={{
                        backgroundColor: isDark ? '#1e40af' : '#dbeafe',
                        borderColor: isDark ? '#3b82f6' : '#bfdbfe',
                      }}
                    >
                      <User className="w-10 h-10" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                    </div>
                  )}

                  <h2 className="text-xl font-bold mb-1" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                    {certificate.user?.fullname}
                  </h2>
                  <p className="text-sm mb-4" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }}>
                    {certificate.course?.title}
                  </p>
                </div>

                {/* Issue Date */}
                <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: isDark ? 'rgba(30, 58, 95, 0.5)' : 'rgba(255,255,255,0.7)' }}>
                  <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                  <div>
                    <p className="text-xs" style={{ color: isDark ? '#93c5fd' : '#6b7280' }}>{t('issue_date')}</p>
                    <p className="font-semibold text-sm" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                      {new Date(certificate.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Achievement */}
                {percentage !== null && (
                  <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: isDark ? 'rgba(30, 58, 95, 0.5)' : 'rgba(255,255,255,0.7)' }}>
                    <BarChart3 className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: isDark ? '#93c5fd' : '#6b7280' }}>{t('achievement')}</p>
                      <p className="font-semibold text-sm" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                        {percentage}% ({certificate.grades!.earned} / {certificate.grades!.total} {t('points')})
                      </p>
                      <div className="w-full h-2 rounded-full mt-1" style={{ backgroundColor: isDark ? '#1e40af' : '#bfdbfe' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructor */}
                <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: isDark ? 'rgba(30, 58, 95, 0.5)' : 'rgba(255,255,255,0.7)' }}>
                  <Award className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#93c5fd' : '#3b82f6' }} />
                  <div>
                    <p className="text-xs" style={{ color: isDark ? '#93c5fd' : '#6b7280' }}>{t('instructor')}</p>
                    <p className="font-semibold text-sm" style={{ color: isDark ? '#f3f4f6' : '#1e3a5f' }}>
                      {certificate.course?.instructor?.fullname}
                    </p>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <CardBody className="flex gap-3">
                <Button variant="secondary" onClick={() => {
                  const url = `${window.location.origin}/verify/${certificate.verificationCode}`;
                  navigator.clipboard.writeText(url);
                  toast.success(t('link_copied'));
                }} className="flex-1">
                  <Share2 size={16} />
                  {t('common:share')}
                </Button>
                <Button onClick={handleDownload} disabled={isGeneratingPdf} className="flex-1">
                  {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {isGeneratingPdf ? t('common:loading') : t('common:download')}
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Right Card — Certificate Template */}
          <div className="lg:col-span-2">
            <Card>
              <div ref={rightCardRef} className="p-6">
                {templateHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: templateHtml }}
                  />
                ) : (
                  <div className="text-center py-16">
                    <Award className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textSecondary }} />
                    <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
                      {t('certificate_completion')}
                    </h3>
                    <p className="text-lg mb-1" style={{ color: colors.textPrimary }}>
                      {certificate.user?.fullname}
                    </p>
                    <p className="mb-4" style={{ color: colors.textSecondary }}>
                      {certificate.course?.title}
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {new Date(certificate.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
