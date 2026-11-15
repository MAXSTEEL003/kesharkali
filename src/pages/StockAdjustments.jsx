// src/pages/StockAdjustments.jsx
import React, { useState, useEffect } from 'react';
import { Scale, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../api';

export default function StockAdjustments({ setActivePage, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    warehouseId: '',
    physicalStock: '',
    reason: '',
    authorizedBy: 'Rajendra Deshmukh (Admin)'
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, whRes] = await Promise.all([
          api.products.getAll(),
          api.warehouses.getAll()
        ]);
        setProducts(prodRes.products || []);
        setWarehouses(whRes.warehouses || []);
      } catch (err) {
        setErrorMsg(err.message);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.stock.adjust(form);
      setSuccessMsg(`Stock Adjustment recorded in audit ledger! Ref: ${res.result.adjustmentNumber || 'ADJ'}. Difference: ${res.result.difference > 0 ? '+' : ''}${res.result.difference} QTL.`);
      if (onSuccess) onSuccess();
      setForm({
        ...form,
        physicalStock: '',
        reason: ''
      });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="glass-panel rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E2DC]/80">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Scale size={18} className="text-[#8F1717]" />
              Stock Audit & Physical Count Reconciliation
            </h1>
            <p className="text-xs text-[#777777]">
              Strictly non-destructive accounting: Never overwrites history; generates auditable adjustment transactions
            </p>
          </div>
          {setActivePage && (
            <button
              onClick={() => setActivePage('ledger')}
              className="text-xs font-semibold text-[#8F1717] hover:underline"
            >
              View Stock Ledger →
            </button>
          )}
        </div>

        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Audit Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Authorized By *</label>
              <input
                type="text"
                required
                value={form.authorizedBy}
                onChange={(e) => setForm({ ...form, authorizedBy: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Rice Product *</label>
              <select
                required
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Warehouse / Godown Audited *</label>
              <select
                required
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#252525] mb-1">Actual Physical Count (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Enter verified physical scale count..."
                value={form.physicalStock}
                onChange={(e) => setForm({ ...form, physicalStock: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono text-sm focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Adjustment Reason *</label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Physical inventory count variance, natural moisture loss, bagging spillage..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-2">
            <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Audit Guarantee:</strong> Submitting this adjustment calculates the mathematical difference against system stock and appends a `Stock Adjustment In` or `Stock Adjustment Out` entry with running balance recalculation. Historical stock balances remain intact.
            </span>
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 font-semibold text-xs bg-[#8F1717] text-white rounded hover:bg-[#771212] transition-colors shadow-xs"
            >
              {submitting ? 'Reconciling...' : 'Record Audit Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

