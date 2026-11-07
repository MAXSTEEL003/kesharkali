// src/pages/IndustrySourcing.jsx
import React, { useState, useEffect } from 'react';
import { Factory, TrendingUp, Filter, AlertCircle, Plus, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function IndustrySourcing() {
  const [allocations, setAllocations] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocRes, indRes] = await Promise.all([
        api.allocations.getByPo(''),
        api.industries.getAll()
      ]);
      setAllocations(allocRes.allocations || []);
      setIndustries(indRes.industries || []);
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

  const totalAllocatedQtl = allocations.reduce((s, a) => s + Number(a.allocated_quantity || 0), 0);
  const totalLoadedQtl = allocations.reduce((s, a) => s + Number(a.loaded_quantity || 0), 0);
  const totalPendingLoadingQtl = allocations.reduce((s, a) => s + Number(a.pending_loading_quantity || 0), 0);
  const totalProcurementAmount = allocations.reduce((s, a) => s + Number(a.purchase_amount || 0), 0);
  const overallWeightedRate = totalAllocatedQtl > 0 ? (totalProcurementAmount / totalAllocatedQtl).toFixed(2) : 0;

  return (
    <div className="space-y-4">
      {/* Sourcing Header & Confidentiality Notice */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk']">
              Industry Sourcing & Multi-Mill Sourcing Portfolio
            </h1>
            <span className="bg-red-100 text-[#8F1717] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Confidential Internal
            </span>
          </div>
          <p className="text-xs text-[#777777]">
            Consolidated mill procurement contracts, purchase allocations, and fulfillment pipelines
          </p>
        </div>
      </div>

      {/* Sourcing Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-[#8F1717]">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Total Allocated Sourcing</div>
          <div className="text-xl font-bold font-mono text-[#252525] mt-1">{totalAllocatedQtl.toLocaleString('en-IN')} QTL</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{allocations.length} Active Sourcing Commitments</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-indigo-600">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Loaded from Mills</div>
          <div className="text-xl font-bold font-mono text-indigo-700 mt-1">{totalLoadedQtl.toLocaleString('en-IN')} QTL</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">{totalAllocatedQtl > 0 ? ((totalLoadedQtl / totalAllocatedQtl) * 100).toFixed(1) : 0}% Realized</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-amber-500">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Pending Mill Loading</div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">{totalPendingLoadingQtl.toLocaleString('en-IN')} QTL</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Awaiting Trucks & Mill Bags</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs border-l-4 border-l-[#C69A3B]">
          <div className="text-[11px] font-semibold uppercase text-gray-500">Weighted Purchase Rate</div>
          <div className="text-xl font-bold font-mono text-[#8F1717] mt-1">₹{overallWeightedRate}/QTL</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Cost: ₹{totalProcurementAmount.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Sourcing Allocations Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Industry / Rice Mill</th>
                <th className="text-left">Location</th>
                <th className="text-left">Customer PO</th>
                <th className="text-left">Buyer</th>
                <th className="text-left">Product</th>
                <th className="text-right">Allocated QTL</th>
                <th className="text-right">Purchase Rate</th>
                <th className="text-right">Total Cost</th>
                <th className="text-right">Loaded QTL</th>
                <th className="text-right">Pending Loading</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-xs text-gray-400">
                    No sourcing allocations found.
                  </td>
                </tr>
              ) : (
                allocations.map((alloc, idx) => (
                  <tr key={alloc.id} className="hover:bg-amber-50/40">
                    <td className="text-center font-mono text-[11px] text-gray-500">{idx + 1}</td>
                    <td className="font-semibold text-[#8F1717]">{alloc.industry_name}</td>
                    <td className="text-xs text-gray-600">{alloc.industry_location}</td>
                    <td className="font-semibold">{alloc.po_number}</td>
                    <td>{alloc.customer_name}</td>
                    <td>{alloc.product_name}</td>
                    <td className="text-right font-mono font-bold text-purple-700">{alloc.allocated_quantity}</td>
                    <td className="text-right font-mono">₹{alloc.purchase_rate}</td>
                    <td className="text-right font-mono font-semibold">₹{Number(alloc.purchase_amount).toLocaleString('en-IN')}</td>
                    <td className="text-right font-mono text-indigo-700">{alloc.loaded_quantity}</td>
                    <td className="text-right font-mono text-amber-700 font-bold">{alloc.pending_loading_quantity}</td>
                    <td className="text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {alloc.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

