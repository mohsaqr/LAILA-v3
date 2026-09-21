#!/usr/bin/env npx tsx
/**
 * System Verification Script
 * Run this before/after changes to ensure the system is operational
 *
 * Usage: npx tsx scripts/verify-system.ts [--url=http://localhost:5001]
 */

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:5001';

interface Check {
  name: string;
  test: () => Promise<{ pass: boolean; message: string }>;
}

const checks: Check[] = [
  {
    name: 'Server Running',
    test: async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json();
        return {
          pass: res.ok && data.status === 'healthy',
          message: res.ok ? `Status: ${data.status}` : `HTTP ${res.status}`,
        };
      } catch (e: any) {
        return { pass: false, message: e.message };
      }
    },
  },
  {
    name: 'Database Connected',
    test: async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json();
        const dbStatus = data.checks?.database?.status;
        const latency = data.checks?.database?.latencyMs;
        return {
          pass: dbStatus === 'healthy',
          message: dbStatus === 'healthy' ? `Latency: ${latency}ms` : `Status: ${dbStatus}`,
        };
      } catch (e: any) {
        return { pass: false, message: e.message };
      }
    },
  },
  {
    name: 'Auth Endpoint',
    test: async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
        });
        // Expecting 401 (invalid credentials) - means endpoint works
        return {
          pass: res.status === 401 || res.status === 429,
          message: res.status === 401 ? 'Endpoint responding' : `HTTP ${res.status}`,
        };
      } catch (e: any) {
        return { pass: false, message: e.message };
      }
    },
  },
  {
    name: 'Courses Endpoint',
    test: async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/courses`);
        return {
          pass: res.ok || res.status === 429,
          message: res.ok ? 'Endpoint responding' : `HTTP ${res.status}`,
        };
      } catch (e: any) {
        return { pass: false, message: e.message };
      }
    },
  },
  {
    name: 'Rate Limiting Active',
    test: async () => {
      // This check used to hardcode `pass: true` and answer "Could not test
      // rate limiting" from its own catch block, so it reported green whether
      // the limiter was mounted, misconfigured or absent. It verified nothing.
      //
      // Tripping a limit is the wrong probe anyway: `/api` allows 300 req/min,
      // so a burst of 10 proves nothing, and a burst of 301 would poison the
      // window for whoever runs this next. Instead assert the evidence the
      // limiter leaves on every response — express-rate-limit is configured
      // with `standardHeaders: true`, so a mounted limiter MUST emit
      // RateLimit-Policy/Limit. Absent headers mean no limiter is in the chain,
      // which is a real finding on a public deployment.
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const policy = res.headers.get('ratelimit-policy');
        const limit = res.headers.get('ratelimit-limit');
        if (!policy && !limit) {
          return {
            pass: false,
            message: 'No RateLimit-* headers — the limiter is not mounted on /api',
          };
        }
        return { pass: true, message: `Policy: ${policy ?? `limit ${limit}`}` };
      } catch (e: any) {
        // A failure to reach the server is a failure, not an excuse.
        return { pass: false, message: `Could not test rate limiting: ${e?.message ?? e}` };
      }
    },
  },
  {
    name: 'Memory Usage',
    test: async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json();
        const heapUsed = data.checks?.memory?.heapUsed;
        const heapTotal = data.checks?.memory?.heapTotal;
        const usage = heapTotal ? Math.round((heapUsed / heapTotal) * 100) : 0;
        return {
          pass: usage < 90,
          message: `${heapUsed}MB / ${heapTotal}MB (${usage}%)`,
        };
      } catch (e: any) {
        return { pass: false, message: e.message };
      }
    },
  },
];

async function runChecks() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              LAILA System Verification                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`  Target: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    process.stdout.write(`  ${check.name.padEnd(25)}`);

    try {
      const result = await check.test();
      if (result.pass) {
        console.log(`✅ ${result.message}`);
        passed++;
      } else {
        console.log(`❌ ${result.message}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      failed++;
    }
  }

  console.log('\n  ─────────────────────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('  ⚠️  Some checks failed. Review the issues above.\n');
    process.exit(1);
  } else {
    console.log('  ✅ All checks passed. System is operational.\n');
    process.exit(0);
  }
}

runChecks().catch(err => {
  console.error('  ❌ Verification failed:', err.message);
  process.exit(1);
});
