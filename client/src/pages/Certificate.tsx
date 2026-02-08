import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Award, Download, CheckCircle, XCircle, ChevronLeft } from 'lucide-react';
import { certificatesApi } from '../api/certificates';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildCertificateBreadcrumb } from '../utils/breadcrumbs';

export const Certificate = () => {
  const { certificateId, verificationCode } = useParams<{ certificateId?: string; verificationCode?: string }>();
  const { isDark } = useTheme();

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
    return <Loading text="Loading certificate..." />;
  }

  // Verification View
  if (verificationCode) {
    return (
      <div className="min-h-screen py-12" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-md mx-auto px-4">
          <Card>
            <CardBody className="text-center py-8">
              {verificationResult?.valid ? (
                <>
                  <div
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgGreen }}
                  >
                    <CheckCircle className="w-10 h-10" style={{ color: colors.textGreen }} />
                  </div>
                  <h1 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                    Certificate Verified
                  </h1>
                  <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                    This certificate is authentic and valid
                  </p>

                  <div className="space-y-4 text-left p-4 rounded-lg" style={{ backgroundColor: colors.bg }}>
                    <div>
                      <p className="text-xs uppercase" style={{ color: colors.textSecondary }}>Recipient</p>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>
                        {verificationResult.certificate?.recipientName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase" style={{ color: colors.textSecondary }}>Course</p>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>
                        {verificationResult.certificate?.courseName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase" style={{ color: colors.textSecondary }}>Issue Date</p>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>
                        {verificationResult.certificate?.issueDate &&
                          new Date(verificationResult.certificate.issueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase" style={{ color: colors.textSecondary }}>Verification Code</p>
                      <p className="font-mono text-sm" style={{ color: colors.textSecondary }}>
                        {verificationResult.certificate?.verificationCode}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgRed }}
                  >
                    <XCircle className="w-10 h-10" style={{ color: colors.textRed }} />
                  </div>
                  <h1 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                    Certificate Not Found
                  </h1>
                  <p style={{ color: colors.textSecondary }}>
                    {verificationResult?.message || 'This certificate could not be verified'}
                  </p>
                </>
              )}

              <div className="mt-8">
                <Link to="/dashboard">
                  <Button variant="secondary">
                    <ChevronLeft size={18} />
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
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
            <p style={{ color: colors.textPrimary }}>Certificate not found</p>
            <Link to="/dashboard" className="mt-4 inline-block">
              <Button variant="secondary">
                <ChevronLeft size={18} />
                Back to Dashboard
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const html = await certificatesApi.renderCertificate(certificate.id);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${certificate.verificationCode}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Handle error silently
    }
  };

  const handleView = async () => {
    try {
      const html = await certificatesApi.renderCertificate(certificate.id);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch {
      // Handle error silently
    }
  };

  const breadcrumbItems = buildCertificateBreadcrumb(
    certificate.course?.id,
    certificate.course?.title,
    'Certificate'
  );

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-2xl mx-auto px-4">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <Card>
          <CardBody className="text-center py-8">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(102, 126, 234, 0.1)' }}
            >
              <Award className="w-10 h-10 text-indigo-500" />
            </div>

            <h1 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
              Certificate of Completion
            </h1>

            <p className="text-lg mb-1" style={{ color: colors.textPrimary }}>
              {certificate.user?.fullname}
            </p>
            <p className="mb-6" style={{ color: colors.textSecondary }}>
              has successfully completed
            </p>

            <h2 className="text-xl font-semibold mb-6" style={{ color: colors.textPrimary }}>
              {certificate.course?.title}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
              <div>
                <p style={{ color: colors.textSecondary }}>Issue Date</p>
                <p className="font-medium" style={{ color: colors.textPrimary }}>
                  {new Date(certificate.issueDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p style={{ color: colors.textSecondary }}>Instructor</p>
                <p className="font-medium" style={{ color: colors.textPrimary }}>
                  {certificate.course?.instructor?.fullname}
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-lg mb-8"
              style={{ backgroundColor: colors.bg }}
            >
              <p className="text-xs uppercase mb-1" style={{ color: colors.textSecondary }}>
                Verification Code
              </p>
              <p className="font-mono" style={{ color: colors.textPrimary }}>
                {certificate.verificationCode}
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="secondary" onClick={handleView}>
                <Award size={18} />
                View Certificate
              </Button>
              <Button onClick={handleDownload}>
                <Download size={18} />
                Download
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
