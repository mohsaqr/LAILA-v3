#!/usr/bin/env npx tsx
/**
 * Simple Load Test Script for LAILA API
 *
 * Usage:
 *   npx tsx scripts/load-test.ts [options]
 *
 * Options:
 *   --users=N       Number of concurrent users (default: 10)
 *   --duration=N    Test duration in seconds (default: 30)
 *   --url=URL       Base URL (default: http://localhost:5001)
 */

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:5001';
const CONCURRENT_USERS = parseInt(process.argv.find(a => a.startsWith('--users='))?.split('=')[1] || '10');
const DURATION_SECONDS = parseInt(process.argv.find(a => a.startsWith('--duration='))?.split('=')[1] || '30');

interface RequestResult {
  endpoint: string;
  status: number;
  duration: number;
  success: boolean;
  error?: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  byEndpoint: Map<string, { count: number; totalDuration: number; errors: number }>;
}

const stats: Stats = {
  total: 0,
  success: 0,
  failed: 0,
  totalDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  byEndpoint: new Map(),
};

let authToken: string | null = null;
let running = true;

async function makeRequest(method: string, endpoint: string, body?: object): Promise<RequestResult> {
  const start = Date.now();
  const url = `${BASE_URL}${endpoint}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - start;

    return {
      endpoint,
      status: response.status,
      duration,
      success: response.ok,
    };
  } catch (error: any) {
    return {
      endpoint,
      status: 0,
      duration: Date.now() - start,
      success: false,
      error: error.message,
    };
  }
}

function recordResult(result: RequestResult) {
  stats.total++;
  stats.totalDuration += result.duration;
  stats.minDuration = Math.min(stats.minDuration, result.duration);
  stats.maxDuration = Math.max(stats.maxDuration, result.duration);

  if (result.success) {
    stats.success++;
  } else {
    stats.failed++;
  }

  const endpointStats = stats.byEndpoint.get(result.endpoint) || { count: 0, totalDuration: 0, errors: 0 };
  endpointStats.count++;
  endpointStats.totalDuration += result.duration;
  if (!result.success) endpointStats.errors++;
  stats.byEndpoint.set(result.endpoint, endpointStats);
}

async function authenticate(): Promise<boolean> {
  // Try to login with test credentials
  const result = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@example.com',
    password: 'admin123',
  });

  if (result.success) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
      });
      const data = await response.json();
      authToken = data.token;
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function simulateUser(userId: number) {
  // Weighted endpoint selection (simulates real usage patterns)
  const endpoints = [
    { weight: 30, method: 'GET', path: '/api/health' },
    { weight: 20, method: 'GET', path: '/api/courses' },
    { weight: 15, method: 'GET', path: '/api/enrollments/my' },
    { weight: 10, method: 'GET', path: '/api/users/profile' },
    { weight: 10, method: 'GET', path: '/api/notifications' },
    { weight: 5, method: 'GET', path: '/api/llm/active' },
    { weight: 5, method: 'GET', path: '/api/settings/public' },
    { weight: 5, method: 'GET', path: '/api/courses?page=1&limit=10' },
  ];

  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);

  while (running) {
    // Select random endpoint based on weight
    let random = Math.random() * totalWeight;
    let selected = endpoints[0];

    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        selected = endpoint;
        break;
      }
    }

    const result = await makeRequest(selected.method, selected.path);
    recordResult(result);

    // Random delay between requests (100-500ms) to simulate real user behavior
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
  }
}

function printProgress() {
  const elapsed = (Date.now() - startTime) / 1000;
  const rps = stats.total / elapsed;
  const avgLatency = stats.total > 0 ? stats.totalDuration / stats.total : 0;
  const errorRate = stats.total > 0 ? (stats.failed / stats.total * 100) : 0;

  process.stdout.write(`\r  Requests: ${stats.total} | RPS: ${rps.toFixed(1)} | Avg: ${avgLatency.toFixed(0)}ms | Errors: ${errorRate.toFixed(1)}%  `);
}

let startTime: number;

async function runLoadTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              LAILA API Load Test                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`  Target:     ${BASE_URL}`);
  console.log(`  Users:      ${CONCURRENT_USERS} concurrent`);
  console.log(`  Duration:   ${DURATION_SECONDS} seconds\n`);

  // Check if server is running
  console.log('  [1/4] Checking server availability...');
  const healthCheck = await makeRequest('GET', '/api/health');
  if (!healthCheck.success) {
    console.error(`\n  ❌ Server not reachable at ${BASE_URL}`);
    console.error('     Make sure the server is running: npm run dev\n');
    process.exit(1);
  }
  console.log('        ✓ Server is running\n');

  // Authenticate
  console.log('  [2/4] Authenticating test user...');
  const authenticated = await authenticate();
  if (authenticated) {
    console.log('        ✓ Authenticated as admin@example.com\n');
  } else {
    console.log('        ⚠ Authentication failed - testing public endpoints only\n');
  }

  // Start load test
  console.log('  [3/4] Running load test...\n');
  startTime = Date.now();

  // Progress reporter
  const progressInterval = setInterval(printProgress, 500);

  // Start concurrent users
  const userPromises = Array.from({ length: CONCURRENT_USERS }, (_, i) => simulateUser(i));

  // Run for specified duration
  await new Promise(resolve => setTimeout(resolve, DURATION_SECONDS * 1000));
  running = false;

  // Wait for all users to finish current request
  await Promise.all(userPromises.map(p => p.catch(() => {})));

  clearInterval(progressInterval);
  console.log('\n');

  // Print results
  console.log('  [4/4] Results\n');
  printResults();
}

function printResults() {
  const elapsed = (Date.now() - startTime) / 1000;
  const rps = stats.total / elapsed;
  const avgLatency = stats.total > 0 ? stats.totalDuration / stats.total : 0;
  const errorRate = stats.total > 0 ? (stats.failed / stats.total * 100) : 0;

  console.log('  ┌─────────────────────────────────────────────────────────┐');
  console.log('  │                    SUMMARY                              │');
  console.log('  ├─────────────────────────────────────────────────────────┤');
  console.log(`  │  Total Requests:     ${stats.total.toString().padStart(8)}                        │`);
  console.log(`  │  Successful:         ${stats.success.toString().padStart(8)}                        │`);
  console.log(`  │  Failed:             ${stats.failed.toString().padStart(8)}                        │`);
  console.log(`  │  Error Rate:         ${errorRate.toFixed(2).padStart(7)}%                        │`);
  console.log('  ├─────────────────────────────────────────────────────────┤');
  console.log(`  │  Requests/sec:       ${rps.toFixed(1).padStart(8)}                        │`);
  console.log(`  │  Avg Latency:        ${avgLatency.toFixed(0).padStart(6)} ms                        │`);
  console.log(`  │  Min Latency:        ${stats.minDuration.toString().padStart(6)} ms                        │`);
  console.log(`  │  Max Latency:        ${stats.maxDuration.toString().padStart(6)} ms                        │`);
  console.log('  └─────────────────────────────────────────────────────────┘\n');

  console.log('  ┌─────────────────────────────────────────────────────────┐');
  console.log('  │                 BY ENDPOINT                             │');
  console.log('  ├─────────────────────────────────────────────────────────┤');

  for (const [endpoint, data] of stats.byEndpoint) {
    const avg = data.count > 0 ? (data.totalDuration / data.count).toFixed(0) : 0;
    const shortEndpoint = endpoint.length > 30 ? endpoint.substring(0, 27) + '...' : endpoint;
    console.log(`  │  ${shortEndpoint.padEnd(30)} ${data.count.toString().padStart(5)} reqs  ${avg.toString().padStart(4)}ms │`);
  }

  console.log('  └─────────────────────────────────────────────────────────┘\n');

  // Capacity estimate
  const estimatedMaxUsers = Math.floor(rps / 2); // Assuming 2 req/sec per active user
  console.log('  ┌─────────────────────────────────────────────────────────┐');
  console.log('  │                CAPACITY ESTIMATE                        │');
  console.log('  ├─────────────────────────────────────────────────────────┤');
  console.log(`  │  Current RPS:              ${rps.toFixed(0).padStart(6)}                      │`);
  console.log(`  │  Est. Concurrent Users:    ${estimatedMaxUsers.toString().padStart(6)}                      │`);
  console.log(`  │  Est. Active Users/hour:   ${(estimatedMaxUsers * 10).toString().padStart(6)}                      │`);
  console.log('  └─────────────────────────────────────────────────────────┘\n');

  if (errorRate > 5) {
    console.log('  ⚠️  High error rate detected. Check server logs.\n');
  }

  if (avgLatency > 500) {
    console.log('  ⚠️  High latency detected. Consider optimization.\n');
  }
}

runLoadTest().catch(console.error);
