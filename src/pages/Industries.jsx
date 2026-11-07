// src/pages/Industries.jsx
import React, { useState, useEffect } from 'react';
import { Factory, Plus, Phone, MapPin, Eye, FileSpreadsheet, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';

export default function Industries() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [industryDetails, setIndustryDetails] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    location: '',
    contact_person: '',
    phone: '',
    available_products: '',
    default_purchase_rate: '',
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.industries.getAll();
      setIndustries(res.industries || []);
    } catch (err) {
      alert(`Failed to load industries: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleViewIndustry = async (id) => {
    try {
      setSelectedIndustry(id);
      const res = await api.industries.getById(id);
      setIndustryDetails(res);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateIndustry = async (e) => {
    e.preventDefault();
    try {
      await api.industries.create(form);
      setIsAddOpen(false);
      setForm({
        name: '',
        location: '',
        contact_person: '',
        phone: '',
        available_products: '',
        default_purchase_rate: '',
        notes: ''
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
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Factory size={18} className="text-[#8F1717]" />
              Industry & Rice Mill Master Register
            </h1>
            <span className="bg-red-100 text-[#8F1717] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              Confidential Sourcing Network
            </span>
          </div>
          <p className="text-xs text-[#777777]">
            Maintain internal supplier rice mills, procurement rates, loading history, and allocations
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>Add Rice Mill</span>
        </button>
      </div>

      {/* Industries Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Industry / Rice Mill</th>
                <th className="text-left">Mill Location</th>
                <th className="text-left">Contact Person</th>
                <th className="text-center">Phone</th>
                <th className="text-left">Available Products</th>
                <th className="text-right">Standard Rate (₹)</th>
                <th className="text-right">Allocated QTL</th>
                <th className="text-right">Loaded QTL</th>
                <th className="text-right bg-[#700f0f]">Pending Loading (QTL)</th>
                <th className="text-center w-20">History</th>
              </tr>
            </thead>
            <tbody>
              {industries.map((ind, idx) => (
                <tr key={ind.id} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="font-semibold text-[#8F1717] cursor-pointer hover:underline" onClick={() => handleViewIndustry(ind.id)}>
                    {ind.name}
                  </td>
                  <td>{ind.location}</td>
                  <td>{ind.contact_person || '—'}</td>
                  <td className="text-center font-mono text-xs">{ind.phone || '—'}</td>
                  <td className="text-xs text-gray-600">{ind.available_products || '—'}</td>
                  <td className="text-right font-mono font-semibold">₹{ind.default_purchase_rate}</td>
                  <td className="text-right font-mono font-bold text-purple-700">{Number(ind.total_allocated_qtl).toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-indigo-700">{Number(ind.total_loaded_qtl).toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                    {Number(ind.pending_loading_qtl).toFixed(2)}
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => handleViewIndustry(ind.id)}
                      className="p-1 rounded text-[#8F1717] hover:bg-red-50"
                      title="View Mill Loading History"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Industry Detail Modal */}
      {selectedIndustry && industryDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedIndustry(null)}
          title={`Sourcing Partner Profile — ${industryDetails.industry.name}`}
          subtitle={`Location: ${industryDetails.industry.location} | Contact: ${industryDetails.industry.contact_person} (${industryDetails.industry.phone})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Loading Entries from this Mill */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC]">
              <h4 className="font-bold text-[#8F1717] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Truck Loading History</span>
                <span className="font-mono">{industryDetails.loadingEntries.length} Loadings</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="excel-grid">
                  <thead>
                    <tr>
                      <th className="text-left">Loading ID</th>
                      <th className="text-center">Date</th>
                      <th className="text-left">Customer PO</th>
                      <th className="text-left">Buyer</th>
                      <th className="text-left">Product</th>
                      <th className="text-center">Vehicle</th>
                      <th className="text-right">Quantity (QTL)</th>
                      <th className="text-right">Purchase Rate</th>
                      <th className="text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industryDetails.loadingEntries.map(l => (
                      <tr key={l.id}>
                        <td className="font-semibold text-[#8F1717]">{l.loading_number}</td>
                        <td className="text-center">{l.loading_date}</td>
                        <td className="font-semibold">{l.po_number}</td>
                        <td>{l.customer_name}</td>
                        <td>{l.product_name}</td>
                        <td className="text-center font-mono">{l.vehicle_number}</td>
                        <td className="text-right font-mono font-bold text-indigo-700">{l.loading_quantity}</td>
                        <td className="text-right font-mono">₹{l.purchase_rate}</td>
                        <td className="text-right font-mono font-bold">₹{Number(l.loading_amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Industry Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Sourcing Industry (Rice Mill)"
        subtitle="Register new processing mill and benchmark purchase rate"
      >
        <form onSubmit={handleCreateIndustry} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Industry / Mill Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Balaji Modern Rice Mill"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Location / Industrial Zone *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bhandara Industrial Area"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Rameshji Balaji"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +91 94231 10001"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Available Rice Products</label>
              <input
                type="text"
                placeholder="e.g. HMT Rice, Kolam Rice"
                value={form.available_products}
                onChange={(e) => setForm({ ...form, available_products: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Standard Purchase Rate (₹/QTL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2850.00"
                value={form.default_purchase_rate}
                onChange={(e) => setForm({ ...form, default_purchase_rate: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Internal Notes</label>
            <textarea
              rows={2}
              placeholder="Sortex machine quality, weighbridge specs, loading capacity..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
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
              Save Rice Mill
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
