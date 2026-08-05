#!/usr/bin/env node
/**
 * laila-backup-alert.mjs — mail a backup alarm using LAILA's own SMTP settings.
 *
 *   LAILA_SERVER_DIR=/path/to/server \
 *     node --env-file=/path/to/server/.env laila-backup-alert.mjs \
 *       <to> <subject>   < body-on-stdin
 *
 * Deliberately borrows the running app's SMTP_* configuration and its installed
 * nodemailer rather than introducing a second mail path: an alerting channel
 * with its own credentials is a second thing that can silently expire, and the
 * whole point of an alert is that it still works on the day everything else
 * does not.
 *
 * Exits non-zero if the mail could not be sent, so the audit can say so out
 * loud instead of assuming the alarm was heard.
 */
import { createRequire } from 'node:module';

// --check proves the channel works — credentials, TLS, reachability — WITHOUT
// delivering anything. Worth having: the point of an alerting path is that it
// works on the day it is needed, and "we never tested it" and "we tested it by
// spamming the on-call address" are both bad answers.
const CHECK_ONLY = process.argv.includes('--check');
const [to, subject] = process.argv.slice(2).filter((a) => a !== '--check');
if (!CHECK_ONLY && (!to || !subject)) {
  console.error('usage: laila-backup-alert.mjs <to> <subject>  (body on stdin)');
  console.error('       laila-backup-alert.mjs --check          (verify SMTP, send nothing)');
  process.exit(2);
}

const serverDir = process.env.LAILA_SERVER_DIR;
if (!serverDir) {
  console.error('LAILA_SERVER_DIR is required so nodemailer can be resolved');
  process.exit(2);
}

// Resolve nodemailer out of the app's own node_modules.
const require = createRequire(`${serverDir}/`);
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  console.error(`nodemailer is not installed under ${serverDir}/node_modules`);
  process.exit(2);
}

const body = CHECK_ONLY ? '' : await new Promise((resolve) => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', () => resolve(buf));
});

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, SMTP_FROM, EMAIL_FROM } = process.env;
if (!SMTP_HOST) {
  console.error('SMTP_HOST is not set — no mail channel is configured');
  process.exit(2);
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  // Mirrors email.service.ts: an explicit flag wins, otherwise infer from port.
  secure: SMTP_SECURE ? SMTP_SECURE === '1' : String(SMTP_PORT) === '465',
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

if (CHECK_ONLY) {
  try {
    await transport.verify();
    console.log(`SMTP OK: ${SMTP_HOST}:${SMTP_PORT || 587} accepted the credentials (nothing was sent)`);
    process.exit(0);
  } catch (err) {
    console.error(`SMTP CHECK FAILED: ${err?.message ?? err}`);
    process.exit(1);
  }
}

try {
  await transport.sendMail({
    from: SMTP_FROM || EMAIL_FROM || SMTP_USER,
    to,
    subject,
    text: body,
  });
  console.log(`alert sent to ${to}`);
} catch (err) {
  console.error(`could not send the alert: ${err?.message ?? err}`);
  process.exit(1);
}
