import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * The shipped nginx configs must forward every path Express owns.
 *
 * Anything not matched by an explicit location falls into the SPA catch-all
 * and is answered with index.html from disk. That fails silently in the worst
 * way: the caller gets HTTP 200 and a page of HTML where it expected JSON, so
 * it reads as a broken client rather than a missing route.
 */

function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'deploy')) && existsSync(join(dir, 'server'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Repo root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const ROOT = repoRoot();

/** Every file that defines an nginx server block for LAILA. */
const CONFIGS = ['deploy/nginx/laila.conf', 'deploy/deploy.sh'] as const;

describe('nginx forwards the routes Express owns', () => {
  // RFC 8414 fixes the discovery path at the issuer root, so it cannot be
  // moved under /api/ with the other OIDC endpoints (index.ts mounts it with
  // `app.use('/', oidcDiscoveryRouter)`). Without an explicit location it is
  // served as index.html, and a relying party — chatoyon — cannot discover
  // LAILA at all, which breaks SSO at its very first step.
  it.each(CONFIGS)('%s proxies the OIDC discovery document', (relativePath) => {
    const conf = readFileSync(resolve(ROOT, relativePath), 'utf8');
    expect(
      conf,
      `${relativePath} must proxy /.well-known/openid-configuration, or it is served as the SPA`
    ).toContain('location = /.well-known/openid-configuration');
  });

  // An exact-match location cannot shadow the prefix location certbot needs to
  // answer an ACME challenge. A prefix match on /.well-known/ would.
  it.each(CONFIGS)('%s uses an exact match so certbot still works', (relativePath) => {
    const conf = readFileSync(resolve(ROOT, relativePath), 'utf8');
    expect(conf).not.toMatch(/location\s+\/\.well-known\/\s*\{/);
  });

  it('keeps the acme-challenge location intact', () => {
    const conf = readFileSync(resolve(ROOT, 'deploy/nginx/laila.conf'), 'utf8');
    expect(conf).toContain('location /.well-known/acme-challenge/');
  });

  // The remaining OIDC endpoints (jwks, authorize, token) live under /api/oidc
  // and are covered by the existing /api/ proxy, so only discovery needs its
  // own location. This asserts that assumption still holds.
  it('mounts every other OIDC endpoint under /api', () => {
    const routes = readFileSync(resolve(ROOT, 'server/src/index.ts'), 'utf8');
    expect(routes).toContain("app.use('/api/oidc', oidcRoutes)");
    expect(routes).toContain("app.use('/', oidcDiscoveryRouter)");
  });
});
