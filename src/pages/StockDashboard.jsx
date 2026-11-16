// src/pages/StockDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Warehouse, Scale, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownLeft, FileText, Layers, TrendingUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import { api } from '../api';

export default function StockDashboard({ setActivePage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.stock.getDashboard();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-xs text-gray-500">Loading stock inventory position...</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 text-xs">Error: {error}</div>;
  }

  const { totalPhysicalStock, totalAvailableStock, stockReceivedThisMonth, stockOutwardThisMonth, lowStockCount, totalStockValue, productSummary, warehouseBreakdown } = data;

  return (
    <div className="space-y-5">
      {/* Header & Quick Action Buttons */}
      <div className="glass-panel rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk']">
            Stock Management & Mill Inventory Position
          </h1>
          <p className="text-xs text-[#777777]">
            Authoritative physical balance and live running ledger accounting across milling units
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActivePage('stock-inward')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3 py-1.5 rounded transition-colors shadow-xs"
          >
            <ArrowDownLeft size={14} />
            <span>Stock Inward</span>
          </button>

          <button
            onClick={() => setActivePage('stock-outward')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#5E1010] hover:bg-[#480c0c] text-white px-3 py-1.5 rounded transition-colors shadow-xs"
          >
            <ArrowUpRight size={14} />
            <span>Stock Outward</span>
          </button>

          <button
            onClick={() => setActivePage('stock-transfers')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-[#252525] px-3 py-1.5 rounded transition-colors shadow-xs"
          >
            <span>Inter-Mill Transfer</span>
          </button>

          <button
            onClick={() => setActivePage('stock-adjustments')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-[#252525] px-3 py-1.5 rounded transition-colors shadow-xs"
          >
            <span>Stock Audit</span>
          </button>

          <button
            onClick={() => setActivePage('stock-ledger')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#C69A3B] text-[#5E1010] px-3 py-1.5 rounded hover:bg-[#b08730] transition-colors shadow-xs"
          >
            <FileText size={14} />
            <span>View Ledger</span>
          </button>
        </div>
      </div>

      {/* Row 1: Stock KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Physical Stock"
          value={`${totalPhysicalStock.toLocaleString('en-IN')} QTL`}
          subtext="Audited Mill Total"
          icon={Warehouse}
          color="red"
          onClick={() => setActivePage('stock-ledger')}
        />
        <StatCard
          label="Available Stock"
          value={`${totalAvailableStock.toLocaleString('en-IN')} QTL`}
          subtext="Ready for Dispatch"
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Inward This Month"
          value={`${stockReceivedThisMonth.toLocaleString('en-IN')} QTL`}
          subtext="Replenishments & Purchases"
          icon={ArrowDownLeft}
          color="gold"
          onClick={() => setActivePage('stock-inward')}
        />
        <StatCard
          label="Outward This Month"
          value={`${stockOutwardThisMonth.toLocaleString('en-IN')} QTL`}
          subtext="Customer Deliveries & Issues"
          icon={ArrowUpRight}
          color="gray"
          onClick={() => setActivePage('stock-outward')}
        />
        <StatCard
          label="Total Stock Value"
          value={`₹${(totalStockValue || 0).toLocaleString('en-IN')}`}
          subtext="Weighted Average Cost"
          icon={TrendingUp}
          color="gold"
          onClick={() => setActivePage('stock-valuation')}
        />
      </div>

      {/* Warehouse Occupancy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouseBreakdown.map(w => (
          <div key={w.warehouseId} className="glass-card-base p-4 border border-[#E8E2DC]/80 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#8F1717]">{w.warehouseName}</span>
              <span className="font-mono text-gray-500">{w.utilizationPct}% Cap</span>
            </div>
            <div className="text-[11px] text-gray-500 mb-2 truncate">{w.location}</div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-lg font-bold font-mono text-[#252525]">{w.occupiedQtl} QTL</span>
              <span className="text-xs text-gray-400 font-mono">/ {w.capacityQtl} QTL</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${w.utilizationPct > 85 ? 'bg-red-600' : 'bg-[#8F1717]'}`}
                style={{ width: `${Math.min(100, w.utilizationPct)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Product-Wise Stock Summary Table */}
      <div className="glass-panel rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] flex items-center gap-1.5">
            <Layers size={14} />
            Product Inventory Position & Safety Thresholds
          </h3>
          <button
            onClick={() => setActivePage('stock-ledger')}
            className="text-xs font-semibold text-[#8F1717] hover:underline"
          >
            Chronological Ledger →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Code</th>
                <th className="text-left">Product Name</th>
                <th className="text-left">Brand Tier</th>
                <th className="text-left">Variety</th>
                <th className="text-right">Opening Stock</th>
                <th className="text-right">Total Inward</th>
                <th className="text-right">Total Outward</th>
                <th className="text-right">Physical Balance</th>
                <th className="text-right">Available Stock</th>
                <th className="text-right">Min Safety Level</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {productSummary.map((p, idx) => (
                <tr key={p.productId} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="font-mono text-xs font-semibold text-gray-600">{p.productCode}</td>
                  <td className="font-semibold text-[#252525]">{p.productName}</td>
                  <td>{p.brand}</td>
                  <td className="text-xs text-gray-500">{p.variety}</td>
                  <td className="text-right font-mono">{p.openingStock}</td>
                  <td className="text-right font-mono text-emerald-700">+{p.totalInward}</td>
                  <td className="text-right font-mono text-red-700">-{p.totalOutward}</td>
                  <td className="text-right font-mono font-bold text-[#8F1717]">{p.physicalBalance}</td>
                  <td className="text-right font-mono font-bold text-emerald-700">{p.availableQuantity}</td>
                  <td className="text-right font-mono text-gray-500">{p.minThreshold}</td>
                  <td className="text-center">
                    {p.isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle size={10} /> LOW STOCK
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        HEALTHY
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

