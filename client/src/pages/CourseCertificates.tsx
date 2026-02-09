import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Award, Calendar, ExternalLink, Download, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildCourseBreadcrumb } from '../utils/breadcrumbs';
import apiClient from '../api/client';

interface Certificate {
  id: number;
  courseId: number;
  issueDate: string;
  verificationCode: string;
  template?: { id: number; name: string };
}

interface AvailableCertificate {
  id: number;
  name: string;
  description?: string;
  requirements?: string;
}

interface CourseInfo {
  id: number;
  title: string;
}

export const CourseCertificates = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId } = useParams<{ courseId: string }>();
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
    gold: '#f59e0b',
  };

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CourseInfo }>(`/courses/${courseId}`);
      return response.data.data;
    },
  });

  const { data: certificates, isLoading: loadingCerts } = useQuery({
    queryKey: ['certificates', 'course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Certificate[] }>(`/certificates/course/${courseId}`);
      return response.data.data;
    },
  });

  const { data: availableCertificates, isLoading: loadingAvailable } = useQuery({
    queryKey: ['certificates', 'course', courseId, 'available'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AvailableCertificate[] }>(`/certificates/course/${courseId}/available`);
      return response.data.data;
    },
  });

  if (loadingCerts || loadingAvailable) {
    return <Loading text={t('loading_certificates')} />;
  }

  const earnedCertificates = certificates || [];
  const availableToEarn = availableCertificates || [];

  const breadcrumbItems = [
    ...buildCourseBreadcrumb(courseId!, course?.title || 'Course'),
    { label: 'Certificates' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          {t('course_certificates')}
        </h1>
        {course && (
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            {t('certificate_for', { course: course.title })}
          </p>
        )}
      </div>

      {/* Earned Certificates */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
          <Trophy className="w-5 h-5" style={{ color: colors.gold }} />
          {t('earned_certificates')}
        </h2>

        {earnedCertificates.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8">
              <Award className="w-10 h-10 mx-auto mb-3" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textSecondary }}>
                {t('no_certificates_yet')}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {earnedCertificates.map((cert) => (
              <Card key={cert.id} className="overflow-hidden">
                <div
                  className="h-2"
                  style={{
                    background: `linear-gradient(90deg, ${colors.gold}, ${colors.accent})`,
                  }}
                />
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${colors.gold}20` }}
                    >
                      <Award className="w-7 h-7" style={{ color: colors.gold }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg" style={{ color: colors.textPrimary }}>
                        {cert.template?.name || 'Course Certificate'}
                      </h3>
                      <div className="flex items-center gap-2 mt-2" style={{ color: colors.textSecondary }}>
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          {t('issued_on', { date: new Date(cert.issueDate).toLocaleDateString() })}
                        </span>
                      </div>
                      <p className="text-xs mt-1 font-mono" style={{ color: colors.textSecondary }}>
                        ID: {cert.verificationCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Link to={`/certificate/${cert.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {t('common:view')}
                      </Button>
                    </Link>
                    <Link to={`/verify/${cert.verificationCode}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        {t('common:download')}
                      </Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Available to Earn */}
      {availableToEarn.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>
            {t('available_to_earn')}
          </h2>
          <div className="space-y-4">
            {availableToEarn.map((cert) => (
              <Card key={cert.id}>
                <CardBody className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${colors.textSecondary}20` }}
                  >
                    <Award className="w-6 h-6" style={{ color: colors.textSecondary }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                      {cert.name}
                    </h3>
                    {cert.description && (
                      <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        {cert.description}
                      </p>
                    )}
                    {cert.requirements && (
                      <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        <strong>Requirements:</strong> {cert.requirements}
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
