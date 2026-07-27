#!/usr/bin/env node
/**
 * Generate the OIDC provider signing key and a relying-party client credential.
 *
 *   node scripts/generate-oidc-keys.mjs --issuer https://laila.example \
 *                                       --redirect https://chatoyon.example/api/auth/sso/CLIENT/callback
 *
 * Prints two blocks: one to paste into LAILA's .env, one to hand to the
 * relying party. The client SECRET is printed once and never stored — LAILA
 * keeps only its sha256, so losing it means issuing a new one.
 *
 * The redirect URI is not known until the relying party has created its
 * provider row (chatoyon's callback path embeds the provider's uuid), so the
 * usual order is: run this without --redirect, register in chatoyon, then
 * re-run with the real URI.
 */
import { generateKeyPairSync, createHash, createPublicKey, randomBytes } from 'node:crypto';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const issuer = (arg('issuer') || 'http://localhost:5001').replace(/\/+$/, '');
const redirect = arg('redirect') || 'http://localhost:3000/api/auth/sso/REPLACE_WITH_PROVIDER_ID/callback';
const clientId = arg('client-id') || 'chatoyon';

// 2048 is the RS256 floor every relying party accepts; 3072 costs nothing here
// because we sign a handful of tokens per login, not per request.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
const kid = createHash('sha256').update(publicPem).digest('base64url').slice(0, 16);

// base64 so the multi-line PEM survives .env parsing intact.
const privateB64 = Buffer.from(privatePem, 'utf8').toString('base64');

const clientSecret = randomBytes(32).toString('base64url');
const clientSecretHash = createHash('sha256').update(clientSecret).digest('hex');

const clients = JSON.stringify([
  { clientId, name: 'chatoyon', clientSecretHash, redirectUris: [redirect] },
]);

console.log(`
# ============================================================
# LAILA  →  server/.env
# ============================================================
OIDC_ISSUER=${issuer}
OIDC_KEY_ID=${kid}
OIDC_PRIVATE_KEY=${privateB64}
OIDC_CLIENTS=${clients}

# ============================================================
# chatoyon  →  IdentityProvider row (configJson)
# ------------------------------------------------------------
# Run this in the chatoyon repo:
#
#   node --env-file=.env scripts/add-laila-idp.mjs \\
#     --issuer ${issuer} \\
#     --client-id ${clientId} \\
#     --client-secret ${clientSecret} \\
#     --base-url https://chatoyon.example
#
# It prints the callback URL to put in --redirect when you re-run this script.
# ============================================================
#
#   client_id      ${clientId}
#   client_secret  ${clientSecret}
#                  ^ shown ONCE. LAILA stores only sha256(secret).
#   redirect_uri   ${redirect}
`);

if (redirect.includes('REPLACE_WITH_PROVIDER_ID')) {
  console.error(
    'NOTE: no --redirect given, so OIDC_CLIENTS contains a placeholder redirect URI.\n' +
      '      Register the provider in chatoyon first, then re-run with the real callback URL.\n' +
      '      An unregistered redirect_uri is rejected at /api/oidc/authorize by design.\n'
  );
}
