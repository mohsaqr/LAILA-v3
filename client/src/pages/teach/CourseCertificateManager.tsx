import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, UserCheck, Calendar, Search, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import apiClient from '../../api/client';

interface CourseInfo {
  id: number;
  title: string;
}

interface IssuedCertificate {
  id: number;
  userId: number;
  issueDate: string;
  verificationCode: string;
  user?: { id: number; fullname: string; email: string };
}

interface EligibleStudent {
  id: number;
  fullname: string;
  email: string;
  completionPercentage: number;
  hasCertificate: boolean;
}

interface CertificateTemplate {
  id: number;
  name: string;
  isDefault: boolean;
}

export const CourseCertificateManager = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id: courseId } = useParams<{ id: string }>();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<EligibleStudent | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const { data: issuedCertificates, isLoading: loadingIssued } = useQuery({
    queryKey: ['certificates', 'course', courseId, 'issued'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: IssuedCertificate[] }>(
        `/certificates/course/${courseId}/issued`
      );
      return response.data.data;
    },
  });

  const { data: eligibleStudents, isLoading: loadingEligible } = useQuery({
    queryKey: ['certificates', 'course', courseId, 'eligible'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: EligibleStudent[] }>(
        `/certificates/course/${courseId}/eligible`
      );
      return response.data.data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['certificateTemplates'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CertificateTemplate[] }>(
        '/certificates/templates'
      );
      return response.data.data;
    },
  });

  const issueMutation = useMutation({
    mutationFn: async ({ userId, templateId }: { userId: number; templateId?: number }) => {
      const response = await apiClient.post('/certificates/issue', {
        userId,
        courseId: parseInt(courseId!),
        templateId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates', 'course', courseId] });
      setShowIssueModal(false);
      setSelectedStudent(null);
      toast.success(t('certificate_issued'));
    },
    onError: () => toast.error(t('failed_issue_certificate')),
  });

  const handleIssue = () => {
    if (!selectedStudent) return;
    issueMutation.mutate({
      userId: selectedStudent.id,
      templateId: selectedTemplate || undefined,
    });
  };

  const openIssueModal = (student: EligibleStudent) => {
    setSelectedStudent(student);
    const defaultTemplate = templates?.find(t => t.isDefault);
    setSelectedTemplate(defaultTemplate?.id || null);
    setShowIssueModal(true);
  };

  const filteredStudents = (eligibleStudents || []).filter(
    (student) =>
      !student.hasCertificate &&
      (student.fullname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loadingIssued || loadingEligible) {
    return <Loading text={t('loading_certificates')} />;
  }

  const breadcrumbItems = buildTeachingBreadcrumb(courseId, course?.title || 'Course', 'Certificates');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          {t('certificate_manager')}
        </h1>
        {course && (
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            {t('issue_manage_certificates_for', { course: course.title })}
          </p>
        )}
      </div>

      {/* Issued Certificates */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
          <Award className="w-5 h-5" style={{ color: colors.gold }} />
          {t('issued_certificates')} ({issuedCertificates?.length || 0})
        </h2>

        {!issuedCertificates || issuedCertificates.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8">
              <Award className="w-10 h-10 mx-auto mb-3" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textSecondary }}>
                {t('no_certificates_issued_yet')}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {issuedCertificates.map((cert) => (
              <Card key={cert.id}>
                <CardBody className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${colors.gold}20` }}
                    >
                      <Award className="w-5 h-5" style={{ color: colors.gold }} />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>
                        {cert.user?.fullname}
                      </p>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {cert.user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1" style={{ color: colors.textSecondary }}>
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          {new Date(cert.issueDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                        {cert.verificationCode}
                      </p>
                    </div>
                    <Link to={`/certificate/${cert.id}`}>
                      <Button variant="outline" size="sm">
                        {t('view')}
                      </Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Issue New Certificate */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
          <UserCheck className="w-5 h-5" style={{ color: colors.accent }} />
          {t('issue_new_certificate')}
        </h2>

        <Card>
          <CardBody>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.textSecondary }} />
                <input
                  type="text"
                  placeholder={t('search_students')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border"
                  style={{
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                />
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <p className="text-center py-4" style={{ color: colors.textSecondary }}>
                {searchTerm
                  ? t('no_matching_students')
                  : t('all_students_have_certificates')}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    style={{ borderBottom: `1px solid ${colors.border}` }}
                  >
                    <div>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>
                        {student.fullname}
                      </p>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {student.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                          {student.completionPercentage}%
                        </p>
                        <p className="text-xs" style={{ color: colors.textSecondary }}>
                          {t('completed_label')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openIssueModal(student)}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        {t('issue')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Issue Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => {
          setShowIssueModal(false);
          setSelectedStudent(null);
        }}
        title={t('issue_certificate')}
      >
        {selectedStudent && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${colors.accent}10` }}>
              <p className="font-medium" style={{ color: colors.textPrimary }}>
                {selectedStudent.fullname}
              </p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {selectedStudent.email}
              </p>
              <p className="text-sm mt-2" style={{ color: colors.textSecondary }}>
                {t('course_completion_percent', { percent: selectedStudent.completionPercentage })}
              </p>
            </div>

            {templates && templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  {t('certificate_template')}
                </label>
                <select
                  value={selectedTemplate || ''}
                  onChange={(e) => setSelectedTemplate(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isDefault ? `(${t('default_label')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowIssueModal(false);
                  setSelectedStudent(null);
                }}
              >
                {t('common:cancel')}
              </Button>
              <Button
                onClick={handleIssue}
                disabled={issueMutation.isPending}
              >
                <Award className="w-4 h-4 mr-2" />
                {t('issue_certificate')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
