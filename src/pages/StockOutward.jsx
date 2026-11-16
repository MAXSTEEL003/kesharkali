// src/pages/StockOutward.jsx
import React, { useState, useEffect } from 'react';
import { ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api';

export default function StockOutward({ setActivePage, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [mills, setMills] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

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

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, indRes] = await Promise.all([
          api.products.getAll(),
          api.industries.getAll()
        ]);
        const inds = indRes.industries || [];
        setProducts(prodRes.products || []);
        setMills(inds);
        const def = inds.find(i => i.is_default === 1) || inds[0];
        if (def) {
          setForm(prev => ({ ...prev, warehouseId: String(def.id) }));
        }
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
      const res = await api.stock.outward(form);
      setSuccessMsg(`Stock Outward successfully posted! Transaction: ${res.result.transactionNumber}. Remaining Balance: ${res.result.runningBalance} QTL`);
      if (onSuccess) onSuccess();
      setForm({
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
              <ArrowUpRight size={18} className="text-[#5E1010]" />
              Stock Outward Issue Form
            </h1>
            <p className="text-xs text-[#777777]">
              Issue physical stock from milling units with strict available stock validation
            </p>
          </div>
          <button
            onClick={() => setActivePage('stock-ledger')}
            className="text-xs font-semibold text-[#8F1717] hover:underline"
          >
            View Stock Ledger →
          </button>
        </div>

        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePage && setActivePage('ledger')}
                className="font-bold underline text-emerald-900 hover:text-black"
              >
                View in Ledger →
              </button>
              <span className="text-emerald-300">|</span>
              <button
                type="button"
                onClick={() => setActivePage && setActivePage('inward')}
                className="font-bold underline text-emerald-900 hover:text-black"
              >
                Post Inward Next →
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Outward Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Transaction Type *</label>
              <select
                required
                value={form.transactionType}
                onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
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
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
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
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
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
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Destination</label>
              <input
                type="text"
                placeholder="e.g. Quality Lab / Packaging Yard"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
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
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#E8E2DC]/80 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 font-bold text-xs bg-gradient-to-r from-[#8F1717] to-[#771212] hover:from-[#771212] hover:to-[#5E1010] text-white rounded-xl shadow-[0_0_15px_rgba(143,23,23,0.35)] hover:shadow-[0_0_22px_rgba(143,23,23,0.55)] border border-[#C69A3B]/40 transition-all"
            >
              {submitting ? 'Verifying & Posting...' : 'Post Outward from Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

