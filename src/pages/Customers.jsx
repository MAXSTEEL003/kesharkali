// src/pages/Customers.jsx
import React, { useState, useEffect } from 'react';
import { Users, Plus, Phone, MessageSquare, Building2, Eye, FileText, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    whatsapp_number: '',
    address: '',
    city: '',
    gstin: '',
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.customers.getAll();
      setCustomers(res.customers || []);
    } catch (err) {
      alert(`Failed to load customers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleViewCustomer = async (id) => {
    try {
      setLoadingDetails(true);
      setSelectedCustomer(id);
      const res = await api.customers.getById(id);
      setCustomerDetails(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.customers.create(form);
      setIsAddOpen(false);
      setForm({
        name: '',
        contact_person: '',
        phone: '',
        whatsapp_number: '',
        address: '',
        city: '',
        gstin: '',
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
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <Users size={18} className="text-[#8F1717]" />
            Customer & Buyer Master Directory
          </h1>
          <p className="text-xs text-[#777777]">
            Maintain wholesale client profiles, WhatsApp dispatch numbers, GSTIN, and lifetime order reconciliations
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Buyer / Firm Name</th>
                <th className="text-left">Contact Person</th>
                <th className="text-left">City / Market</th>
                <th className="text-center">WhatsApp Number</th>
                <th className="text-center">GSTIN</th>
                <th className="text-right">Total Orders</th>
                <th className="text-right">Ordered QTL</th>
                <th className="text-right">Dispatched QTL</th>
                <th className="text-right bg-[#700f0f]">Pending Due (QTL)</th>
                <th className="text-center w-20">Profile</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, idx) => (
                <tr key={c.id} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="font-semibold text-[#8F1717] cursor-pointer hover:underline" onClick={() => handleViewCustomer(c.id)}>
                    {c.name}
                  </td>
                  <td>{c.contact_person || '—'}</td>
                  <td>{c.city || '—'}</td>
                  <td className="text-center font-mono text-xs">{c.whatsapp_number}</td>
                  <td className="text-center font-mono text-xs text-gray-600">{c.gstin || '—'}</td>
                  <td className="text-right font-mono font-bold">{c.total_orders}</td>
                  <td className="text-right font-mono">{Number(c.total_ordered_qtl).toFixed(2)}</td>
                  <td className="text-right font-mono text-emerald-700 font-bold">{Number(c.total_dispatched_qtl).toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                    {Number(c.pending_qtl).toFixed(2)}
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => handleViewCustomer(c.id)}
                      className="p-1 rounded text-[#8F1717] hover:bg-red-50"
                      title="View Customer Order Ledger"
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

      {/* Customer Detail Drawer */}
      {selectedCustomer && customerDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCustomer(null)}
          title={`Buyer Account Statement — ${customerDetails.customer.name}`}
          subtitle={`GSTIN: ${customerDetails.customer.gstin || 'Unregistered'} | WhatsApp: ${customerDetails.customer.whatsapp_number} | City: ${customerDetails.customer.city}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Purchase Orders by Buyer */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC]">
              <h4 className="font-bold text-[#8F1717] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Contracted Purchase Orders</span>
                <span className="font-mono">{customerDetails.purchaseOrders.length} Orders</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="excel-grid">
                  <thead>
                    <tr>
                      <th className="text-left">PO Number</th>
                      <th className="text-center">Date</th>
                      <th className="text-left">Rice Product</th>
                      <th className="text-right">Ordered QTL</th>
                      <th className="text-right">Selling Rate</th>
                      <th className="text-right">Dispatched QTL</th>
                      <th className="text-right">Remaining QTL</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetails.purchaseOrders.map(po => (
                      <tr key={po.id}>
                        <td className="font-semibold text-[#8F1717]">{po.po_number}</td>
                        <td className="text-center">{po.po_date}</td>
                        <td>{po.product_name}</td>
                        <td className="text-right font-mono font-bold">{po.ordered_quantity}</td>
                        <td className="text-right font-mono">₹{po.customer_selling_rate}</td>
                        <td className="text-right font-mono text-emerald-700 font-bold">{po.dispatched_quantity}</td>
                        <td className="text-right font-mono text-amber-700 font-bold">{po.remaining_quantity}</td>
                        <td className="text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800">
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Customer Dispatch History */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC]">
              <h4 className="font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Customer Deliveries & Dispatches</span>
                <span className="font-mono">{customerDetails.dispatches.length} Dispatches</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="excel-grid">
                  <thead>
                    <tr>
                      <th className="text-left">Dispatch ID</th>
                      <th className="text-center">Date</th>
                      <th className="text-left">PO Number</th>
                      <th className="text-left">Product</th>
                      <th className="text-right">Quantity (QTL)</th>
                      <th className="text-center">Vehicle</th>
                      <th className="text-center">WhatsApp Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetails.dispatches.map(d => (
                      <tr key={d.id}>
                        <td className="font-semibold text-emerald-800">{d.dispatch_number}</td>
                        <td className="text-center">{d.dispatch_date}</td>
                        <td className="font-semibold">{d.po_number}</td>
                        <td>{d.product_name}</td>
                        <td className="text-right font-mono font-bold text-emerald-700">{d.dispatch_quantity} QTL</td>
                        <td className="text-center font-mono">{d.vehicle_number}</td>
                        <td className="text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            {d.notification_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Customer / Buyer"
        subtitle="Register trading firm and verified WhatsApp delivery phone"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Firm / Buyer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Mahavir Provisions"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Bhavin Shah"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">WhatsApp Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. 919823011223 (with country code)"
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Alternate Phone</label>
              <input
                type="text"
                placeholder="e.g. +91 94221 44556"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">City / Mandi Hub</label>
              <input
                type="text"
                placeholder="e.g. Nagpur / Gondia"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">GSTIN Number</label>
              <input
                type="text"
                placeholder="e.g. 27AABCM5678M1Z2"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Godown Delivery Address</label>
            <input
              type="text"
              placeholder="e.g. Plot 44, APMC Kalamna Grain Market, Nagpur"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Internal Notes</label>
            <textarea
              rows={2}
              placeholder="Credit terms, preferred transporters, unloading instructions..."
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
              Save Customer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
