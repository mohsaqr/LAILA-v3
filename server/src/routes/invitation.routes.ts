import { Router, Response } from 'express';
import { invitationService, type InvitationStatus } from '../services/invitation.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { createInvitationSchema, bulkInvitationSchema } from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

/**
 * Admin invitation management.
 *
 * There is deliberately NO public endpoint that looks an invitation up by
 * token or code. Such an endpoint would be an oracle: an attacker could probe
 * it to learn which tokens exist, and for an email-bound invitation, whose
 * address it names. An invitation is redeemed by presenting it to
 * /api/auth/register, which validates it as part of an operation that already
 * requires a full set of credentials.
 */
const router = Router();

// Every route here is admin-only.
router.use(authenticateToken, requireAdmin);

/** First entry of CLIENT_URL (which may be a comma-separated CORS list). */
function clientOrigin(): string {
  const configured = process.env.CLIENT_URL?.split(',')[0]?.trim();
  return (configured || 'http://localhost:5174').replace(/\/+$/, '');
}

/** The shareable link. The register page reads ?invite= off the query string. */
function inviteLink(token: string): string {
  return `${clientOrigin()}/register?invite=${encodeURIComponent(token)}`;
}

function actorFrom(req: AuthRequest) {
  return {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
  };
}

// List invitations, newest first. `?status=` filters to one lifecycle state.
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as InvitationStatus | undefined;
  const invitations = await invitationService.list({ status });
  res.json({
    success: true,
    data: invitations.map(inv => ({ ...inv, link: inviteLink(inv.token) })),
  });
}));

// Bulk create — one single-use invitation per address.
// Declared BEFORE '/:id/revoke' so the literal path is not read as an id.
router.post('/bulk', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { emails, ...options } = bulkInvitationSchema.parse(req.body);
  const result = await invitationService.createBulk(emails, options, actorFrom(req));

  // The plaintext codes exist only in this response. There is no second
  // chance to read them, which is exactly why they are not persisted.
  res.status(201).json({
    success: true,
    data: {
      created: result.created.map(({ invitation, code }) => ({
        invitation,
        code,
        link: inviteLink(invitation.token),
      })),
      failed: result.failed,
    },
  });
}));

// Create one invitation. The response carries the plaintext code exactly once.
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createInvitationSchema.parse(req.body);
  const { invitation, code } = await invitationService.create(data, actorFrom(req));
  res.status(201).json({
    success: true,
    data: { invitation, code, link: inviteLink(invitation.token) },
  });
}));

// Withdraw an invitation. The row is kept (see invitation.service.revoke).
router.post('/:id/revoke', asyncHandler(async (req: AuthRequest, res: Response) => {
  const invitation = await invitationService.revoke(Number(req.params.id), actorFrom(req));
  res.json({ success: true, data: { ...invitation, link: inviteLink(invitation.token) } });
}));

export default router;
