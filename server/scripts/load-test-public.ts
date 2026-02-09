#!/usr/bin/env npx tsx
/**
 * Load Test - Public Endpoints Only
 * Tests raw server capacity without authentication overhead
 */

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:5001';
const CONCURRENT_USERS = parseInt(process.argv.find(a => a.startsWith('--users='))?.split('=')[1] || '50');
const DURATION_SECONDS = parseInt(process.argv.find(a => a.startsWith('--duration='))?.split('=')[1] || '20');

interface Stats {
  total: number;
  success: number;
  failed: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  latencies: number[];
}

const stats: Stats = {
  total: 0,
  success: 0,
  failed: 0,
  totalDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  latencies: [],
};

let running = true;

async function makeRequest(endpoint: string): Promise<{ success: boolean; duration: number }> {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const duration = Date.now() - start;
    return { success: response.ok, duration };
  } catch {
    return { success: false, duration: Date.now() - start };
  }
}

async function simulateUser() {
  // Only test public endpoints that don't require auth
  const endpoints = [
    '/api/health',
    '/api/courses',
    '/api/settings/public',
  ];

  while (running) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const result = await makeRequest(endpoint);

    stats.total++;
    stats.totalDuration += result.duration;
    stats.minDuration = Math.min(stats.minDuration, result.duration);
    stats.maxDuration = Math.max(stats.maxDuration, result.duration);
    stats.latencies.push(result.duration);

    if (result.success) {
      stats.success++;
    } else {
      stats.failed++;
    }

    // Small delay to simulate realistic usage
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  }
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           LAILA API Load Test (Public Endpoints)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`  Target:     ${BASE_URL}`);
  console.log(`  Users:      ${CONCURRENT_USERS} concurrent`);
  console.log(`  Duration:   ${DURATION_SECONDS} seconds`);
  console.log(`  Endpoints:  /api/health, /api/courses, /api/settings/public\n`);

  // Verify server
  const health = await makeRequest('/api/health');
  if (!health.success) {
    console.error('  ❌ Server not reachable\n');
    process.exit(1);
  }
  console.log('  ✓ Server is healthy\n');

  console.log('  Running test...\n');
  const startTime = Date.now();

  // Progress display
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = stats.total / elapsed;
    const errorRate = stats.total > 0 ? (stats.failed / stats.total * 100) : 0;
    process.stdout.write(`\r  RPS: ${rps.toFixed(0).padStart(4)} | Total: ${stats.total.toString().padStart(5)} | Errors: ${errorRate.toFixed(1)}%  `);
  }, 200);

  // Start users
  const users = Array.from({ length: CONCURRENT_USERS }, () => simulateUser());

  // Wait for duration
  await new Promise(resolve => setTimeout(resolve, DURATION_SECONDS * 1000));
  running = false;
  await Promise.all(users);

  clearInterval(progressInterval);
  console.log('\n');

  // Results
  const elapsed = (Date.now() - startTime) / 1000;
  const rps = stats.total / elapsed;
  const avgLatency = stats.total > 0 ? stats.totalDuration / stats.total : 0;
  const p50 = percentile(stats.latencies, 50);
  const p95 = percentile(stats.latencies, 95);
  const p99 = percentile(stats.latencies, 99);
  const errorRate = stats.total > 0 ? (stats.failed / stats.total * 100) : 0;

  console.log('  ╔═══════════════════════════════════════════════════════════╗');
  console.log('  ║                      RESULTS                              ║');
  console.log('  ╠═══════════════════════════════════════════════════════════╣');
  console.log(`  ║  Total Requests:        ${stats.total.toString().padStart(7)}                        ║`);
  console.log(`  ║  Requests/sec:          ${rps.toFixed(1).padStart(7)}                        ║`);
  console.log(`  ║  Error Rate:            ${errorRate.toFixed(2).padStart(6)}%                        ║`);
  console.log('  ╠═══════════════════════════════════════════════════════════╣');
  console.log(`  ║  Avg Latency:           ${avgLatency.toFixed(1).padStart(6)} ms                       ║`);
  console.log(`  ║  P50 Latency:           ${p50.toString().padStart(6)} ms                       ║`);
  console.log(`  ║  P95 Latency:           ${p95.toString().padStart(6)} ms                       ║`);
  console.log(`  ║  P99 Latency:           ${p99.toString().padStart(6)} ms                       ║`);
  console.log(`  ║  Min/Max:            ${stats.minDuration}/${stats.maxDuration.toString().padStart(4)} ms                       ║`);
  console.log('  ╠═══════════════════════════════════════════════════════════╣');

  // Capacity estimation
  const maxRPS = rps;
  const reqPerUserPerSec = 0.5; // Typical user makes ~30 requests per minute
  const estimatedUsers = Math.floor(maxRPS / reqPerUserPerSec);

  console.log('  ║              CAPACITY ESTIMATE                            ║');
  console.log('  ╠═══════════════════════════════════════════════════════════╣');
  console.log(`  ║  Sustained RPS:         ${maxRPS.toFixed(0).padStart(7)}                        ║`);
  console.log(`  ║  Concurrent Users:      ${estimatedUsers.toString().padStart(7)}  (@ 0.5 req/s each)    ║`);
  console.log(`  ║  Peak Users (burst):    ${(estimatedUsers * 2).toString().padStart(7)}                        ║`);
  console.log('  ╚═══════════════════════════════════════════════════════════╝\n');

  // Recommendations
  if (p95 > 100) {
    console.log('  💡 P95 latency is high. Consider:');
    console.log('     - Adding database indexes');
    console.log('     - Switching to PostgreSQL');
    console.log('     - Adding Redis caching\n');
  }

  if (errorRate > 1) {
    console.log('  ⚠️  Error rate above 1%. Check server logs.\n');
  }

  if (maxRPS < 100) {
    console.log('  💡 RPS is low. Bottleneck likely in:');
    console.log('     - SQLite (single-writer lock)');
    console.log('     - Single Node.js process\n');
  }
}

runTest().catch(console.error);
