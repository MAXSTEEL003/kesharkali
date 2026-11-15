// tests/test_customer_subpo_loading.cjs
const assert = require('node:assert');
const http = require('node:http');
const db = require('../server/db');

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost',
            port: 5000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTests() {
    console.log('=== Starting Customer, Sub-PO & Loading Integration Tests ===');

    // 1. Verify Customers Master
    console.log('\nTest 1: Verify all 41 authentic customers exist and 0 synthetic "& X others" exist');
    const custRes = await request('GET', '/api/customers');
    assert.strictEqual(custRes.status, 200, 'GET /api/customers should return 200');
    const customers = custRes.body.customers;
    console.log(`  Found ${customers.length} customers in master directory.`);
    assert.strictEqual(customers.length, 41, 'There should be exactly 41 distinct customer records');

    const synthetic = customers.filter(c => c.name.includes('&') && c.name.toLowerCase().includes('other'));
    assert.strictEqual(synthetic.length, 0, 'No synthetic "& X other" records should exist');
    console.log('  ✅ No synthetic customers found. All 41 real buyers present.');

    // 2. Verify Customer Detail with Sub-Orders
    console.log('\nTest 2: Verify Customer Detail returns constituent sub-orders');
    const princeCust = customers.find(c => c.name === 'PRINCE TRADING CO');
    assert(princeCust, 'PRINCE TRADING CO should exist in customers');
    const detailRes = await request('GET', `/api/customers/${princeCust.id}`);
    assert.strictEqual(detailRes.status, 200);
    assert(detailRes.body.subOrders && detailRes.body.subOrders.length > 0, 'Customer should have sub-orders');
    console.log(`  PRINCE TRADING CO has ${detailRes.body.subOrders.length} sub-orders:`);
    detailRes.body.subOrders.forEach(s => console.log(`    - Sub ${s.sub_order_no} under PO ${s.po_number}: ${s.ordered_quantity} QTL (${s.product_name})`));
    console.log('  ✅ Customer sub-orders accurately linked.');

    // Clean up any stray test loadings for TC-3411 before starting
    const preExisting = db.query("SELECT id FROM loading_entries WHERE vehicle_number LIKE 'KA-01-AB-%'");
    for (const row of preExisting) {
        db.run('DELETE FROM loading_entries WHERE id = ?', [row.id]);
    }
    db.run("UPDATE po_sub_orders SET loaded_quantity = 0, status = 'Pending' WHERE sub_order_no = 'BRI-0001'");

    let loadingId1 = null;
    let loadingId2 = null;

    try {
        // 3. Test Partial Loading of a Sub-PO
        console.log('\nTest 3: Partial Loading for Sub-PO BRI-0001 (Ordered: 18.20 QTL)');
        const poListRes = await request('GET', '/api/purchase-orders');
        const po3411 = poListRes.body.purchaseOrders.find(p => p.po_number === 'TC-3411');
        assert(po3411, 'PO TC-3411 must exist');

        const indRes = await request('GET', '/api/industries');
        const defaultInd = indRes.body.industries.find(i => i.is_default === 1) || indRes.body.industries[0];
        assert(defaultInd, 'Default industry must exist');
        console.log(`  Default Industry: ${defaultInd.name} (ID: ${defaultInd.id})`);

        // Load 10.00 QTL (partial load out of 18.20 QTL)
        const load1Res = await request('POST', '/api/loading-register', {
            po_id: po3411.id,
            sub_order_no: 'BRI-0001',
            industry_id: defaultInd.id,
            loading_date: '2026-11-16',
            fulfillment_type: 'Direct',
            loading_location: 'Mill Facility',
            vehicle_number: 'KA-01-AB-1234',
            driver_phone: '+91 98800 11111',
            loading_quantity: 10.00,
            purchase_rate: 12000,
            remarks: 'Partial load (10 QTL out of 18.20 QTL). Remaining 8.20 QTL after 3 days.'
        });

        assert.strictEqual(load1Res.status, 201, `Loading entry should succeed: ${JSON.stringify(load1Res.body)}`);
        loadingId1 = load1Res.body.id;
        console.log(`  Created Loading Entry ${load1Res.body.loadingNumber} (ID: ${loadingId1}) for 10.00 QTL.`);

        // Verify sub-order status in DB
        const subAfterLoad1 = db.get("SELECT loaded_quantity, status FROM po_sub_orders WHERE po_id = ? AND sub_order_no = 'BRI-0001'", [po3411.id]);
        console.log(`  Sub-Order BRI-0001 status: loaded=${subAfterLoad1.loaded_quantity} QTL, status=${subAfterLoad1.status}`);
        assert.strictEqual(subAfterLoad1.loaded_quantity, 10.00);
        assert.strictEqual(subAfterLoad1.status, 'Partially Loaded');

        // 4. Test Overload Prevention on Sub-Order
        console.log('\nTest 4: Overload Prevention check on Sub-Order BRI-0001');
        // Remaining is 8.20 QTL, try to load 15.00 QTL
        const overloadRes = await request('POST', '/api/loading-register', {
            po_id: po3411.id,
            sub_order_no: 'BRI-0001',
            industry_id: defaultInd.id,
            loading_date: '2026-11-16',
            fulfillment_type: 'Direct',
            loading_location: 'Mill Facility',
            vehicle_number: 'KA-01-AB-9999',
            driver_phone: '+91 98800 11111',
            loading_quantity: 15.00,
            purchase_rate: 12000
        });
        assert.strictEqual(overloadRes.status, 400, 'Overloading should be rejected with 400');
        console.log(`  ✅ Overload prevented: "${overloadRes.body.error}"`);

        // 5. Load remaining 8.20 QTL after 3 days
        console.log('\nTest 5: Load remaining 8.20 QTL after 3 days for Sub-Order BRI-0001');
        const load2Res = await request('POST', '/api/loading-register', {
            po_id: po3411.id,
            sub_order_no: 'BRI-0001',
            industry_id: defaultInd.id,
            loading_date: '2026-11-19',
            fulfillment_type: 'Direct',
            loading_location: 'Mill Facility',
            vehicle_number: 'KA-01-AB-5678',
            driver_phone: '+91 98800 22222',
            loading_quantity: 8.20,
            purchase_rate: 12000,
            remarks: 'Remaining balance load after 3 days'
        });
        assert.strictEqual(load2Res.status, 201);
        loadingId2 = load2Res.body.id;

        const subAfterLoad2 = db.get("SELECT loaded_quantity, status FROM po_sub_orders WHERE po_id = ? AND sub_order_no = 'BRI-0001'", [po3411.id]);
        console.log(`  Sub-Order BRI-0001 status after 2nd load: loaded=${subAfterLoad2.loaded_quantity} QTL, status=${subAfterLoad2.status}`);
        assert.strictEqual(subAfterLoad2.loaded_quantity, 18.20);
        assert.strictEqual(subAfterLoad2.status, 'Loaded');
        console.log('  ✅ Sub-order BRI-0001 successfully transitioned to fully Loaded!');

        // 6. Test Reversal on Delete
        console.log('\nTest 6: Verify deletion reverts sub-order loaded balance cleanly');
        const delRes2 = await request('DELETE', `/api/loading-register/${loadingId2}`);
        assert.strictEqual(delRes2.status, 200);
        loadingId2 = null;

        const subAfterDel2 = db.get("SELECT loaded_quantity, status FROM po_sub_orders WHERE po_id = ? AND sub_order_no = 'BRI-0001'", [po3411.id]);
        assert.strictEqual(subAfterDel2.loaded_quantity, 10.00);
        assert.strictEqual(subAfterDel2.status, 'Partially Loaded');
        console.log(`  Reverted to: loaded=${subAfterDel2.loaded_quantity} QTL, status=${subAfterDel2.status}`);

        const delRes1 = await request('DELETE', `/api/loading-register/${loadingId1}`);
        assert.strictEqual(delRes1.status, 200);
        loadingId1 = null;

        const subAfterDel1 = db.get("SELECT loaded_quantity, status FROM po_sub_orders WHERE po_id = ? AND sub_order_no = 'BRI-0001'", [po3411.id]);
        assert.strictEqual(subAfterDel1.loaded_quantity, 0.00);
        console.log(`  Reverted to initial: loaded=${subAfterDel1.loaded_quantity} QTL`);
        console.log('  ✅ Loading deletion and reversal verified perfectly!');
    } finally {
        if (loadingId2) {
            await request('DELETE', `/api/loading-register/${loadingId2}`).catch(() => {});
        }
        if (loadingId1) {
            await request('DELETE', `/api/loading-register/${loadingId1}`).catch(() => {});
        }
        db.run("UPDATE po_sub_orders SET loaded_quantity = 0, status = 'Pending' WHERE sub_order_no = 'BRI-0001'");
    }

    console.log('\n=== ALL TESTS PASSED! ===');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
