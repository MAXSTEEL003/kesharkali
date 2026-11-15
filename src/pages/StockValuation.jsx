// src/pages/StockValuation.jsx
import React, { useState, useEffect } from 'react';
import { TrendingUp, Layers, Download, CheckCircle2 } from 'lucide-react';
import { api, downloadBlob } from '../api';

export default function StockValuation() {
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await api.stock.getValuation();
        setValuation(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="text-center py-12 text-xs text-gray-500">Calculating weighted average valuation...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 text-xs">Error: {error}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <TrendingUp size={18} className="text-[#8F1717]" />
            Stock Valuation & Weighted Average Cost (WAC)
          </h1>
          <p className="text-xs text-[#777777]">
            Realized inventory asset value calculated across all mill purchase entries
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="bg-[#FAF9F6] border border-[#E8E2DC] px-3.5 py-2 rounded-lg text-right">
            <div className="text-[10px] uppercase text-gray-500 font-semibold">Total Stock</div>
            <div className="text-sm font-bold font-mono text-[#8F1717]">{valuation.grandTotalStock} QTL</div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#E8E2DC] px-3.5 py-2 rounded-lg text-right">
            <div className="text-[10px] uppercase text-gray-500 font-semibold">Grand Asset Valuation</div>
            <div className="text-sm font-bold font-mono text-emerald-700">₹{valuation.grandTotalValue.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Product-Wise Valuation Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Product Code</th>
                <th className="text-left">Rice Product</th>
                <th className="text-left">Brand</th>
                <th className="text-left">Variety</th>
                <th className="text-right">Physical Balance</th>
                <th className="text-right">Available Stock</th>
                <th className="text-right">Weighted Avg Purchase Rate</th>
                <th className="text-right bg-[#700f0f]">Total Stock Valuation (₹)</th>
              </tr>
            </thead>
            <tbody>
              {valuation.products.map((p, idx) => (
                <tr key={p.productId} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="font-mono text-xs font-semibold text-gray-600">{p.productCode}</td>
                  <td className="font-semibold text-[#252525]">{p.productName}</td>
                  <td>{p.brand}</td>
                  <td className="text-xs text-gray-500">{p.variety}</td>
                  <td className="text-right font-mono font-bold text-[#8F1717]">{p.physicalStock}</td>
                  <td className="text-right font-mono font-bold text-emerald-700">{p.availableStock}</td>
                  <td className="text-right font-mono font-semibold">₹{p.avgPurchaseRate.toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-emerald-800 bg-amber-50/30">
                    ₹{p.totalStockValue.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FAF9F6] font-bold border-t-2 border-[#8F1717] text-xs">
                <td colSpan={5} className="text-right uppercase py-3 px-4">Grand Total Inventory Position:</td>
                <td className="text-right font-mono text-[#8F1717] py-3 px-2">{valuation.grandTotalStock} QTL</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="text-right font-mono text-emerald-800 text-sm py-3 px-2">
                  ₹{valuation.grandTotalValue.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

