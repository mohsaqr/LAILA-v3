import { Router } from 'express';
import { certificateService } from '../services/certificate.service.js';
import { authenticateToken, requireInstructor, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  templateHtml: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const issueCertificateSchema = z.object({
  userId: z.number().positive(),
  courseId: z.number().positive(),
  templateId: z.number().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

// =========================================================================
// PUBLIC ROUTES
// =========================================================================

// Verify certificate (public endpoint)
router.get('/verify/:code', asyncHandler(async (req, res) => {
  const verificationCode = req.params.code;
  const result = await certificateService.verifyCertificate(verificationCode);
  res.json({ success: true, data: result });
}));

// =========================================================================
// USER ROUTES
// =========================================================================

// Get my certificates
router.get('/my', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const certificates = await certificateService.getMyCertificates(user.id);
  res.json({ success: true, data: certificates });
}));

// Get certificates earned in a specific course (student)
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const certificates = await certificateService.getCourseCertificates(courseId, user.id);
  res.json({ success: true, data: certificates });
}));

// Get certificates available to earn in a course (student)
router.get('/course/:courseId/available', authenticateToken, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const available = await certificateService.getAvailableCertificates(courseId, user.id);
  res.json({ success: true, data: available });
}));

// Get all issued certificates for a course (instructor)
router.get('/course/:courseId/issued', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const certificates = await certificateService.getCourseIssuedCertificates(courseId, user.id, user.isAdmin);
  res.json({ success: true, data: certificates });
}));

// Get eligible students for certificate (instructor)
router.get('/course/:courseId/eligible', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const eligible = await certificateService.getEligibleStudents(courseId, user.id, user.isAdmin);
  res.json({ success: true, data: eligible });
}));

// Get single certificate (owner, admin, or course instructor can view)
router.get('/:certificateId', authenticateToken, asyncHandler(async (req, res) => {
  const certificateId = parseInt(req.params.certificateId);
  const user = (req as any).user;

  const certificate = await certificateService.getCertificate(
    certificateId,
    user.id,
    user.isAdmin,
    user.isInstructor
  );
  res.json({ success: true, data: certificate });
}));

// Render certificate as HTML (for viewing/printing)
// Owner, admin, or course instructor can render
router.get('/:certificateId/render', authenticateToken, asyncHandler(async (req, res) => {
  const certificateId = parseInt(req.params.certificateId);
  const user = (req as any).user;

  const html = await certificateService.renderCertificate(
    certificateId,
    user.id,
    user.isAdmin,
    user.isInstructor
  );

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}));

// =========================================================================
// INSTRUCTOR ROUTES
// =========================================================================

// Issue certificate to student
router.post('/issue', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const data = issueCertificateSchema.parse(req.body);

  const certificate = await certificateService.issueCertificate(
    data,
    user.isAdmin,
    user.isInstructor
  );
  res.status(201).json({ success: true, data: certificate });
}));

// =========================================================================
// TEMPLATE MANAGEMENT ROUTES
// =========================================================================

// Get all templates (instructors and admins)
router.get('/templates', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const templates = await certificateService.getTemplates(user.isAdmin);
  res.json({ success: true, data: templates });
}));

// Get single template
router.get('/templates/:templateId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const templateId = parseInt(req.params.templateId);
  const template = await certificateService.getTemplate(templateId);
  res.json({ success: true, data: template });
}));

// Create template (instructors and admins)
router.post('/templates', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const data = createTemplateSchema.parse(req.body);

  const template = await certificateService.createTemplate(data, user.isAdmin);
  res.status(201).json({ success: true, data: template });
}));

// Update template (instructors and admins)
router.put('/templates/:templateId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const templateId = parseInt(req.params.templateId);
  const user = (req as any).user;
  const data = createTemplateSchema.partial().extend({
    isActive: z.boolean().optional(),
  }).parse(req.body);

  const template = await certificateService.updateTemplate(templateId, data, user.isAdmin);
  res.json({ success: true, data: template });
}));

// Delete template (instructors and admins)
router.delete('/templates/:templateId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const templateId = parseInt(req.params.templateId);
  const user = (req as any).user;

  const result = await certificateService.deleteTemplate(templateId, user.isAdmin);
  res.json({ success: true, ...result });
}));

// Revoke certificate
router.delete('/:certificateId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const certificateId = parseInt(req.params.certificateId);
  const user = (req as any).user;

  const result = await certificateService.revokeCertificate(certificateId, user.isAdmin);
  res.json({ success: true, ...result });
}));

export default router;
