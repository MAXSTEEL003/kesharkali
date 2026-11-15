// src/pages/MasterLoadingRegister.jsx
import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Download, 
  Printer, 
  Plus, 
  Filter, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import ExcelGrid from '../components/ExcelGrid';
import Modal from '../components/Modal';
import { api, downloadBlob } from '../api';
import { formatDateDMY } from '../utils/date';

export default function MasterLoadingRegister({ onOpenQuickAction, quickActionTrigger }) {
  const [loadingEntries, setLoadingEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [productId, setProductId] = useState('');
  const [loadingStatus, setLoadingStatus] = useState('');
  const [dispatchStatus, setDispatchStatus] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [search, setSearch] = useState('');

  // Add Loading Entry Modal
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    if (quickActionTrigger?.action === 'loading') {
      setIsAddOpen(true);
      if (quickActionTrigger.poId) {
        const poId = String(quickActionTrigger.poId);
        const subNo = quickActionTrigger.subOrderNo || '';
        const po = purchaseOrders.find(p => String(p.id) === poId);
        const sub = po?.sub_orders?.find(s => (s.sub_order_no || s.subOrderNo) === subNo);
        const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
        const rem = sub 
          ? Math.max(0, Number(sub.ordered_quantity || sub.orderedQuantity || 0) - Number(sub.loaded_quantity || sub.loadedQuantity || 0))
          : (po ? Number(po.remaining_quantity || po.ordered_quantity || 0) : '');

        setAddForm(prev => ({
          ...prev,
          po_id: poId,
          sub_order_no: subNo,
          industry_id: defaultInd ? defaultInd.id : prev.industry_id,
          loading_quantity: rem ? Number(rem).toFixed(2) : prev.loading_quantity,
          loading_location: sub?.delivery_location || po?.delivery_location || prev.loading_location,
          purchase_rate: defaultInd?.default_purchase_rate || po?.customer_selling_rate || prev.purchase_rate
        }));
      }
    }
  }, [quickActionTrigger, purchaseOrders, industries]);
  const [addForm, setAddForm] = useState({
    po_id: '',
    sub_order_no: '',
    industry_id: '',
    loading_date: new Date().toISOString().split('T')[0],
    fulfillment_type: 'Direct',
    warehouse_id: '',
    loading_location: '',
    vehicle_number: '',
    driver_phone: '',
    loading_quantity: '',
    purchase_rate: '',
    remarks: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesRes, summaryRes, custRes, indRes, poRes, prodRes, whRes] = await Promise.all([
        api.loadingRegister.getAll({
          startDate,
          endDate,
          buyerId,
          industryId,
          productId,
          vehicleNumber: vehicleSearch,
          loadingStatus,
          dispatchStatus,
          search
        }),
        api.loadingRegister.getSummary(),
        api.customers.getAll(),
        api.industries.getAll(),
        api.purchaseOrders.getAll(),
        api.products.getAll(),
        api.warehouses.getAll()
      ]);

      setLoadingEntries(entriesRes.loadingEntries || []);
      setSummary(summaryRes);
      setCustomers(custRes.customers || []);
      setIndustries(indRes.industries || []);
      setPurchaseOrders(poRes.purchaseOrders || []);
      setProducts(prodRes.products || []);
      setWarehouses(whRes.warehouses || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, buyerId, industryId, productId, loadingStatus, dispatchStatus]);

  const handleCellChange = async (rowId, key, value, fullRow) => {
    try {
      await api.loadingRegister.updateCell(rowId, { [key]: value });
      // Update local state without full reload for instant Excel responsiveness
      setLoadingEntries(prev => prev.map(r => r.id === rowId ? { ...r, [key]: value } : r));
    } catch (err) {
      alert(`Failed to save cell: ${err.message}`);
    }
  };

  const handleBulkPaste = async (pastedRows, startRow, startCol) => {
    try {
      // Allow pasting vehicle numbers, locations, or remarks into existing rows
      const updatedRows = [];
      pastedRows.forEach((pRow, rOffset) => {
        const targetRowIdx = startRow + rOffset;
        if (targetRowIdx < loadingEntries.length) {
          const row = loadingEntries[targetRowIdx];
          const updated = { id: row.id };
          if (pRow[0]) updated.vehicle_number = pRow[0];
          if (pRow[1]) updated.loading_location = pRow[1];
          if (pRow[2]) updated.remarks = pRow[2];
          updatedRows.push(updated);
        }
      });

      if (updatedRows.length > 0) {
        await api.loadingRegister.bulkSave(updatedRows);
        loadData();
      }
    } catch (err) {
      alert(`Bulk paste failed: ${err.message}`);
    }
  };

  const handleDeleteRow = async (id, loadingNumber) => {
    if (!confirm(`Are you sure you want to delete loading entry ${loadingNumber}? Associated inward inventory movements will be reversed.`)) return;
    try {
      await api.loadingRegister.delete(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateLoading = async (e) => {
    e.preventDefault();
    try {
      await api.loadingRegister.create(addForm);
      setIsAddOpen(false);
      setAddForm({
        po_id: '',
        industry_id: '',
        loading_date: new Date().toISOString().split('T')[0],
        fulfillment_type: 'Warehouse',
        warehouse_id: '',
        loading_location: '',
        vehicle_number: '',
        driver_phone: '',
        loading_quantity: '',
        purchase_rate: '',
        remarks: ''
      });
      loadData();
    } catch (err) {
      alert(`Loading entry failed: ${err.message}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await api.reports.exportMasterLoading({
        startDate,
        endDate,
        buyerId,
        industryId
      });
      downloadBlob(blob, `Keshar_Kali_Master_Loading_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Define columns for Excel-style Grid
  const columns = [
    { key: 'loading_number', label: 'Loading ID', width: '110px' },
    { key: 'loading_date', label: 'Date', width: '100px', align: 'center', render: (val) => <span className="font-mono text-xs">{formatDateDMY(val)}</span> },
    { key: 'po_number', label: 'PO #', width: '105px' },
    { 
      key: 'sub_order_no', 
      label: 'Sub-PO #', 
      width: '105px', 
      align: 'center',
      render: (val) => val ? (
        <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {val}
        </span>
      ) : (
        <span className="text-gray-400 text-[10px]">—</span>
      )
    },
    { 
      key: 'customer_name', 
      label: 'Buyer / Consignee', 
      width: '160px',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{row.sub_buyer_name || val}</span>
          {row.sub_order_no && row.sub_buyer_name && row.sub_buyer_name !== val && (
            <span className="text-[10px] text-gray-500 block">Lead PO: {val}</span>
          )}
        </div>
      )
    },
    { key: 'product_name', label: 'Rice Product', width: '130px' },
    { key: 'industry_name', label: 'Industry (Rice Mill)', width: '180px' },
    { 
      key: 'fulfillment_type', 
      label: 'Fulfillment', 
      width: '105px', 
      align: 'center',
      render: (val) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${val === 'Warehouse' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
          {val}
        </span>
      )
    },
    { 
      key: 'vehicle_number', 
      label: 'Vehicle Number', 
      width: '130px', 
      align: 'center',
      editable: true,
      render: (val) => <span className="font-mono font-semibold text-[#8F1717]">{val}</span>
    },
    { 
      key: 'loading_quantity', 
      label: 'Loading QTL', 
      width: '105px', 
      align: 'right',
      render: (val) => <span className="font-mono font-bold">{Number(val).toFixed(2)}</span>
    },
    { 
      key: 'purchase_rate', 
      label: 'Purchase Rate', 
      width: '115px', 
      align: 'right',
      render: (val) => <span className="font-mono">₹{Number(val).toFixed(2)}</span>
    },
    { 
      key: 'loading_amount', 
      label: 'Loading Amount', 
      width: '125px', 
      align: 'right',
      render: (val) => <span className="font-mono font-bold text-gray-800">₹{Number(val).toLocaleString('en-IN')}</span>
    },
    { 
      key: 'dispatch_status', 
      label: 'Dispatch Status', 
      width: '130px', 
      align: 'center',
      render: (val, row) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          val === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
          val === 'Partially Dispatched' ? 'bg-orange-100 text-orange-800' :
          'bg-gray-100 text-gray-700'
        }`}>
          {val} ({row.available_to_dispatch} QTL left)
        </span>
      )
    },
    { 
      key: 'loading_location', 
      label: 'Loading Location', 
      width: '140px',
      editable: true 
    },
    { 
      key: 'remarks', 
      label: 'Remarks', 
      width: '160px',
      editable: true 
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '70px',
      align: 'center',
      render: (_, row) => (
        row.dispatched_quantity === 0 && (
          <button
            onClick={() => handleDeleteRow(row.id, row.loading_number)}
            className="p-1 text-red-400 hover:text-red-700 rounded hover:bg-red-50"
            title="Delete loading entry"
          >
            <Trash2 size={13} />
          </button>
        )
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Flagship Header & Action Toolbar */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E2DC]">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Truck size={18} className="text-[#8F1717]" />
              Master Loading Register
            </h1>
            <p className="text-xs text-[#777777]">
              The authoritative daily operational grid — fast keyboard navigation, multi-row Excel paste, and auto-save
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
            >
              <Plus size={14} />
              <span>Record Loading Entry</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded transition-colors shadow-xs"
            >
              <FileSpreadsheet size={14} />
              <span>Excel Export (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-[#252525] px-3 py-1.5 rounded transition-colors shadow-xs no-print"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Compact Totals Strip Above Grid */}
        {summary && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Today's Loading</div>
              <div className="text-sm font-bold font-mono text-[#8F1717]">{summary.todayLoading.qtl} QTL</div>
              <div className="text-[10px] text-gray-400">{summary.todayLoading.count} trucks loaded today</div>
            </div>

            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Total Loaded to Date</div>
              <div className="text-sm font-bold font-mono text-[#252525]">{summary.totalLoading.qtl} QTL</div>
              <div className="text-[10px] text-gray-400">₹{summary.totalLoading.amount.toLocaleString('en-IN')}</div>
            </div>

            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Pending Mill Loading</div>
              <div className="text-sm font-bold font-mono text-amber-700">{summary.pendingLoading.qtl} QTL</div>
              <div className="text-[10px] text-amber-600">Awaiting mill bagging/trucks</div>
            </div>

            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Today's Dispatch</div>
              <div className="text-sm font-bold font-mono text-emerald-700">{summary.todayDispatch.qtl} QTL</div>
              <div className="text-[10px] text-emerald-600">{summary.todayDispatch.count} deliveries sent</div>
            </div>
          </div>
        )}

        {/* Dense Filters Toolbar */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <input
            type="text"
            placeholder="Search Vehicle / Loading#..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          />

          <select
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Buyers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={industryId}
            onChange={(e) => setIndustryId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Rice Mills (Internal)</option>
            {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>

          <select
            value={dispatchStatus}
            onChange={(e) => setDispatchStatus(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Dispatch Status</option>
            <option value="Pending">Pending Dispatch</option>
            <option value="Partially Dispatched">Partially Dispatched</option>
            <option value="Dispatched">Fully Dispatched</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          />
        </div>
      </div>

      {/* Flagship Excel Interactive Data Grid */}
      <ExcelGrid
        columns={columns}
        data={loadingEntries}
        onCellChange={handleCellChange}
        onBulkPaste={handleBulkPaste}
      />

      {/* Record Loading Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Record Master Loading Entry"
        subtitle="Confirm physical truck loading at rice mill or warehouse inward"
      >
        <form onSubmit={handleCreateLoading} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Customer Purchase Order *</label>
              <select
                required
                value={addForm.po_id}
                onChange={(e) => {
                  const poId = e.target.value;
                  const po = purchaseOrders.find(p => String(p.id) === String(poId));
                  const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
                  setAddForm(prev => ({
                    ...prev,
                    po_id: poId,
                    sub_order_no: '',
                    industry_id: prev.industry_id || (defaultInd ? defaultInd.id : ''),
                    purchase_rate: prev.purchase_rate || (defaultInd?.default_purchase_rate || po?.customer_selling_rate || 2800),
                    loading_location: po?.delivery_location || prev.loading_location,
                    loading_quantity: po ? (po.remaining_quantity || po.ordered_quantity || '') : ''
                  }));
                }}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select PO</option>
                {purchaseOrders.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled').map(po => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} — {po.customer_name} ({po.product_name}, {po.ordered_quantity} QTL)
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Order Selector for Multi-Consignee / Partial Loading */}
            {(() => {
              const currentPo = purchaseOrders.find(p => String(p.id) === String(addForm.po_id));
              const subList = currentPo?.sub_orders || [];
              if (subList.length === 0) return null;
              return (
                <div className="col-span-1 sm:col-span-2 bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-blue-900">
                      Select Sub-Order to Load (Supplier Choice)
                    </label>
                    <span className="text-[10px] text-blue-700 font-mono">
                      Partial loading supported (e.g. load 10 QTL now, load remaining after 3 days)
                    </span>
                  </div>
                  <select
                    value={addForm.sub_order_no}
                    onChange={(e) => {
                      const subNo = e.target.value;
                      const sub = subList.find(s => (s.sub_order_no || s.subOrderNo) === subNo);
                      const rem = sub ? Math.max(0, Number(sub.ordered_quantity || sub.orderedQuantity || 0) - Number(sub.loaded_quantity || sub.loadedQuantity || 0)) : (currentPo?.remaining_quantity || currentPo?.ordered_quantity || '');
                      setAddForm(prev => ({
                        ...prev,
                        sub_order_no: subNo,
                        loading_quantity: rem ? Number(rem).toFixed(2) : prev.loading_quantity,
                        loading_location: sub?.delivery_location || prev.loading_location
                      }));
                    }}
                    className="w-full p-2 bg-white border border-blue-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="">Entire PO (All Consignees / Unspecified)</option>
                    {subList.map((sub, sIdx) => {
                      const subNo = sub.sub_order_no || sub.subOrderNo || `Sub #${sIdx + 1}`;
                      const ordQty = Number(sub.ordered_quantity || sub.orderedQuantity || 0);
                      const ldQty = Number(sub.loaded_quantity || sub.loadedQuantity || 0);
                      const remQty = Math.max(0, ordQty - ldQty);
                      return (
                        <option key={subNo} value={subNo}>
                          {subNo} — {sub.buyer_name || sub.buyerName} | Ordered: {ordQty} QTL | Loaded: {ldQty} QTL | Pending: {remQty.toFixed(2)} QTL
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })()}

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Sourcing Rice Mill / Industry *</label>
              <select
                required
                value={addForm.industry_id}
                onChange={(e) => {
                  const indId = e.target.value;
                  const ind = industries.find(i => String(i.id) === String(indId));
                  setAddForm({
                    ...addForm,
                    industry_id: indId,
                    purchase_rate: ind?.default_purchase_rate || addForm.purchase_rate,
                    loading_location: ind?.location || addForm.loading_location
                  });
                }}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Industry</option>
                {industries.map(ind => (
                  <option key={ind.id} value={ind.id}>{ind.name} ({ind.location})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Loading Date *</label>
              <input
                type="date"
                required
                value={addForm.loading_date}
                onChange={(e) => setAddForm({ ...addForm, loading_date: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Fulfillment Workflow *</label>
              <select
                required
                value={addForm.fulfillment_type}
                onChange={(e) => setAddForm({ ...addForm, fulfillment_type: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="Warehouse">Warehouse (Inward to Supplier Godown)</option>
                <option value="Direct">Direct Dispatch (Mill straight to Buyer)</option>
              </select>
            </div>

            {addForm.fulfillment_type === 'Warehouse' && (
              <div>
                <label className="block font-semibold text-[#252525] mb-1">Destination Godown *</label>
                <select
                  required
                  value={addForm.warehouse_id}
                  onChange={(e) => setAddForm({ ...addForm, warehouse_id: e.target.value })}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                >
                  <option value="">Select Target Godown</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Truck / Vehicle Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. MH-31-AA-4412"
                value={addForm.vehicle_number}
                onChange={(e) => setAddForm({ ...addForm, vehicle_number: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Driver Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +91 98220 12345"
                value={addForm.driver_phone}
                onChange={(e) => setAddForm({ ...addForm, driver_phone: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Loading Quantity (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 40.00"
                value={addForm.loading_quantity}
                onChange={(e) => setAddForm({ ...addForm, loading_quantity: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Purchase Rate (₹/QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 2850.00"
                value={addForm.purchase_rate}
                onChange={(e) => setAddForm({ ...addForm, purchase_rate: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Loading Location / Mandi Gate</label>
            <input
              type="text"
              placeholder="e.g. Balaji Mill Yard, Bhandara Gate 2"
              value={addForm.loading_location}
              onChange={(e) => setAddForm({ ...addForm, loading_location: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="Weighbridge slip no, moisture 12.5%, sortex clean..."
              value={addForm.remarks}
              onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs"
            >
              Confirm & Post to Master Loading Register
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

