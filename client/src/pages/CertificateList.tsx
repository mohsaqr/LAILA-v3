import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Award, Calendar, ExternalLink, Download } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import apiClient from '../api/client';

interface CertificateItem {
  id: number;
  courseId: number;
  courseName: string;
  issuedAt: string;
  verificationCode: string;
  templateName: string;
}

export const CertificateList = () => {
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

  const { data: certificates, isLoading } = useQuery({
    queryKey: ['certificates', 'my'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CertificateItem[] }>('/certificates/my');
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text="Loading certificates..." />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: 'My Certificates' }]} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          My Certificates
        </h1>
        <p className="mt-2" style={{ color: colors.textSecondary }}>
          View and download your earned certificates
        </p>
      </div>

      {!certificates || certificates.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Award className="w-12 h-12 mx-auto mb-4" style={{ color: colors.gold }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              No Certificates Yet
            </h3>
            <p style={{ color: colors.textSecondary }}>
              Complete courses to earn certificates. They will appear here once issued.
            </p>
            <Link to="/courses" className="mt-4 inline-block">
              <Button>Browse Courses</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {certificates.map((cert) => (
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
                    <h3 className="font-semibold text-lg truncate" style={{ color: colors.textPrimary }}>
                      {cert.courseName}
                    </h3>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {cert.templateName}
                    </p>
                    <div className="flex items-center gap-2 mt-2" style={{ color: colors.textSecondary }}>
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        Issued {new Date(cert.issuedAt).toLocaleDateString()}
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
                      View
                    </Button>
                  </Link>
                  <Link to={`/verify/${cert.verificationCode}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
