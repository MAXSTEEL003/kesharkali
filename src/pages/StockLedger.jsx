// src/pages/StockLedger.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Filter, Search, ArrowDownLeft, ArrowUpRight, RotateCcw, X } from 'lucide-react';
import { api, downloadBlob } from '../api';
import { useNotification } from '../context/NotificationContext';

export default function StockLedger({ setActiveTab, onNewInward, onNewOutward }) {
  const { showToast } = useNotification();
  const [ledger, setLedger] = useState([]);
  const [products, setProducts] = useState([]);
  const [mills, setMills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ledgerRes, prodRes, indRes] = await Promise.all([
        api.stock.getLedger({ productId, warehouseId, transactionType, startDate, endDate, search }),
        api.products.getAll(),
        api.industries.getAll()
      ]);
      setLedger(ledgerRes.ledger || []);
      setProducts(prodRes.products || []);
      setMills(indRes.industries || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      showToast(`Error loading ledger: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [productId, warehouseId, transactionType, startDate, endDate, search]);

  const hasActiveFilters = Boolean(productId || warehouseId || transactionType || startDate || endDate || search.trim());

  const handleClearFilters = () => {
    setProductId('');
    setWarehouseId('');
    setTransactionType('');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  // Immediate client-side reactive filtering for zero-latency keystrokes
  const filteredLedger = useMemo(() => {
    return ledger.filter(row => {
      if (productId && String(row.product_id) !== String(productId)) return false;
      if (warehouseId && String(row.warehouse_id) !== String(warehouseId)) return false;
      if (transactionType && row.transaction_type !== transactionType) return false;
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match = (
          row.transaction_number?.toLowerCase().includes(q) ||
          row.reference_number?.toLowerCase().includes(q) ||
          row.source?.toLowerCase().includes(q) ||
          row.destination?.toLowerCase().includes(q) ||
          row.product_name?.toLowerCase().includes(q) ||
          row.transaction_type?.toLowerCase().includes(q) ||
          row.remarks?.toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      return true;
    });
  }, [ledger, productId, warehouseId, transactionType, startDate, endDate, search]);

  const handleExportExcel = async () => {
    try {
      const blob = await api.reports.exportStockLedger({ productId });
      downloadBlob(blob, `Keshar_Kali_Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Stock Ledger Excel export downloaded successfully!', 'success');
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Export Toolbar */}
      <div className="glass-panel rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E2DC]/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
                <FileText size={18} className="text-[#8F1717]" />
                Authoritative Stock Ledger (Running Balance)
              </h1>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8F1717]/10 text-[#8F1717] border border-[#8F1717]/20">
                  Filtered ({filteredLedger.length} of {ledger.length})
                </span>
              )}
            </div>
            <p className="text-xs text-[#777777]">
              Chronological inventory transaction accounting with immutable running balances
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(onNewInward || setActiveTab) && (
              <button
                type="button"
                onClick={() => onNewInward ? onNewInward() : setActiveTab('inward')}
                className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-[#8F1717] to-[#771212] hover:from-[#771212] hover:to-[#5E1010] text-white px-3.5 py-1.5 rounded-xl border border-[#C69A3B]/40 shadow-[0_0_12px_rgba(143,23,23,0.3)] hover:shadow-[0_0_18px_rgba(143,23,23,0.5)] transition-all"
              >
                <ArrowDownLeft size={14} className="text-[#C69A3B]" />
                <span>+ Stock Inward</span>
              </button>
            )}

            {(onNewOutward || setActiveTab) && (
              <button
                type="button"
                onClick={() => onNewOutward ? onNewOutward() : setActiveTab('outward')}
                className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-[#5E1010] to-[#480c0c] hover:from-[#480c0c] hover:to-[#380909] text-white px-3.5 py-1.5 rounded-xl border border-white/20 shadow-[0_0_12px_rgba(94,16,16,0.3)] hover:shadow-[0_0_18px_rgba(94,16,16,0.5)] transition-all"
              >
                <ArrowUpRight size={14} />
                <span>- Stock Outward</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white px-3.5 py-1.5 rounded-xl border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_18px_rgba(16,185,129,0.5)] transition-all"
            >
              <Download size={14} />
              <span>Export Genuine Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <div className="relative md:col-span-1">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search ledger..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>

          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Mills / Facilities</option>
            {mills.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Transaction Types</option>
            <option value="Opening Stock">Opening Stock</option>
            <option value="Stock Replenished">Stock Replenished</option>
            <option value="Purchase Inward">Purchase Inward</option>
            <option value="Customer Dispatch">Customer Dispatch</option>
            <option value="Stock Transfer In">Stock Transfer In</option>
            <option value="Stock Transfer Out">Stock Transfer Out</option>
            <option value="Stock Adjustment In">Stock Adjustment In</option>
            <option value="Stock Adjustment Out">Stock Adjustment Out</option>
            <option value="Internal Stock Issue">Internal Stock Issue</option>
          </select>

          <div className="flex items-center gap-1">
            <input
              type="date"
              title="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-[11px]"
            />
            <input
              type="date"
              title="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-[11px]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full flex items-center justify-center gap-1 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded text-xs transition-colors cursor-pointer"
                title="Clear all active filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Traditional Accounting Ledger Grid */}
      <div className="glass-panel rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-center">Date</th>
                <th className="text-left">Rice Product</th>
                <th className="text-left">Transaction Type</th>
                <th className="text-left">Ref Document</th>
                <th className="text-left">Source</th>
                <th className="text-left">Destination</th>
                <th className="text-right">Stock Inward (QTL)</th>
                <th className="text-right">Stock Outward (QTL)</th>
                <th className="text-right bg-[#700f0f]">Running Balance (QTL)</th>
                <th className="text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-xs text-gray-400">
                    {hasActiveFilters ? (
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">No ledger entries match your filter criteria.</p>
                        <button
                          onClick={handleClearFilters}
                          className="mt-1 text-xs text-[#8F1717] font-semibold hover:underline"
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : (
                      'No ledger entries found.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row, idx) => {
                  const isInward = Number(row.inward_quantity) > 0;
                  const isOutward = Number(row.outward_quantity) > 0;

                  return (
                    <tr key={row.id} className="hover:bg-amber-50/40">
                      <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                      <td className="text-center text-xs font-mono">{row.date}</td>
                      <td className="font-semibold text-[#252525]">{row.product_name}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800">
                          {row.transaction_type}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-gray-600">{row.reference_number || '—'}</td>
                      <td className="text-xs text-gray-600 truncate max-w-[160px]">{row.source || '—'}</td>
                      <td className="text-xs text-gray-600 truncate max-w-[160px]">{row.destination || '—'}</td>
                      
                      <td className="text-right font-mono font-bold text-emerald-700">
                        {isInward ? `+${Number(row.inward_quantity).toFixed(2)}` : '—'}
                      </td>

                      <td className="text-right font-mono font-bold text-red-700">
                        {isOutward ? `-${Number(row.outward_quantity).toFixed(2)}` : '—'}
                      </td>

                      <td className="text-right font-mono font-bold text-[#8F1717] bg-amber-50/30">
                        {Number(row.running_balance).toFixed(2)}
                      </td>

                      <td className="text-xs text-gray-500 truncate max-w-xs">{row.remarks || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


