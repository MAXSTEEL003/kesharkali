// src/pages/StockInward.jsx
import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, CheckCircle2, Warehouse } from 'lucide-react';
import { api } from '../api';

export default function StockInward({ setActivePage }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    warehouseId: '',
    quantity: '',
    rate: '',
    transactionType: 'Purchase Inward',
    source: '',
    referenceNumber: '',
    remarks: ''
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
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.stock.inward(form);
      setSuccessMsg(`Stock Inward successfully posted! Transaction: ${res.result.transactionNumber}. New Balance: ${res.result.runningBalance} QTL`);
      setForm({
        date: new Date().toISOString().split('T')[0],
        productId: '',
        warehouseId: '',
        quantity: '',
        rate: '',
        transactionType: 'Purchase Inward',
        source: '',
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
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E2DC]">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <ArrowDownLeft size={18} className="text-[#8F1717]" />
              Stock Inward Entry Form
            </h1>
            <p className="text-xs text-[#777777]">
              Post warehouse physical inventory receipt from rice mills, replenishments, or returns
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
              <label className="block font-semibold text-[#252525] mb-1">Inward Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Inward Transaction Type *</label>
              <select
                required
                value={form.transactionType}
                onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="Purchase Inward">Purchase Inward (from Mill)</option>
                <option value="Stock Replenished">Stock Replenished</option>
                <option value="Customer Return">Customer Return</option>
                <option value="Opening Stock">Opening Stock Balance</option>
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
                  <option key={p.id} value={p.id}>{p.name} ({p.code}) — Current Stock: {p.physical_stock} QTL</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Destination Warehouse / Godown *</label>
              <select
                required
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Inward Quantity (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 100.00"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Purchase / Inward Rate (₹/QTL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2850.00"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Source (Mill / Supplier / Transporter)</label>
              <input
                type="text"
                placeholder="e.g. Balaji Modern Mill, Bhandara"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Reference Document / Bilty #</label>
              <input
                type="text"
                placeholder="e.g. BLT-89021 or Truck Inward Slip"
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="Weighbridge slip details, quality check comments..."
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 font-semibold text-xs bg-[#8F1717] text-white rounded hover:bg-[#771212] transition-colors shadow-xs"
            >
              {submitting ? 'Posting...' : 'Post Inward to Stock Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

