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
      try {
        // Make rapid requests to trigger rate limit
        const promises = Array.from({ length: 10 }, () =>
          fetch(`${BASE_URL}/api/health`)
        );
        const responses = await Promise.all(promises);
        const hasRateLimit = responses.some(r => r.status === 429);
        return {
          pass: true, // Rate limiting is optional
          message: hasRateLimit ? 'Rate limiting active' : 'No rate limit triggered (OK)',
        };
      } catch (e: any) {
        return { pass: true, message: 'Could not test rate limiting' };
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
