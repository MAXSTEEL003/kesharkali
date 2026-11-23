// src/pages/StockOutward.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowUpRight, 
  Truck, 
  FileText, 
  Plus, 
  Filter, 
  Search, 
  RotateCcw, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Scale,
  Calendar,
  Layers,
  Factory
} from 'lucide-react';
import { api } from '../api';
import Modal from '../components/Modal';
import { formatDateDMY } from '../utils/date';
import { useNotification } from '../context/NotificationContext';

export default function StockOutward({ setActivePage, onSuccess }) {
  const { showToast } = useNotification();
  const [outwards, setOutwards] = useState([]);
  const [summary, setSummary] = useState({ todayQtl: 0, monthQtl: 0, totalQtl: 0, totalCount: 0 });
  const [products, setProducts] = useState([]);
  const [mills, setMills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'dispatches' | 'manual'

  // Manual Outward Issue Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    warehouseId: '',
    quantity: '',
    rate: '',
    transactionType: 'Internal Stock Issue',
    destination: '',
    referenceNumber: '',
    remarks: ''
  });

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const [outwardRes, prodRes, indRes] = await Promise.all([
        api.stock.getOutwards({ startDate, endDate, productId, search }),
        api.products.getAll(),
        api.industries.getAll()
      ]);

      setOutwards(outwardRes.outwards || []);
      if (outwardRes.summary) {
        setSummary(outwardRes.summary);
      }
      setProducts(prodRes.products || []);
      setMills(indRes.industries || []);

      const def = (indRes.industries || []).find(i => i.is_default === 1) || (indRes.industries || [])[0];
      if (def && !form.warehouseId) {
        setForm(prev => ({ ...prev, warehouseId: String(def.id) }));
      }
    } catch (err) {
      showToast(`Error loading stock outward data: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const handlePortalRefresh = () => loadData(true);
    window.addEventListener('portal-refresh-data', handlePortalRefresh);
    return () => window.removeEventListener('portal-refresh-data', handlePortalRefresh);
  }, [startDate, endDate, productId]);

  // Client-side quick filter
  const filteredOutwards = useMemo(() => {
    return outwards.filter(item => {
      if (typeFilter === 'dispatches' && item.transaction_type !== 'Customer Dispatch') return false;
      if (typeFilter === 'manual' && item.transaction_type === 'Customer Dispatch') return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match = (
          item.dispatch_number?.toLowerCase().includes(q) ||
          item.po_number?.toLowerCase().includes(q) ||
          item.sub_order_no?.toLowerCase().includes(q) ||
          item.customer_name?.toLowerCase().includes(q) ||
          item.buyer_name?.toLowerCase().includes(q) ||
          item.destination?.toLowerCase().includes(q) ||
          item.product_name?.toLowerCase().includes(q) ||
          item.vehicle_number?.toLowerCase().includes(q) ||
          item.loading_number?.toLowerCase().includes(q) ||
          item.remarks?.toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      return true;
    });
  }, [outwards, typeFilter, search]);

  const totalFilteredQtl = useMemo(() => {
    return filteredOutwards.reduce((sum, item) => sum + Number(item.quantity || item.outward_quantity || 0), 0);
  }, [filteredOutwards]);

  const handleClearFilters = () => {
    setSearch('');
    setProductId('');
    setStartDate('');
    setEndDate('');
    setTypeFilter('all');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.stock.outward(form);
      showToast(`Stock outward recorded successfully! Ref: ${res.result?.transactionNumber || 'Done'}`, 'success');
      setIsModalOpen(false);
      if (onSuccess) onSuccess();
      loadData(true);
      window.dispatchEvent(new CustomEvent('portal-refresh-data'));

      setForm(prev => ({
        date: new Date().toISOString().split('T')[0],
        productId: '',
        warehouseId: prev.warehouseId || '',
        quantity: '',
        rate: '',
        transactionType: 'Internal Stock Issue',
        destination: '',
        referenceNumber: '',
        remarks: ''
      }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || productId || startDate || endDate || typeFilter !== 'all');

  return (
    <div className="space-y-4">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Today's Outward</span>
            <Truck size={14} className="text-[#8F1717]" />
          </div>
          <div className="text-xl font-black font-mono text-[#8F1717] mt-1">
            {summary.todayQtl.toFixed(2)} QTL
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Dispatched today</div>
        </div>

        <div className="glass-panel p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">This Month Outward</span>
            <Calendar size={14} className="text-[#C69A3B]" />
          </div>
          <div className="text-xl font-black font-mono text-[#252525] mt-1">
            {summary.monthQtl.toFixed(2)} QTL
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Current month volume</div>
        </div>

        <div className="glass-panel p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Outward Volume</span>
            <ArrowUpRight size={14} className="text-emerald-700" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-800 mt-1">
            {summary.totalQtl.toFixed(2)} QTL
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">All-time recorded outwards</div>
        </div>

        <div className="glass-panel p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Recorded Dispatches</span>
            <Layers size={14} className="text-blue-600" />
          </div>
          <div className="text-xl font-black font-mono text-blue-900 mt-1">
            {summary.totalCount} Loads
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Truck & issue movements</div>
        </div>
      </div>

      {/* Main Stock Outward Card */}
      <div className="bg-white rounded-xl border border-[#E8E2DC] shadow-xs overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 bg-gradient-to-r from-[#FAF9F6] to-white border-b border-[#E8E2DC] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
                <ArrowUpRight size={18} className="text-[#8F1717]" />
                <span>Stock Outward Register (Dispatches & Issues)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8F1717]/10 text-[#8F1717] border border-[#8F1717]/20">
                {filteredOutwards.length} Outward Entries
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                ⚡ Auto-Synced with Loading Register
              </span>
            </div>
            <p className="text-xs text-[#777777] mt-0.5">
              Live automated record of all truck dispatches from Master Loading Register, customer dispatches, and manual stock issues
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg border border-[#E8E2DC] transition-colors shadow-2xs cursor-pointer"
              title="Refresh outwards data"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#8F1717]' : 'text-gray-500'} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Issue internal stock or sample outward manually"
            >
              <Plus size={14} className="text-[#C69A3B]" />
              <span>Issue Manual Stock Outward</span>
            </button>
          </div>
        </div>

        {/* Filters Strip */}
        <div className="p-3 bg-[#FAF9F6] border-b border-[#E8E2DC] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-0.5 bg-white rounded-lg border border-[#E8E2DC] text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  typeFilter === 'all' ? 'bg-[#8F1717] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Outwards ({outwards.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('dispatches')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  typeFilter === 'dispatches' ? 'bg-[#8F1717] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🚚 Customer Dispatches ({outwards.filter(o => o.transaction_type === 'Customer Dispatch').length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('manual')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  typeFilter === 'manual' ? 'bg-[#8F1717] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📦 Manual Issues ({outwards.filter(o => o.transaction_type !== 'Customer Dispatch').length})
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-[#8F1717] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Vehicle, PO#, Buyer, Dispatch#..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="p-1.5 bg-white border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            >
              <option value="">All Rice Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <input
                type="date"
                title="From Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 p-1.5 bg-white border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-[11px]"
              />
              <input
                type="date"
                title="To Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 p-1.5 bg-white border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-[11px]"
              />
            </div>

            <div className="flex items-center justify-end px-2 text-[11px] text-gray-500 font-medium">
              <span>Selected Total: <strong className="text-[#8F1717] font-mono font-bold">{totalFilteredQtl.toFixed(2)} QTL</strong></span>
            </div>
          </div>
        </div>

        {/* Live Stock Outward Table */}
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <RefreshCw size={24} className="animate-spin text-[#8F1717]" />
              <span className="text-xs">Loading outward records & dispatches...</span>
            </div>
          ) : filteredOutwards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <ArrowUpRight size={32} className="text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">No stock outward records found</p>
              <p className="text-xs text-gray-400 max-w-sm text-center">
                When you record truck loadings in the Master Loading Register or post an outward issue, they will appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#8F1717] text-white uppercase text-[10px] tracking-wider font-semibold border-b border-[#C69A3B]/40">
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5 w-24">Date</th>
                  <th className="p-2.5 w-28">Dispatch #</th>
                  <th className="p-2.5 w-28">PO / Sub-PO #</th>
                  <th className="p-2.5 w-44">Buyer / Consignee</th>
                  <th className="p-2.5 w-36">Rice Product</th>
                  <th className="p-2.5 w-40">Issuing Mill / Source</th>
                  <th className="p-2.5 w-32 text-center">Vehicle Number</th>
                  <th className="p-2.5 w-28 text-right">Outward QTL</th>
                  <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                  <th className="p-2.5 w-28 text-right">Amount (₹)</th>
                  <th className="p-2.5 w-32 text-center">Movement Type</th>
                  <th className="p-2.5 min-w-[140px]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DC] font-sans">
                {filteredOutwards.map((item, idx) => {
                  const isDispatch = item.transaction_type === 'Customer Dispatch';
                  const qtl = Number(item.quantity || item.outward_quantity || 0);
                  const rate = Number(item.rate || 0);
                  const amt = Number(item.amount || qtl * rate || 0);

                  return (
                    <tr 
                      key={item.id ? `${item.transaction_type}-${item.id}` : idx} 
                      className="hover:bg-amber-50/40 transition-colors"
                    >
                      <td className="p-2.5 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-2.5 tabular-nums font-medium text-gray-800">
                        {formatDateDMY(item.date)}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-blue-800">
                        {item.dispatch_number || item.reference_number || '—'}
                      </td>
                      <td className="p-2.5">
                        {item.po_number ? (
                          <div>
                            <span className="font-semibold text-gray-900 block">{item.po_number}</span>
                            {item.sub_order_no && (
                              <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {item.sub_order_no}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Manual Issue</span>
                        )}
                      </td>
                      <td className="p-2.5 font-semibold text-gray-900">
                        {item.buyer_name || item.customer_name || item.destination || '—'}
                      </td>
                      <td className="p-2.5 text-gray-800">
                        <span className="font-medium">{item.product_name || 'Rice Product'}</span>
                      </td>
                      <td className="p-2.5 text-gray-600">
                        <span className="truncate block max-w-[150px]" title={item.source}>
                          {item.source || 'Mill Facility'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-[#8F1717]">
                        {item.vehicle_number ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-[#8F1717] px-2 py-0.5 rounded border border-red-200 text-[11px]">
                            <Truck size={11} />
                            {item.vehicle_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-rose-700 text-xs">
                        -{qtl.toFixed(2)} QTL
                      </td>
                      <td className="p-2.5 text-right font-mono text-gray-600">
                        {rate > 0 ? `₹${rate.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-gray-800">
                        {amt > 0 ? `₹${amt.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDispatch 
                            ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {isDispatch ? 'Customer Dispatch' : (item.transaction_type || 'Internal Issue')}
                        </span>
                      </td>
                      <td className="p-2.5 text-gray-500 text-[11px] truncate max-w-[180px]" title={item.remarks}>
                        {item.remarks || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Sticky Table Footer */}
        {filteredOutwards.length > 0 && (
          <div className="p-3 bg-[#FAF9F6] border-t border-[#E8E2DC] flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Showing <strong className="text-gray-900 font-bold">{filteredOutwards.length}</strong> of <strong className="text-gray-900 font-bold">{outwards.length}</strong> outward movements
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Total Filtered Outward:</span>
              <span className="text-sm font-black font-mono text-[#8F1717] bg-white px-3 py-1 rounded-lg border border-red-200 shadow-2xs">
                {totalFilteredQtl.toFixed(2)} QTL
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Stock Outward Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Post Manual Stock Outward / Sample Issue"
        subtitle="Issue physical stock from milling units for lab sampling, packaging yard, or internal consumption"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Outward Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Transaction Type *</label>
              <select
                required
                value={form.transactionType}
                onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="Internal Stock Issue">Internal Stock Issue / Sampling</option>
                <option value="Customer Dispatch">Customer Dispatch (Manual Outward)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Rice Product *</label>
              <select
                required
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code}) — Available: {p.available_stock} QTL</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Issuing Mill *</label>
              <select
                required
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Issuing Mill</option>
                {mills.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.location})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Outward Quantity (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 25.00"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Destination</label>
              <input
                type="text"
                placeholder="e.g. Quality Lab / Packaging Yard"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Reason / Remarks</label>
            <textarea
              rows={2}
              placeholder="Authorization reason, gate pass number..."
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded-lg focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 font-bold text-white bg-[#8F1717] hover:bg-[#771212] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Verifying & Posting...' : 'Post Outward from Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
