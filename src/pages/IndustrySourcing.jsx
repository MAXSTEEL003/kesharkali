// src/pages/IndustrySourcing.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Factory, 
  TrendingUp, 
  Filter, 
  AlertCircle, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Search, 
  RotateCcw, 
  Calendar,
  Layers,
  FileText,
  DollarSign,
  ArrowRight,
  Clock,
  Check,
  RefreshCw,
  Truck
} from 'lucide-react';
import { api } from '../api';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { formatDateDMY } from '../utils/date';

export default function IndustrySourcing() {
  const { showToast, confirm } = useNotification();
  const [allocations, setAllocations] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form State
  const [form, setForm] = useState({
    po_id: '',
    industry_id: '',
    product_id: '',
    allocated_quantity: '',
    purchase_rate: '',
    expected_loading_date: new Date().toISOString().split('T')[0],
    notes: '',
    override_allowed: false
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocRes, indRes, poRes] = await Promise.all([
        api.allocations.getByPo(''),
        api.industries.getAll(),
        api.purchaseOrders.getAll()
      ]);
      setAllocations(allocRes.allocations || []);
      setIndustries(indRes.industries || []);
      setPurchaseOrders(poRes.purchaseOrders || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      showToast(`Failed to load sourcing data: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handlePortalRefresh = () => loadData();
    window.addEventListener('portal-refresh-data', handlePortalRefresh);
    return () => window.removeEventListener('portal-refresh-data', handlePortalRefresh);
  }, []);

  // Filtered Allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((alloc) => {
      if (industryFilter && String(alloc.industry_id) !== String(industryFilter)) return false;
      if (statusFilter !== 'ALL' && alloc.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchInd = alloc.industry_name?.toLowerCase().includes(q);
        const matchPo = alloc.po_number?.toLowerCase().includes(q);
        const matchBuyer = alloc.customer_name?.toLowerCase().includes(q);
        const matchProd = alloc.product_name?.toLowerCase().includes(q);
        const matchLoc = alloc.industry_location?.toLowerCase().includes(q);
        if (!matchInd && !matchPo && !matchBuyer && !matchProd && !matchLoc) return false;
      }
      return true;
    });
  }, [allocations, industryFilter, statusFilter, search]);

  const hasActiveFilters = search.trim() || industryFilter || statusFilter !== 'ALL';

  const handleClearFilters = () => {
    setSearch('');
    setIndustryFilter('');
    setStatusFilter('ALL');
  };

  // Metrics
  const totalAllocatedQtl = allocations.reduce((s, a) => s + Number(a.allocated_quantity || 0), 0);
  const totalLoadedQtl = allocations.reduce((s, a) => s + Number(a.loaded_quantity || 0), 0);
  const totalPendingLoadingQtl = allocations.reduce((s, a) => s + Number(a.pending_loading_quantity || 0), 0);
  const totalProcurementAmount = allocations.reduce((s, a) => s + Number(a.purchase_amount || 0), 0);
  const overallWeightedRate = totalAllocatedQtl > 0 ? (totalProcurementAmount / totalAllocatedQtl).toFixed(2) : 0;

  // Open Modal Handler
  const handleOpenAddModal = () => {
    // Pick the first external mill if available, or first industry
    const externalMill = industries.find(i => !i.is_default && !i.name?.toLowerCase().includes('bhagwathi')) || industries[0];
    const firstPo = purchaseOrders.find(p => p.status !== 'Completed') || purchaseOrders[0];
    
    const remQtl = firstPo ? Math.max(0, Number(firstPo.ordered_quantity || 0) - Number(firstPo.total_allocated || 0)) : '';

    setForm({
      po_id: firstPo ? String(firstPo.id) : '',
      industry_id: externalMill ? String(externalMill.id) : '',
      product_id: firstPo ? String(firstPo.product_id) : '',
      allocated_quantity: remQtl > 0 ? remQtl : '',
      purchase_rate: externalMill?.default_purchase_rate || '',
      expected_loading_date: new Date().toISOString().split('T')[0],
      notes: '',
      override_allowed: false
    });
    setIsAddModalOpen(true);
  };

  // On PO selection in modal
  const handlePoChange = (poId) => {
    const selectedPo = purchaseOrders.find(p => String(p.id) === String(poId));
    if (selectedPo) {
      const remQtl = Math.max(0, Number(selectedPo.ordered_quantity || 0) - Number(selectedPo.total_allocated || 0));
      setForm(prev => ({
        ...prev,
        po_id: poId,
        product_id: String(selectedPo.product_id),
        allocated_quantity: remQtl > 0 ? remQtl : prev.allocated_quantity
      }));
    } else {
      setForm(prev => ({ ...prev, po_id: poId }));
    }
  };

  // On Industry selection in modal
  const handleIndustryChange = (indId) => {
    const ind = industries.find(i => String(i.id) === String(indId));
    setForm(prev => ({
      ...prev,
      industry_id: indId,
      purchase_rate: ind?.default_purchase_rate || prev.purchase_rate
    }));
  };

  // Save Sourcing Commitment
  const handleCreateSourcing = async (e) => {
    e.preventDefault();
    if (!form.industry_id) {
      showToast('Please select the external supplier / rice mill.', 'warning');
      return;
    }
    if (!form.po_id) {
      showToast('Please select a customer purchase order to fulfill.', 'warning');
      return;
    }
    const qty = Number(form.allocated_quantity);
    if (!qty || qty <= 0) {
      showToast('Please enter a valid sourcing quantity in QTL.', 'warning');
      return;
    }
    const rate = Number(form.purchase_rate);
    if (!rate || rate <= 0) {
      showToast('Please enter a valid purchase rate paid to the other supplier.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await api.allocations.create({
        po_id: Number(form.po_id),
        industry_id: Number(form.industry_id),
        product_id: Number(form.product_id),
        allocated_quantity: qty,
        purchase_rate: rate,
        expected_loading_date: form.expected_loading_date,
        notes: form.notes,
        override_allowed: form.override_allowed
      });

      showToast('Industry sourcing commitment recorded successfully!', 'success');
      setIsAddModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Sourcing Allocation
  const handleDeleteAllocation = async (alloc) => {
    const ok = await confirm({
      title: 'Cancel Industry Sourcing Commitment',
      message: `Are you sure you want to remove this sourcing allocation from ${alloc.industry_name} (${alloc.allocated_quantity} QTL @ ₹${alloc.purchase_rate}) for PO #${alloc.po_number}?`,
      confirmText: 'Remove Sourcing',
      cancelText: 'Keep Sourcing',
      type: 'danger'
    });

    if (!ok) return;

    try {
      await api.allocations.delete(alloc.id);
      showToast('Sourcing commitment removed successfully.', 'success');
      loadData();
    } catch (err) {
      showToast(`Cannot delete: ${err.message}`, 'error');
    }
  };

  const selectedPoObj = purchaseOrders.find(p => String(p.id) === String(form.po_id));
  const selectedIndObj = industries.find(i => String(i.id) === String(form.industry_id));
  const previewCost = (Number(form.allocated_quantity) || 0) * (Number(form.purchase_rate) || 0);

  return (
    <div className="space-y-4">
      {/* Sourcing Header & Action Bar */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Factory size={18} className="text-[#8F1717]" />
              Industry Sourcing & Inter-Supplier Procurement
            </h1>
            <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Supplier Desk Only
            </span>
          </div>
          <p className="text-xs text-[#777777] mt-0.5">
            Managed exclusively by the Supplier: Buying stock from other suppliers/mills to pack and load into the Keshar Kali brand
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-[#E8E2DC] rounded hover:bg-[#FAF9F6] text-gray-600 transition-colors"
            title="Refresh sourcing data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3 py-2 rounded shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>+ Record Industry Sourcing</span>
          </button>
        </div>
      </div>

      {/* Sourcing Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-[#8F1717]">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Total Sourced Volume</div>
          <div className="text-xl font-bold font-mono text-[#252525] mt-1">{totalAllocatedQtl.toLocaleString('en-IN')} QTL</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{allocations.length} Procurement Commitment{allocations.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-indigo-600">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Loaded into Keshar Kali Brand</div>
          <div className="text-xl font-bold font-mono text-indigo-700 mt-1">{totalLoadedQtl.toLocaleString('en-IN')} QTL</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">{totalAllocatedQtl > 0 ? ((totalLoadedQtl / totalAllocatedQtl) * 100).toFixed(1) : 0}% Realized</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-amber-500">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Pending Mill Loading</div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">{totalPendingLoadingQtl.toLocaleString('en-IN')} QTL</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Awaiting Trucks at Sourced Mills</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-[#C69A3B]">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Weighted Purchase Rate</div>
          <div className="text-xl font-bold font-mono text-[#8F1717] mt-1">₹{overallWeightedRate}/QTL</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Total Payable: ₹{totalProcurementAmount.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="Search by mill, PO#, buyer, or variety..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          {/* Sourced Mill Filter */}
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs text-[#252525] focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Sourced Mills</option>
            {industries.map(ind => (
              <option key={ind.id} value={ind.id}>{ind.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs text-[#252525] focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="ALL">All Sourcing Statuses</option>
            <option value="Pending">Pending Loading</option>
            <option value="Partially Loaded">Partially Loaded</option>
            <option value="Loaded">Fully Loaded</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-xs text-[#8F1717] hover:underline font-semibold"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Sourcing Allocations Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">External Supplier / Rice Mill</th>
                <th className="text-left">Customer PO #</th>
                <th className="text-left">Buyer / Consignee</th>
                <th className="text-left">Product Variety</th>
                <th className="text-right">Sourced QTL</th>
                <th className="text-right">Purchase Rate</th>
                <th className="text-right">Total Payable</th>
                <th className="text-right">Loaded QTL</th>
                <th className="text-right">Pending Loading</th>
                <th className="text-center">Expected Date</th>
                <th className="text-center">Status</th>
                <th className="text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-xs text-gray-400">
                    <RefreshCw className="animate-spin inline mr-2" size={14} />
                    Loading supplier sourcing allocations...
                  </td>
                </tr>
              ) : filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-xs text-gray-400">
                    {hasActiveFilters ? 'No sourcing allocations match the active filters.' : 'No external industry sourcing commitments recorded yet.'}
                    <div className="mt-2">
                      <button
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#8F1717] hover:underline"
                      >
                        <Plus size={12} />
                        Record first sourcing commitment
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((alloc, idx) => (
                  <tr key={alloc.id} className="hover:bg-amber-50/40">
                    <td className="text-center font-mono text-[11px] text-gray-500">{idx + 1}</td>
                    <td>
                      <div className="font-semibold text-[#8F1717]">{alloc.industry_name}</div>
                      <div className="text-[10px] text-gray-500">{alloc.industry_location}</div>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                        {alloc.po_number}
                      </span>
                    </td>
                    <td className="font-medium text-gray-900">{alloc.customer_name}</td>
                    <td className="text-gray-700">{alloc.product_name}</td>
                    <td className="text-right font-mono font-bold text-purple-700">{alloc.allocated_quantity}</td>
                    <td className="text-right font-mono font-semibold">₹{alloc.purchase_rate}</td>
                    <td className="text-right font-mono font-semibold text-gray-900">
                      ₹{Number(alloc.purchase_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="text-right font-mono text-indigo-700 font-semibold">{alloc.loaded_quantity}</td>
                    <td className="text-right font-mono text-amber-700 font-bold">{alloc.pending_loading_quantity}</td>
                    <td className="text-center text-xs font-mono text-gray-600">
                      {alloc.expected_loading_date ? formatDateDMY(alloc.expected_loading_date) : '—'}
                    </td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        alloc.status === 'Completed' || alloc.status === 'Loaded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : alloc.status === 'Partially Loaded'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {alloc.status}
                      </span>
                    </td>
                    <td className="text-center">
                      {Number(alloc.loaded_quantity) === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteAllocation(alloc)}
                          className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Remove Sourcing Commitment"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic" title="Already partially or fully loaded">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Industry Sourcing Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record Industry Sourcing Commitment"
        subtitle="When the supplier buys from another supplier/mill to load into the Keshar Kali brand"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateSourcing} className="space-y-4 text-xs">
          {/* External Supplier Selection */}
          <div>
            <label className="block font-semibold text-[#252525] mb-1">
              Select External Supplier (Other Rice Mill) *
            </label>
            <select
              required
              value={form.industry_id}
              onChange={(e) => handleIndustryChange(e.target.value)}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            >
              <option value="">Select External Supplier / Rice Mill</option>
              {industries.map(ind => {
                const isDefault = ind.is_default || ind.name?.toLowerCase().includes('bhagwathi');
                return (
                  <option key={ind.id} value={ind.id}>
                    {ind.name} ({ind.location}) — Std Rate: ₹{ind.default_purchase_rate || '—'} {isDefault ? '[Primary Mill]' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              This is the third-party mill or supplier from whom Keshar Kali is procuring stock.
            </p>
          </div>

          {/* Customer PO Selection */}
          <div>
            <label className="block font-semibold text-[#252525] mb-1">
              Select Customer Purchase Order to Fulfill *
            </label>
            <select
              required
              value={form.po_id}
              onChange={(e) => handlePoChange(e.target.value)}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            >
              <option value="">Select Customer Purchase Order</option>
              {purchaseOrders
                .filter(p => p.status !== 'Completed')
                .map(po => {
                  const remQtl = Math.max(0, Number(po.ordered_quantity || 0) - Number(po.total_allocated || 0));
                  return (
                    <option key={po.id} value={po.id}>
                      {po.po_number} | {po.customer_name} — {po.product_name} ({po.ordered_quantity} QTL total, {remQtl.toFixed(2)} QTL unallocated)
                    </option>
                  );
                })}
            </select>
            {selectedPoObj && (
              <div className="mt-1 p-2 bg-[#FAF9F6] rounded border border-[#E8E2DC] flex items-center justify-between text-[11px]">
                <span className="text-gray-600">
                  Buyer: <strong>{selectedPoObj.customer_name}</strong> | Product: <strong>{selectedPoObj.product_name}</strong>
                </span>
                <span className="font-mono font-semibold text-[#8F1717]">
                  Selling Rate: ₹{selectedPoObj.customer_selling_rate}/QTL
                </span>
              </div>
            )}
          </div>

          {/* Quantity & Purchase Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">
                Sourcing Quantity (QTL) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 40.00"
                value={form.allocated_quantity}
                onChange={(e) => setForm({ ...form, allocated_quantity: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono font-bold text-gray-900 focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">
                Purchase Rate Paid to Supplier (₹/QTL) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 2850"
                value={form.purchase_rate}
                onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono font-bold text-[#8F1717] focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          {/* Live Payable Preview */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Total Procurement Payable</span>
              <span className="text-base font-bold font-mono text-[#8F1717]">
                ₹{Math.round(previewCost).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-[11px] text-amber-800 text-right">
              {form.allocated_quantity || 0} QTL @ ₹{form.purchase_rate || 0}/QTL
            </div>
          </div>

          {/* Expected Date & Over-allocation Checkbox */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">
                Expected Loading / Arrival Date
              </label>
              <input
                type="date"
                value={form.expected_loading_date}
                onChange={(e) => setForm({ ...form, expected_loading_date: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="override_allowed"
                checked={form.override_allowed}
                onChange={(e) => setForm({ ...form, override_allowed: e.target.checked })}
                className="rounded text-[#8F1717] focus:ring-[#8F1717]"
              />
              <label htmlFor="override_allowed" className="text-gray-700 cursor-pointer font-medium">
                Allow Over-Allocation (e.g. Full 40 QTL truckload)
              </label>
            </div>
          </div>

          {/* Notes & Specs */}
          <div>
            <label className="block font-semibold text-[#252525] mb-1">
              Procurement Notes & Terms
            </label>
            <textarea
              rows={2}
              placeholder="Moisture 12.5%, sortex clean, broker terms, delivery location..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E2DC]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white rounded shadow-xs transition-colors flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <RefreshCw className="animate-spin" size={13} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Industry Sourcing</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
