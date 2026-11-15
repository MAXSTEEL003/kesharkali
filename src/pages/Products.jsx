// src/pages/Products.jsx
import React, { useState, useEffect } from 'react';
import { Layers, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    brand: 'Keshar Kali',
    variety: '',
    unit: 'QTL',
    min_stock_threshold: '50',
    standard_selling_rate: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.products.getAll();
      setProducts(res.products || []);
    } catch (err) {
      alert(`Failed to load products: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await api.products.create(form);
      setIsAddOpen(false);
      setForm({
        code: '',
        name: '',
        brand: 'Keshar Kali Select',
        variety: '',
        unit: 'QTL',
        min_stock_threshold: '50',
        standard_selling_rate: ''
      });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <Layers size={18} className="text-[#8F1717]" />
            Rice Varieties & Product Master
          </h1>
          <p className="text-xs text-[#777777]">
            Standardized commodity definitions, brand grades, and automatic low-stock safety thresholds (1 QTL = 100 KG)
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>Add Product Variety</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Product Code</th>
                <th className="text-left">Product Name</th>
                <th className="text-left">Brand Label</th>
                <th className="text-left">Rice Variety</th>
                <th className="text-center">Unit</th>
                <th className="text-right">Benchmark Selling Rate</th>
                <th className="text-right">Min Threshold</th>
                <th className="text-right">Physical Stock</th>
                <th className="text-right bg-[#700f0f]">Available Stock</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={p.id} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="font-mono text-xs font-bold text-[#8F1717]">{p.code}</td>
                  <td className="font-semibold text-[#252525]">{p.name}</td>
                  <td>{p.brand}</td>
                  <td className="text-xs text-gray-600">{p.variety}</td>
                  <td className="text-center font-mono text-xs font-semibold">{p.unit}</td>
                  <td className="text-right font-mono font-bold">₹{p.standard_selling_rate}</td>
                  <td className="text-right font-mono text-gray-500">{p.min_stock_threshold} QTL</td>
                  <td className="text-right font-mono font-bold text-[#8F1717]">{p.physical_stock}</td>
                  <td className="text-right font-mono font-bold text-emerald-700 bg-amber-50/30">
                    {p.available_stock} QTL
                  </td>
                  <td className="text-center">
                    {p.is_low_stock ? (
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

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Rice Product Variety"
        subtitle="Catalog rice commodity variety, brand tier, and safety threshold"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Product Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. PROD-KK"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Keshar Kali / Keshar Kali 5 kgs / Keshar Kali 10 kg"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Brand Tier</label>
              <input
                type="text"
                placeholder="e.g. Keshar Kali"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Rice Variety / Grain Polish</label>
              <input
                type="text"
                placeholder="e.g. Medium Slender Steam Polished"
                value={form.variety}
                onChange={(e) => setForm({ ...form, variety: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Benchmark Selling Rate (₹/QTL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 3200.00"
                value={form.standard_selling_rate}
                onChange={(e) => setForm({ ...form, standard_selling_rate: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Min Safety Stock Level (QTL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 50.00"
                value={form.min_stock_threshold}
                onChange={(e) => setForm({ ...form, min_stock_threshold: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs"
            >
              Save Product Variety
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

