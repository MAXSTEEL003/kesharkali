// src/pages/StockTransfers.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, CheckCircle2, Warehouse, Truck } from 'lucide-react';
import { api } from '../api';

export default function StockTransfers() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    sourceWarehouseId: '',
    destWarehouseId: '',
    quantity: '',
    vehicleNumber: '',
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
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.sourceWarehouseId === form.destWarehouseId) {
      setErrorMsg('Source and Destination warehouse cannot be identical');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.stock.transfer(form);
      setSuccessMsg(`Inter-warehouse Transfer posted! Transfer Ref: ${res.result.transferNumber}. Transferred ${res.result.quantity} QTL from ${res.result.source} to ${res.result.destination}`);
      setForm({
        date: new Date().toISOString().split('T')[0],
        productId: '',
        sourceWarehouseId: '',
        destWarehouseId: '',
        quantity: '',
        vehicleNumber: '',
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
              <ArrowLeftRight size={18} className="text-[#8F1717]" />
              Inter-Warehouse Stock Transfer
            </h1>
            <p className="text-xs text-[#777777]">
              Atomic transfer between supplier godowns with dual-side transactional ledger entries
            </p>
          </div>
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
              <label className="block font-semibold text-[#252525] mb-1">Transfer Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
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
                  <option key={p.id} value={p.id}>{p.name} ({p.code}) — Total Stock: {p.physical_stock} QTL</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Source Warehouse (Transfer Out) *</label>
              <select
                required
                value={form.sourceWarehouseId}
                onChange={(e) => setForm({ ...form, sourceWarehouseId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Source Godown</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} (Stock: {w.current_stock} QTL)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Destination Warehouse (Transfer In) *</label>
              <select
                required
                value={form.destWarehouseId}
                onChange={(e) => setForm({ ...form, destWarehouseId: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Destination Godown</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} (Stock: {w.current_stock} QTL)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Transfer Quantity (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 50.00"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Internal Truck / Vehicle Number</label>
              <input
                type="text"
                placeholder="e.g. MH-31-TR-5021"
                value={form.vehicleNumber}
                onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Transfer Remarks</label>
            <textarea
              rows={2}
              placeholder="Shifting lot for Kalamna siding dispatch..."
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
              {submitting ? 'Transferring...' : 'Execute Inter-Godown Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

