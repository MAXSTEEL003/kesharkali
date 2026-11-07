// src/pages/StockLedger.jsx
import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, Search, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api, downloadBlob } from '../api';

export default function StockLedger() {
  const [ledger, setLedger] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
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
      const [ledgerRes, prodRes, whRes] = await Promise.all([
        api.stock.getLedger({ productId, warehouseId, transactionType, startDate, endDate, search }),
        api.products.getAll(),
        api.warehouses.getAll()
      ]);
      setLedger(ledgerRes.ledger || []);
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
  }, [productId, warehouseId, transactionType, startDate, endDate]);

  const handleExportExcel = async () => {
    try {
      const blob = await api.reports.exportStockLedger({ productId });
      downloadBlob(blob, `Keshar_Kali_Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Export Toolbar */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E2DC]">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <FileText size={18} className="text-[#8F1717]" />
              Authoritative Stock Ledger (Running Balance)
            </h1>
            <p className="text-xs text-[#777777]">
              Chronological inventory transaction accounting with immutable running balances
            </p>
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
          >
            <Download size={14} />
            <span>Export Genuine Excel (.xlsx)</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
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
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
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

          <input
            type="date"
            placeholder="From Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          />

          <input
            type="date"
            placeholder="To Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          />
        </div>
      </div>

      {/* Traditional Accounting Ledger Grid */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-center">Date</th>
                <th className="text-left">Txn Number</th>
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
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-xs text-gray-400">
                    No ledger entries found matching filters.
                  </td>
                </tr>
              ) : (
                ledger.map((row, idx) => {
                  const isInward = Number(row.inward_quantity) > 0;
                  const isOutward = Number(row.outward_quantity) > 0;

                  return (
                    <tr key={row.id} className="hover:bg-amber-50/40">
                      <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                      <td className="text-center text-xs font-mono">{row.date}</td>
                      <td className="font-mono text-xs font-semibold text-[#8F1717]">{row.transaction_number}</td>
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
