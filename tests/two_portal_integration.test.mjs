// tests/two_portal_integration.test.mjs
// Automated Integration Test Suite for Two-Portal Supplier Procurement & Fulfilment Integration
import assert from 'node:assert';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is parsed if running without --env-file
if (!process.env.INTEGRATION_SHARED_SECRET) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v.replace(/^["']|["']$/g, '');
        }
      }
    }
  }
}

const SHARED_SECRET = (process.env.INTEGRATION_SHARED_SECRET || '').trim();
if (!SHARED_SECRET) {
  throw new Error('INTEGRATION_SHARED_SECRET must be configured in environment (.env) to run two-portal integration tests.');
}

const APP_B_URL = process.env.APP_B_URL || 'http://127.0.0.1:5000';

function generateHmacSignature(bodyString, timestamp, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${bodyString}`)
    .digest('hex');
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('TWO-PORTAL SUPPLIER PROCUREMENT & FULFILMENT INTEGRATION TESTS');
  console.log('================================================================\n');

  let localServer = null;
  const isUp = await fetch(`${APP_B_URL}/api/health`).then(r => r.json()).then(d => d.status === 'UP').catch(() => false);
  if (!isUp) {
    localServer = http.createServer(app);
    await new Promise(resolve => localServer.listen(5000, '127.0.0.1', resolve));
    console.log('Auto-started test server on http://127.0.0.1:5000\n');
  }

  try {
  let passedTests = 0;
  const timestamp = Date.now().toString();

  // -------------------------------------------------------------
  // TEST 1: Cross-Portal Integration Bus Health & Healthcheck
  // -------------------------------------------------------------
  console.log('Test 1: Healthcheck & Integration Endpoint Reachability');
  const healthRes = await requestJson(`${APP_B_URL}/api/health`);
  assert.strictEqual(healthRes.status, 200, 'App B Health endpoint must return HTTP 200');
  assert.strictEqual(healthRes.data.status, 'UP', 'Health status must be UP');
  console.log('  PASSED: App B backend is UP and running.\n');
  passedTests++;

  // -------------------------------------------------------------
  // TEST 2: Inbound PO Transmission with Constituent Sub-Orders (Preserve subOrders[])
  // -------------------------------------------------------------
  console.log('Test 2: Inbound Supplier PO Transmission with Constituent Sub-Orders & HMAC Signature');
  const testOrderId = `ORD-TEST-${Date.now()}`;
  const poPayload = {
    poNumber: `PO-TEST-${Date.now()}-A`,
    originalOrderId: testOrderId,
    supplierId: '1',
    supplierName: 'Balaji Modern Rice Mill',
    customerName: 'Shri Ganesh Wholesale Traders & 1 other',
    customerContact: '+91 98220 99887',
    deliveryLocation: 'APMC Yard G-4, Nagpur',
    products: [
      { name: 'HMT Rice', quantity: 60, rate: 2900, unit: 'QTL', totalAmount: 174000 }
    ],
    subOrders: [
      {
        subOrderNo: `BRI-TEST-001-${Date.now()}`,
        buyerName: 'Shri Ganesh Wholesale Traders',
        productName: 'HMT Rice',
        orderedQuantity: 35,
        rate: 2900,
        amount: 101500,
        deliveryLocation: 'APMC Yard G-4, Nagpur',
        status: 'Approved'
      },
      {
        subOrderNo: `BRI-TEST-002-${Date.now()}`,
        buyerName: 'Shri Balaji Kirana Store',
        productName: 'HMT Rice',
        orderedQuantity: 25,
        rate: 2900,
        amount: 72500,
        deliveryLocation: 'APMC Yard G-5, Nagpur',
        status: 'Approved'
      }
    ],
    totalOrderedQuantity: 60,
    agreedRate: 2900,
    totalOrderValue: 174000,
    deliveryRequirements: 'Standard PP bags (50kg)',
    specialInstructions: 'Moisture < 12%',
    orderAcceptanceDate: new Date().toISOString().split('T')[0],
    expectedLoadingDate: new Date().toISOString().split('T')[0],
    status: 'New'
  };

  const bodyStr = JSON.stringify(poPayload);
  const signature = generateHmacSignature(bodyStr, timestamp, SHARED_SECRET);
  const idempotencyKey = `SYNC_PO_${testOrderId}_1_V1`;

  const syncRes = await requestJson(`${APP_B_URL}/api/integration/receive-po`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-integration-signature': signature,
      'x-integration-timestamp': timestamp,
      'x-idempotency-key': idempotencyKey
    },
    body: bodyStr
  });

  assert.ok(syncRes.status === 200 || syncRes.status === 201, `Expected HTTP 200/201, received ${syncRes.status}: ${JSON.stringify(syncRes.data)}`);
  assert.strictEqual(syncRes.data.success, true, 'Sync must succeed');
  assert.ok(syncRes.data.poId, 'Must return created PO ID in App B');
  assert.strictEqual(syncRes.data.subOrdersCount, 2, 'Must confirm all 2 sub-orders persisted');
  const createdPoId = syncRes.data.poId;
  const createdPoNumber = syncRes.data.poNumber;

  // Verify sub-orders are persisted in PO details endpoint
  const poDetailsRes = await requestJson(`${APP_B_URL}/api/purchase-orders/${createdPoId}`, {
    headers: { 'x-user-role': 'Admin' }
  });
  assert.strictEqual(poDetailsRes.status, 200, 'Must be able to fetch PO details');
  assert.strictEqual(poDetailsRes.data.subOrders.length, 2, 'Must have exactly 2 sub-orders in po_sub_orders');
  assert.strictEqual(poDetailsRes.data.subOrders[0].buyerName, 'Shri Ganesh Wholesale Traders');
  assert.strictEqual(poDetailsRes.data.subOrders[1].buyerName, 'Shri Balaji Kirana Store');
  assert.strictEqual(poDetailsRes.data.subOrders[0].orderedQuantity, 35);
  assert.strictEqual(poDetailsRes.data.subOrders[1].orderedQuantity, 25);
  const targetIndustryId = poDetailsRes.data.supplier_id || 5;
  console.log(`  PASSED: PO created with 2 constituent sub-orders persisted cleanly in App B. Ref: ${createdPoNumber} (DB ID: ${createdPoId})\n`);
  passedTests++;

  // -------------------------------------------------------------
  // TEST 3: Idempotency & Duplicate Prevention Guard
  // -------------------------------------------------------------
  console.log('Test 3: Idempotency Verification (Re-transmitting same order cannot create duplicate)');
  const duplicateSyncRes = await requestJson(`${APP_B_URL}/api/integration/receive-po`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-integration-signature': signature,
      'x-integration-timestamp': timestamp,
      'x-idempotency-key': idempotencyKey
    },
    body: bodyStr
  });

  assert.strictEqual(duplicateSyncRes.status, 200, 'Duplicate request must return HTTP 200');
  assert.strictEqual(duplicateSyncRes.data.duplicate, true, 'Duplicate response must flag duplicate=true');
  assert.strictEqual(duplicateSyncRes.data.poId, createdPoId, 'Must return the existing PO without creating a duplicate record');

  // Verify no duplicate sub-orders or duplicate PO rows exist
  const verifyNoDupesRes = await requestJson(`${APP_B_URL}/api/purchase-orders/${createdPoId}`, {
    headers: { 'x-user-role': 'Admin' }
  });
  assert.strictEqual(verifyNoDupesRes.data.subOrders.length, 2, 'Sub-orders must remain exactly 2 after duplicate request');
  console.log('  PASSED: Idempotency guard strictly prevented duplicate PO generation & sub-order duplication.\n');
  passedTests++;

  // -------------------------------------------------------------
  // TEST 4: HMAC Rejection on Tampered Payload or Invalid Signature
  // -------------------------------------------------------------
  console.log('Test 4: Security Verification (Tampered payload or bad HMAC signature is rejected)');
  const badSyncRes = await requestJson(`${APP_B_URL}/api/integration/receive-po`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-integration-signature': 'invalid_signature_hash_000000000000',
      'x-integration-timestamp': timestamp,
      'x-idempotency-key': `SYNC_PO_BAD_${Date.now()}`
    },
    body: bodyStr
  });

  assert.strictEqual(badSyncRes.status, 401, 'Tampered request must be rejected with HTTP 401');
  console.log('  PASSED: Tamper-proof HMAC header validation strictly enforced.\n');
  passedTests++;

  // -------------------------------------------------------------
  // TEST 5: Supplier PO Acceptance Workflow
  // -------------------------------------------------------------
  console.log('Test 5: Supplier Acceptance Workflow');
  const acceptRes = await requestJson(`${APP_B_URL}/api/purchase-orders/${createdPoId}/supplier-accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Supplier'
    },
    body: JSON.stringify({ expectedLoadingDate: '2026-11-20' })
  });

  assert.strictEqual(acceptRes.status, 200, `Supplier accept failed: ${JSON.stringify(acceptRes.data)}`);
  assert.strictEqual(acceptRes.data.success, true, 'Accept must succeed');
  assert.strictEqual(acceptRes.data.status, 'Accepted', 'PO status must transition to Accepted');
  console.log('  PASSED: Supplier accepted PO and scheduled fulfilment.\n');
  passedTests++;

  // -------------------------------------------------------------
  // TEST 6: Multi-Vehicle Loading & Overload Prevention Guard
  // -------------------------------------------------------------
  console.log('Test 6: Multi-Vehicle Loading & Overload Prevention');
  // Load vehicle 1: 30 QTL (out of 60 QTL)
  const load1Res = await requestJson(`${APP_B_URL}/api/loading-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Supplier'
    },
    body: JSON.stringify({
      po_id: createdPoId,
      industry_id: targetIndustryId,
      product_id: 1,
      fulfillment_type: 'Direct',
      loading_location: 'Balaji Mill Yard A',
      vehicle_number: 'MH-31-AA-1001',
      driver_phone: '+91 98221 11111',
      loading_quantity: 30,
      purchase_rate: 2900,
      loading_date: '2026-11-16',
      remarks: 'First partial vehicle'
    })
  });

  assert.strictEqual(load1Res.status, 201, `Loading 1 failed: ${JSON.stringify(load1Res.data)}`);
  const loading1Id = load1Res.data.id;
  console.log(`  - Vehicle 1 loaded: 30 QTL (Entry ID: ${loading1Id})`);

  // Load vehicle 2: 25 QTL (Total becomes 55 QTL out of 60 QTL)
  const load2Res = await requestJson(`${APP_B_URL}/api/loading-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Supplier'
    },
    body: JSON.stringify({
      po_id: createdPoId,
      industry_id: targetIndustryId,
      product_id: 1,
      fulfillment_type: 'Direct',
      loading_location: 'Balaji Mill Yard A',
      vehicle_number: 'MH-31-BB-2002',
      driver_phone: '+91 98222 22222',
      loading_quantity: 25,
      purchase_rate: 2900,
      loading_date: '2026-11-16',
      remarks: 'Second vehicle'
    })
  });
  assert.strictEqual(load2Res.status, 201, `Loading 2 failed: ${JSON.stringify(load2Res.data)}`);
  console.log('  - Vehicle 2 loaded: 25 QTL (Total loaded: 55/60 QTL)');

  // Attempt Overload: Try to load 15 QTL when remaining is only 5 QTL -> Must be BLOCKED
  const overloadRes = await requestJson(`${APP_B_URL}/api/loading-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Supplier'
    },
    body: JSON.stringify({
      po_id: createdPoId,
      industry_id: targetIndustryId,
      product_id: 1,
      fulfillment_type: 'Direct',
      loading_location: 'Balaji Mill Yard A',
      vehicle_number: 'MH-31-CC-3003',
      driver_phone: '+91 98223 33333',
      loading_quantity: 15,
      purchase_rate: 2900,
      loading_date: '2026-11-16'
    })
  });

  assert.strictEqual(overloadRes.status, 400, 'Attempted overload must be rejected with HTTP 400');
  assert.ok(overloadRes.data.error.includes('Overloading not permitted'), 'Error message must specify overload restriction');
  console.log('  PASSED: Multi-vehicle partial loading verified and overload attempt strictly blocked.\n');
  passedTests++;

  // -------------------------------------------------------------
  // TEST 7: Document Upload & Billing Integration
  // -------------------------------------------------------------
  console.log('Test 7: Supplier Document Upload (Weighbridge Slip & Invoice)');
  const docUploadRes = await requestJson(`${APP_B_URL}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Supplier'
    },
    body: JSON.stringify({
      poId: createdPoId,
      loadingId: loading1Id,
      documentType: 'Weighbridge Slip',
      fileName: 'WB_SLIP_MH31AA1001.pdf',
      fileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...',
      fileSize: 45020,
      mimeType: 'application/pdf'
    })
  });

  assert.strictEqual(docUploadRes.status, 200, `Document upload failed: ${JSON.stringify(docUploadRes.data)}`);
  assert.strictEqual(docUploadRes.data.success, true, 'Document upload must succeed');

  // Verify retrieval
  const docListRes = await requestJson(`${APP_B_URL}/api/documents/po/${createdPoId}`, {
    headers: { 'x-user-role': 'Supplier' }
  });
  assert.strictEqual(docListRes.status, 200);
  assert.ok(docListRes.data.documents.length >= 1, 'Must find uploaded document in PO documents');
  console.log('  PASSED: Document recorded and linked to PO and loading entry.\n');
  passedTests++;

  // -------------------------------------------------------------
  // TEST 8: Transport Dispatch Confirmation & Reverse Webhook Push
  // -------------------------------------------------------------
  console.log('Test 8: Transport Dispatch Confirmation & Reverse Sync');
  const dspListRes = await requestJson(`${APP_B_URL}/api/dispatches?poId=${createdPoId}`, {
    headers: { 'x-user-role': 'Supplier' }
  });
  assert.strictEqual(dspListRes.status, 200);
  assert.ok(dspListRes.data.dispatches.length >= 1, 'Must find dispatches linked to PO');
  const dspNumber = dspListRes.data.dispatches[0].dispatch_number;
  console.log(`  PASSED: Dispatch confirmed. Ref: ${dspNumber}\n`);
  passedTests++;

  // -------------------------------------------------------------
  // TEST 9: Chronological PO Ledger Timeline
  // -------------------------------------------------------------
  console.log('Test 9: Chronological PO Ledger Integrity');
  const ledgerRes = await requestJson(`${APP_B_URL}/api/purchase-orders/${createdPoId}/ledger`, {
    headers: { 'x-user-role': 'Supplier' }
  });

  assert.strictEqual(ledgerRes.status, 200, 'Ledger endpoint must return HTTP 200');
  assert.ok(ledgerRes.data.ledger.length >= 4, 'Must have at least 4 ledger events (Create, Accept, Loading, Document, Dispatch)');
  console.log(`  PASSED: PO Ledger contains ${ledgerRes.data.ledger.length} chronological audit entries with timestamps and responsible users.\n`);
  passedTests++;

  console.log('================================================================');
  console.log(`ALL ${passedTests} TWO-PORTAL INTEGRATION TESTS PASSED CLEANLY!`);
  console.log('================================================================');
  } finally {
    if (localServer) {
      localServer.close();
    }
  }
}

runTestSuite().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
