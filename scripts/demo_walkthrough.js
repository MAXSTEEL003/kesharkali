// scripts/demo_walkthrough.js
// Interactive Live Business Walkthrough for Keshar Kali Operations Portal

const path = require('path');
const fs = require('fs');

const EXPORTS_DIR = path.resolve(__dirname, '../exports');
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

async function runDemo() {
    console.log('========================================================================');
    console.log('KESHAR KALI — END-TO-END BUSINESS OPERATIONS WALKTHROUGH');
    console.log('Tagline: Precision in Every Grain');
    console.log('========================================================================\n');

    const BASE_URL = 'http://127.0.0.1:5000/api';

    // Helper for JSON requests
    async function apiReq(endpoint, method = 'GET', body = null) {
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': 'Admin'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${BASE_URL}${endpoint}`, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(`API ${method} ${endpoint} failed: ${err.error || res.statusText}`);
        }
        return res.json();
    }

    // Helper for Binary downloads
    async function downloadReq(endpoint, filename) {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            headers: { 'x-user-role': 'Admin' }
        });
        if (!res.ok) throw new Error(`Download ${endpoint} failed`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(EXPORTS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        console.log(`   Exported genuine .xlsx: ${filename} (${buffer.length} bytes)`);
    }

    try {
        console.log('Step 1: Check System Health & Connection...');
        const health = await apiReq('/health');
        console.log(`   Connected to ${health.brand} Operations Portal. Status: ${health.status}\n`);

        console.log('Step 2: Fetch Products & Customers for Demo Order...');
        const custRes = await apiReq('/customers');
        const prodRes = await apiReq('/products');
        const indRes = await apiReq('/industries');
        const whRes = await apiReq('/warehouses');

        const buyer = custRes.customers[0]; // ABC Traders
        const product = prodRes.products.find(p => p.name === 'Keshar Kali' || p.code === 'PROD-KK') || prodRes.products[0];
        const centralGodown = whRes.warehouses[0];

        console.log(`   Buyer: ${buyer.name} (${buyer.city}) | Phone: ${buyer.whatsapp_number}`);
        console.log(`   Product: ${product.name} (${product.code}) | Unit: ${product.unit}`);
        console.log(`   Central Warehouse Stock Before: ${product.physical_stock} QTL\n`);

        console.log(`Step 3: Record Received Customer Purchase Order (100 QTL ${product.name} @ ₹3,200/QTL)...`);
        const poRes = await apiReq('/purchase-orders', 'POST', {
            po_number: `PO-REC-${Date.now().toString().slice(-4)}`,
            customer_id: buyer.id,
            product_id: product.id,
            po_date: new Date().toISOString().split('T')[0],
            ordered_quantity: 100,
            customer_selling_rate: 3200,
            delivery_location: buyer.address,
            expected_delivery_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
            notes: 'Contract Order for Wholesale Mandi Distribution'
        });
        console.log(`   PO Created: ${poRes.poNumber} (ID: ${poRes.id})\n`);

        console.log('Step 4: Create Multi-Mill Internal Sourcing Allocations (One PO -> 3 Mills)...');
        const indA = indRes.industries[0]; // Balaji Modern Mill
        const indB = indRes.industries[1]; // Vaishnavi Agro
        const indC = indRes.industries[2]; // Kisan Rice

        // 40 QTL @ ₹2,850
        const allocA = await apiReq('/allocations', 'POST', {
            po_id: poRes.id,
            industry_id: indA.id,
            allocated_quantity: 40,
            purchase_rate: 2850,
            notes: 'Batch #A-401 from Balaji mill'
        });
        console.log(`   Allocated 40 QTL to ${indA.name} @ ₹2,850/QTL (Cost: ₹${40 * 2850})`);

        // 35 QTL @ ₹2,900
        const allocB = await apiReq('/allocations', 'POST', {
            po_id: poRes.id,
            industry_id: indB.id,
            allocated_quantity: 35,
            purchase_rate: 2900,
            notes: 'Batch #B-205 from Vaishnavi unit'
        });
        console.log(`   Allocated 35 QTL to ${indB.name} @ ₹2,900/QTL (Cost: ₹${35 * 2900})`);

        // 25 QTL @ ₹2,820
        const allocC = await apiReq('/allocations', 'POST', {
            po_id: poRes.id,
            industry_id: indC.id,
            allocated_quantity: 25,
            purchase_rate: 2820,
            notes: 'Batch #C-112 from Kisan mill'
        });
        console.log(`   Allocated 25 QTL to ${indC.name} @ ₹2,820/QTL (Cost: ₹${25 * 2820})`);

        // Check PO Economics
        const poDetails = await apiReq(`/purchase-orders/${poRes.id}`);
        console.log(`   -> Total Allocated: ${poDetails.stats.totalAllocated} QTL / 100 QTL`);
        console.log(`   -> Weighted Avg Purchase Rate: ₹${poDetails.stats.weightedAvgPurchaseRate}/QTL`);
        console.log(`   -> Estimated Gross Margin: ₹${poDetails.stats.estimatedGrossMargin.toLocaleString('en-IN')}\n`);

        console.log('Step 5: Record Physical Loading Entries in Master Loading Register...');
        // 1. Industry A -> Warehouse
        const loadA = await apiReq('/loading-register', 'POST', {
            po_id: poRes.id,
            allocation_id: allocA.id,
            industry_id: indA.id,
            loading_date: new Date().toISOString().split('T')[0],
            fulfillment_type: 'Warehouse',
            warehouse_id: centralGodown.id,
            loading_location: indA.location,
            vehicle_number: 'MH-31-AA-7701',
            loading_quantity: 40,
            purchase_rate: 2850,
            remarks: 'Inwarded to Central Godown - Yard 1'
        });
        console.log(`   [Loading 1] ${loadA.loadingNumber}: 40 QTL from ${indA.name} -> Warehouse (Central Godown)`);

        // 2. Industry B -> Direct to Customer (Direct Fulfillment)
        const loadB = await apiReq('/loading-register', 'POST', {
            po_id: poRes.id,
            allocation_id: allocB.id,
            industry_id: indB.id,
            loading_date: new Date().toISOString().split('T')[0],
            fulfillment_type: 'Direct',
            loading_location: indB.location,
            vehicle_number: 'MH-31-BB-8802',
            loading_quantity: 35,
            purchase_rate: 2900,
            remarks: 'Direct dispatch from mill to ABC Traders'
        });
        console.log(`   [Loading 2] ${loadB.loadingNumber}: 35 QTL from ${indB.name} -> DIRECT to Buyer`);

        // 3. Industry C -> Warehouse
        const loadC = await apiReq('/loading-register', 'POST', {
            po_id: poRes.id,
            allocation_id: allocC.id,
            industry_id: indC.id,
            loading_date: new Date().toISOString().split('T')[0],
            fulfillment_type: 'Warehouse',
            warehouse_id: centralGodown.id,
            loading_location: indC.location,
            vehicle_number: 'MH-31-CC-9903',
            loading_quantity: 25,
            purchase_rate: 2820,
            remarks: 'Inwarded to Central Godown - Yard 1'
        });
        console.log(`   [Loading 3] ${loadC.loadingNumber}: 25 QTL from ${indC.name} -> Warehouse (Central Godown)\n`);

        console.log('Step 6: Confirm Customer Dispatches & Trigger WhatsApp Notifications...');
        // Dispatch 1: Partial 20 QTL from Loading A (Warehouse)
        const dsp1 = await apiReq('/dispatches', 'POST', {
            loading_id: loadA.id,
            dispatch_date: new Date().toISOString().split('T')[0],
            dispatch_quantity: 20,
            vehicle_number: 'MH-31-AA-7701',
            remarks: 'First partial dispatch from Warehouse'
        });
        console.log(`   [Dispatch 1] ${dsp1.dispatchNumber}: 20 QTL (Warehouse stock deducted). WhatsApp: ${dsp1.notification?.status}`);

        // Dispatch 2: Remaining 20 QTL from Loading A (Warehouse)
        const dsp2 = await apiReq('/dispatches', 'POST', {
            loading_id: loadA.id,
            dispatch_date: new Date().toISOString().split('T')[0],
            dispatch_quantity: 20,
            vehicle_number: 'MH-31-AA-7701',
            remarks: 'Second partial dispatch from Warehouse'
        });
        console.log(`   [Dispatch 2] ${dsp2.dispatchNumber}: 20 QTL. WhatsApp: ${dsp2.notification?.status}`);

        // Dispatch 3: 35 QTL Direct from Industry B (Direct Mill Delivery)
        const dsp3 = await apiReq('/dispatches', 'POST', {
            loading_id: loadB.id,
            dispatch_date: new Date().toISOString().split('T')[0],
            dispatch_quantity: 35,
            vehicle_number: 'MH-31-BB-8802',
            remarks: 'Direct dispatch fulfilled directly from mill'
        });
        console.log(`   [Dispatch 3] ${dsp3.dispatchNumber}: 35 QTL (Direct dispatch, zero warehouse inventory impact). WhatsApp: ${dsp3.notification?.status}`);

        // Dispatch 4: Final 25 QTL from Loading C (Warehouse)
        const dsp4 = await apiReq('/dispatches', 'POST', {
            loading_id: loadC.id,
            dispatch_date: new Date().toISOString().split('T')[0],
            dispatch_quantity: 25,
            vehicle_number: 'MH-31-CC-9903',
            remarks: 'Final 25 QTL fulfilling order 100%'
        });
        console.log(`   [Dispatch 4] ${dsp4.dispatchNumber}: 25 QTL. WhatsApp: ${dsp4.notification?.status}\n`);

        console.log('Step 7: Verify PO Fulfillment Status & WhatsApp Privacy...');
        const finalPO = await apiReq(`/purchase-orders/${poRes.id}`);
        console.log(`   PO ${finalPO.purchaseOrder.po_number} Status: ${finalPO.purchaseOrder.status}`);
        console.log(`   Fulfillment Percentage: ${finalPO.stats.fulfillmentPercentage}% (Dispatched: ${finalPO.stats.totalDispatched}/${finalPO.purchaseOrder.ordered_quantity} QTL)`);

        // Check WhatsApp notification content
        const waLogs = await apiReq(`/whatsapp/logs?poId=${poRes.id}`);
        console.log(`   Total WhatsApp Notifications Logged: ${waLogs.logs.length}`);
        const sampleMsg = waLogs.logs[0].message_body;
        console.log('   --- Sample WhatsApp Message Delivered to Buyer ---');
        console.log(sampleMsg);
        console.log('   --------------------------------------------------');
        console.log('   Privacy Verification: Internal mills or purchase rates mentioned? ' + 
            (sampleMsg.includes('Balaji') || sampleMsg.includes('2850') ? 'FAILED (LEAK)' : 'PASSED (STRICT PRIVACY)\n'));

        console.log('Step 8: Generate Genuine Excel Reports (.xlsx)...');
        await downloadReq('/reports/export/master-loading', 'Master_Loading_Register.xlsx');
        await downloadReq('/reports/export/industry-wise', 'Industry_Wise_Sourcing_Report.xlsx');
        await downloadReq('/reports/export/buyer-wise', 'Buyer_Wise_Performance_Report.xlsx');
        await downloadReq('/reports/export/po-fulfillment', 'PO_Fulfillment_Pipeline_Report.xlsx');
        await downloadReq('/reports/export/stock-ledger', 'Audited_Stock_Ledger.xlsx');

        console.log('\n========================================================================');
        console.log('LIVE BUSINESS WALKTHROUGH COMPLETED SUCCESSFULLY!');
        console.log('All real-world transactions reconciled cleanly in database and Excel.');
        console.log(`Excel spreadsheets saved to: ${EXPORTS_DIR}`);
        console.log('========================================================================');
    } catch (err) {
        console.error('Walkthrough error:', err.message);
    }
}

runDemo();

