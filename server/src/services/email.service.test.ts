import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above ordinary const declarations, so the spies these
// factories close over must be created with vi.hoisted().
const { createTransport, sendMail, warn } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn().mockResolvedValue({ messageId: 'x' }),
  warn: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: (opts: unknown) => { createTransport(opts); return { sendMail }; } },
}));

vi.mock('../utils/prisma.js', () => ({ prisma: { user: { findUnique: vi.fn() } }, default: {} }));

vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({ warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { EmailService } from './email.service.js';

const SMTP_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM'];

beforeEach(() => {
  vi.clearAllMocks();
  SMTP_VARS.forEach((v) => delete process.env[v]);
});

describe('transporter configuration', () => {
  it('does not configure a transport when SMTP_HOST is absent', () => {
    new EmailService();
    expect(createTransport).not.toHaveBeenCalled();
  });

  // A relay that authenticates by IP has no username. Requiring one used to
  // classify such a deployment as "unconfigured" and silently drop its mail.
  it('configures a transport from the host alone, with no credentials', () => {
    process.env.SMTP_HOST = 'mail.internal';
    new EmailService();
    expect(createTransport).toHaveBeenCalledTimes(1);
    const opts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.host).toBe('mail.internal');
    expect(opts.port).toBe(587);
    expect(opts.auth).toBeUndefined();
  });

  it('passes credentials through when a user is set', () => {
    Object.assign(process.env, { SMTP_HOST: 'mail.internal', SMTP_USER: 'u', SMTP_PASS: 'p' });
    new EmailService();
    expect((createTransport.mock.calls[0][0] as any).auth).toEqual({ user: 'u', pass: 'p' });
  });

  it('infers implicit TLS from port 465', () => {
    Object.assign(process.env, { SMTP_HOST: 'mail.internal', SMTP_PORT: '465' });
    new EmailService();
    expect((createTransport.mock.calls[0][0] as any).secure).toBe(true);
  });

  it('leaves TLS off for other ports', () => {
    Object.assign(process.env, { SMTP_HOST: 'mail.internal', SMTP_PORT: '587' });
    new EmailService();
    expect((createTransport.mock.calls[0][0] as any).secure).toBe(false);
  });

  it.each([
    ['enables TLS on a non-standard port', '8465', '1', true],
    ['disables TLS even on 465', '465', '0', false],
  ])('SMTP_SECURE overrides port inference: %s', (_label, port, secure, expected) => {
    Object.assign(process.env, { SMTP_HOST: 'mail.internal', SMTP_PORT: port, SMTP_SECURE: secure });
    new EmailService();
    expect((createTransport.mock.calls[0][0] as any).secure).toBe(expected);
  });

  it('never logs the SMTP username', () => {
    Object.assign(process.env, { SMTP_HOST: 'mail.internal', SMTP_USER: 'secret-user', SMTP_PASS: 'pw' });
    new EmailService();
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain('secret-user');
    expect(logged).not.toContain('pw');
  });
});

describe('sendEmail without SMTP', () => {
  // register() emails a 6-digit code and swallows failures. If the body is not
  // logged, an unconfigured deployment strands every new account permanently.
  it('logs the message body so a verification code is still reachable', async () => {
    const sent = await new EmailService().sendEmail({
      to: 'learner@laila.example',
      subject: '123456 is your verification code',
      text: 'Your verification code is: 123456',
    });

    expect(sent).toBe(false);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('123456');
    expect(logged).toContain('learner@laila.example');
  });

  it('resolves rather than throwing, so registration is not aborted', async () => {
    await expect(
      new EmailService().sendEmail({ to: 'a@b.c', subject: 's', text: 't' })
    ).resolves.toBe(false);
  });
});

describe('sendEmail with SMTP', () => {
  it('sends through the transport and reports success', async () => {
    process.env.SMTP_HOST = 'mail.internal';
    process.env.SMTP_FROM = 'noreply@laila.example';
    const sent = await new EmailService().sendEmail({ to: 'a@b.c', subject: 's', text: 't' });
    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect((sendMail.mock.calls[0][0] as any).from).toContain('noreply@laila.example');
  });
});
