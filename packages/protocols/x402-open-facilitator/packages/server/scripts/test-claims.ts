/**
 * Test script for the claims system
 *
 * Prerequisites:
 * 1. Server running on localhost:5002
 * 2. At least one facilitator created
 *
 * Run: npx tsx scripts/test-claims.ts
 */

const API_BASE = process.env.API_URL || 'http://localhost:5002';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`\n${msg}`);
}

function success(name: string, data?: unknown) {
  console.log(`  ✅ ${name}`);
  results.push({ name, passed: true, data });
}

function fail(name: string, error: string) {
  console.log(`  ❌ ${name}: ${error}`);
  results.push({ name, passed: false, error });
}

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function testRefundConfig(facilitatorId: string, cookie: string) {
  log('Testing Refund Config...');

  // Get config
  const { response: getRes, data: getConfig } = await request(
    `/api/admin/facilitators/${facilitatorId}/refunds/config`,
    { headers: { Cookie: cookie } }
  );

  if (getRes.ok) {
    success('GET refund config', getConfig);
  } else {
    fail('GET refund config', getConfig?.error || getRes.statusText);
    return;
  }

  // Enable refunds
  const { response: enableRes, data: enableConfig } = await request(
    `/api/admin/facilitators/${facilitatorId}/refunds/config`,
    {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({ enabled: true }),
    }
  );

  if (enableRes.ok && enableConfig?.enabled) {
    success('Enable refunds', enableConfig);
  } else {
    fail('Enable refunds', enableConfig?.error || 'Not enabled');
  }
}

async function testRefundWallets(facilitatorId: string, cookie: string) {
  log('Testing Refund Wallets...');

  // Get wallets
  const { response: listRes, data: walletsList } = await request(
    `/api/admin/facilitators/${facilitatorId}/refunds/wallets`,
    { headers: { Cookie: cookie } }
  );

  if (listRes.ok) {
    success('GET refund wallets', walletsList);
  } else {
    fail('GET refund wallets', walletsList?.error || listRes.statusText);
    return;
  }

  // Generate wallet for Base (if not exists)
  const hasBaseWallet = walletsList.wallets?.some((w: { network: string }) => w.network === 'base');

  if (!hasBaseWallet) {
    const { response: genRes, data: genWallet } = await request(
      `/api/admin/facilitators/${facilitatorId}/refunds/wallets`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({ network: 'base' }),
      }
    );

    if (genRes.ok || genRes.status === 201) {
      success('Generate Base refund wallet', genWallet);
    } else {
      fail('Generate Base refund wallet', genWallet?.error || genRes.statusText);
    }
  } else {
    success('Base wallet already exists', { skipped: true });
  }

  // Generate wallet for Solana (if not exists)
  const hasSolanaWallet = walletsList.wallets?.some((w: { network: string }) => w.network === 'solana');

  if (!hasSolanaWallet) {
    const { response: genRes, data: genWallet } = await request(
      `/api/admin/facilitators/${facilitatorId}/refunds/wallets`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({ network: 'solana' }),
      }
    );

    if (genRes.ok || genRes.status === 201) {
      success('Generate Solana refund wallet', genWallet);
    } else {
      fail('Generate Solana refund wallet', genWallet?.error || genRes.statusText);
    }
  } else {
    success('Solana wallet already exists', { skipped: true });
  }
}

async function testRegisteredServers(facilitatorId: string, cookie: string): Promise<string | null> {
  log('Testing Registered Servers...');

  // Get servers
  const { response: listRes, data: serversList } = await request(
    `/api/admin/facilitators/${facilitatorId}/servers`,
    { headers: { Cookie: cookie } }
  );

  if (listRes.ok) {
    success('GET registered servers', serversList);
  } else {
    fail('GET registered servers', serversList?.error || listRes.statusText);
    return null;
  }

  // Register a test server
  const testUrl = `https://test-server-${Date.now()}.example.com`;
  const { response: regRes, data: regServer } = await request(
    `/api/admin/facilitators/${facilitatorId}/servers`,
    {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({
        url: testUrl,
        name: 'Test Server',
      }),
    }
  );

  if (regRes.ok || regRes.status === 201) {
    success('Register server', { ...regServer, apiKey: regServer.apiKey ? '***hidden***' : undefined });
    return regServer.apiKey;
  } else {
    fail('Register server', regServer?.error || regRes.statusText);
    return null;
  }
}

async function testReportFailure(apiKey: string) {
  log('Testing Report Failure (SDK endpoint)...');

  const testTxHash = `0x${Date.now().toString(16)}${'0'.repeat(48)}`;

  const { response, data } = await request('/claims/report-failure', {
    method: 'POST',
    headers: {
      'X-Server-Api-Key': apiKey,
    },
    body: JSON.stringify({
      originalTxHash: testTxHash,
      userWallet: '0x1234567890123456789012345678901234567890',
      amount: '1000000', // $1 USDC
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'base',
      reason: 'Test failure from test script',
    }),
  });

  if (response.ok || response.status === 201) {
    success('Report failure', data);
    return data.claimId;
  } else {
    fail('Report failure', data?.error || response.statusText);
    return null;
  }
}

async function testClaims(facilitatorId: string, cookie: string, claimId: string | null) {
  log('Testing Claims Management...');

  // Get claims
  const { response: listRes, data: claimsList } = await request(
    `/api/admin/facilitators/${facilitatorId}/refunds/claims`,
    { headers: { Cookie: cookie } }
  );

  if (listRes.ok) {
    success('GET claims', { count: claimsList.claims?.length, stats: claimsList.stats });
  } else {
    fail('GET claims', claimsList?.error || listRes.statusText);
    return;
  }

  if (!claimId) {
    console.log('  ⚠️  No claim to test approve/reject/payout');
    return;
  }

  // Approve claim
  const { response: approveRes, data: approveData } = await request(
    `/api/admin/facilitators/${facilitatorId}/refunds/claims/${claimId}/approve`,
    {
      method: 'POST',
      headers: { Cookie: cookie },
    }
  );

  if (approveRes.ok) {
    success('Approve claim', approveData);
  } else {
    fail('Approve claim', approveData?.error || approveRes.statusText);
  }

  // Note: Payout would fail without funded wallet, so just test the endpoint returns expected error
  const { response: payoutRes, data: payoutData } = await request(
    `/api/admin/facilitators/${facilitatorId}/refunds/claims/${claimId}/payout`,
    {
      method: 'POST',
      headers: { Cookie: cookie },
    }
  );

  // Expecting failure due to unfunded wallet
  if (payoutRes.status === 500 && payoutData?.error?.includes('Insufficient')) {
    success('Payout (expected to fail - unfunded wallet)', payoutData);
  } else if (payoutRes.ok) {
    success('Payout succeeded (wallet was funded!)', payoutData);
  } else {
    fail('Payout', payoutData?.error || payoutRes.statusText);
  }
}

async function testPublicClaimsEndpoints() {
  log('Testing Public Claims Endpoints...');

  const testWallet = '0x1234567890123456789012345678901234567890';

  // Get claimable
  const { response: claimableRes, data: claimableData } = await request(
    `/api/claims?wallet=${testWallet}`
  );

  if (claimableRes.ok) {
    success('GET claimable claims', { count: claimableData.claims?.length });
  } else {
    fail('GET claimable claims', claimableData?.error || claimableRes.statusText);
  }

  // Get history
  const { response: historyRes, data: historyData } = await request(
    `/api/claims/history?wallet=${testWallet}`
  );

  if (historyRes.ok) {
    success('GET claims history', { count: historyData.claims?.length });
  } else {
    fail('GET claims history', historyData?.error || historyRes.statusText);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Claims System Test Script');
  console.log('='.repeat(60));
  console.log(`\nAPI Base: ${API_BASE}`);

  // Check if server is running
  try {
    const { response } = await request('/free/info');
    if (!response.ok) {
      console.error('\n❌ Server is not responding. Make sure it\'s running on ' + API_BASE);
      process.exit(1);
    }
  } catch (e) {
    console.error('\n❌ Cannot connect to server. Make sure it\'s running on ' + API_BASE);
    process.exit(1);
  }

  console.log('\n✅ Server is running');

  // For testing, we need auth. Let's check if we can get facilitators
  // In a real test, you'd need to authenticate first
  console.log('\n⚠️  This test requires authentication.');
  console.log('   To test with auth, you can:');
  console.log('   1. Login via the dashboard');
  console.log('   2. Copy your session cookie');
  console.log('   3. Set COOKIE env variable');
  console.log('   4. Re-run this script\n');

  const cookie = process.env.COOKIE || '';

  if (!cookie) {
    console.log('Testing public endpoints only (no auth)...');
    await testPublicClaimsEndpoints();
  } else {
    // Get facilitator ID
    const { response: facRes, data: facilitators } = await request(
      '/api/admin/facilitators',
      { headers: { Cookie: cookie } }
    );

    if (!facRes.ok || !facilitators?.length) {
      console.error('❌ No facilitators found. Create one first via the dashboard.');
      process.exit(1);
    }

    const facilitatorId = facilitators[0].id;
    console.log(`\nUsing facilitator: ${facilitators[0].name} (${facilitatorId})`);

    // Run tests
    await testRefundConfig(facilitatorId, cookie);
    await testRefundWallets(facilitatorId, cookie);
    const apiKey = await testRegisteredServers(facilitatorId, cookie);

    let claimId: string | null = null;
    if (apiKey) {
      claimId = await testReportFailure(apiKey);
    }

    await testClaims(facilitatorId, cookie, claimId);
    await testPublicClaimsEndpoints();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
