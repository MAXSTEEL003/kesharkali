// src/pages/DispatchManagement.jsx
import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  ShieldCheck, 
  Eye, 
  Calendar,
  Clock
} from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';

export default function DispatchManagement() {
  const [pendingLoadings, setPendingLoadings] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dispatch Confirmation Modal
  const [selectedLoading, setSelectedLoading] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // WhatsApp Preview Modal
  const [selectedNotification, setSelectedNotification] = useState(null);

  const [dispatchForm, setDispatchForm] = useState({
    dispatch_date: new Date().toISOString().split('T')[0],
    dispatch_quantity: '',
    vehicle_number: '',
    remarks: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendingRes, dspRes] = await Promise.all([
        api.dispatches.getPendingLoadings(),
        api.dispatches.getAll()
      ]);
      setPendingLoadings(pendingRes.pendingLoadings || []);
      setDispatches(dspRes.dispatches || []);
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

  const handleOpenDispatchModal = (loadingItem) => {
    setSelectedLoading(loadingItem);
    setDispatchForm({
      dispatch_date: new Date().toISOString().split('T')[0],
      dispatch_quantity: loadingItem.available_to_dispatch,
      vehicle_number: loadingItem.vehicle_number || '',
      remarks: ''
    });
    setIsConfirmOpen(true);
  };

  const handleConfirmDispatch = async (e) => {
    e.preventDefault();
    if (!selectedLoading) return;

    try {
      setSubmitting(true);
      const res = await api.dispatches.confirm({
        loading_id: selectedLoading.id,
        dispatch_date: dispatchForm.dispatch_date,
        dispatch_quantity: dispatchForm.dispatch_quantity,
        vehicle_number: dispatchForm.vehicle_number,
        remarks: dispatchForm.remarks
      });

      setIsConfirmOpen(false);
      setSelectedLoading(null);
      loadData();
      alert(`Dispatch confirmed! Dispatch Number: ${res.dispatchNumber}. WhatsApp status: ${res.notification?.status || 'Sent'}`);
    } catch (err) {
      alert(`Dispatch confirmation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <Send size={18} className="text-[#8F1717]" />
            Dispatch Management & Customer Delivery Control
          </h1>
          <p className="text-xs text-[#777777]">
            Distinct operational checkpoint: confirms truck departure, updates buyer fulfillment, deducts warehouse inventory, and sends WhatsApp alerts
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-[#FAF9F6] border border-[#E8E2DC] px-3 py-1.5 rounded text-center">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Loadings Ready</span>
            <div className="text-sm font-bold font-mono text-[#8F1717]">{pendingLoadings.length}</div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#E8E2DC] px-3 py-1.5 rounded text-center">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Total Dispatched</span>
            <div className="text-sm font-bold font-mono text-emerald-700">{dispatches.length}</div>
          </div>
        </div>
      </div>

      {/* Section 1: Loadings Awaiting Dispatch Confirmation */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] flex items-center gap-1.5">
              <Truck size={15} />
              Pending Loadings Available for Customer Dispatch
            </h3>
            <p className="text-[11px] text-[#777777]">
              Loaded trucks ready to be dispatched partially or fully to customer godown
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Loading ID</th>
                <th className="text-center">Loading Date</th>
                <th className="text-left">PO Number</th>
                <th className="text-left">Buyer / Customer</th>
                <th className="text-left">Rice Product</th>
                <th className="text-left">Delivery Location</th>
                <th className="text-center">Fulfillment Type</th>
                <th className="text-center">Truck / Vehicle</th>
                <th className="text-right">Total Loaded</th>
                <th className="text-right">Dispatched</th>
                <th className="text-right bg-[#700f0f]">Available to Dispatch</th>
                <th className="text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingLoadings.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-xs text-gray-400">
                    No pending loadings waiting for dispatch. All loaded rice has been dispatched!
                  </td>
                </tr>
              ) : (
                pendingLoadings.map((ld, idx) => (
                  <tr key={ld.id} className="hover:bg-amber-50/40">
                    <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                    <td className="font-semibold text-[#8F1717]">{ld.loading_number}</td>
                    <td className="text-center text-xs">{ld.loading_date}</td>
                    <td className="font-semibold">{ld.po_number}</td>
                    <td className="font-medium text-[#252525]">{ld.customer_name}</td>
                    <td>{ld.product_name}</td>
                    <td className="text-xs text-gray-500 truncate max-w-[150px]">{ld.delivery_location}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ld.fulfillment_type === 'Warehouse' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {ld.fulfillment_type}
                      </span>
                    </td>
                    <td className="text-center font-mono font-bold text-gray-800">{ld.vehicle_number}</td>
                    <td className="text-right font-mono font-bold">{ld.loading_quantity}</td>
                    <td className="text-right font-mono text-emerald-700">{ld.dispatched_quantity}</td>
                    <td className="text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                      {ld.available_to_dispatch} QTL
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => handleOpenDispatchModal(ld)}
                        className="px-3 py-1 rounded bg-[#C69A3B] hover:bg-[#b08730] text-[#5E1010] text-xs font-bold shadow-xs transition-colors"
                      >
                        Dispatch →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Confirmed Dispatches History */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#252525] flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-700" />
            Confirmed Customer Dispatches Register
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Dispatch ID</th>
                <th className="text-center">Dispatch Date</th>
                <th className="text-left">PO Number</th>
                <th className="text-left">Buyer / Customer</th>
                <th className="text-left">Product</th>
                <th className="text-right">Dispatched Quantity</th>
                <th className="text-center">Vehicle Number</th>
                <th className="text-center">Source Type</th>
                <th className="text-left">Warehouse Godown</th>
                <th className="text-center">WhatsApp Alert</th>
                <th className="text-center w-16">View</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-xs text-gray-400">
                    No dispatches recorded yet.
                  </td>
                </tr>
              ) : (
                dispatches.map((dsp, idx) => (
                  <tr key={dsp.id} className="hover:bg-amber-50/40">
                    <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                    <td className="font-semibold text-emerald-800">{dsp.dispatch_number}</td>
                    <td className="text-center text-xs font-mono">{dsp.dispatch_date}</td>
                    <td className="font-semibold text-[#8F1717]">{dsp.po_number}</td>
                    <td className="font-medium">{dsp.customer_name}</td>
                    <td>{dsp.product_name}</td>
                    <td className="text-right font-mono font-bold text-emerald-700">{dsp.dispatch_quantity} QTL</td>
                    <td className="text-center font-mono font-semibold">{dsp.vehicle_number}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${dsp.source_type === 'Warehouse' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {dsp.source_type}
                      </span>
                    </td>
                    <td className="text-xs text-gray-600">{dsp.warehouse_name || 'Direct from Mill'}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${dsp.notification_status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : dsp.notification_status === 'Sent' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {dsp.notification_status}
                      </span>
                    </td>
                    <td className="text-center">
                      {dsp.whatsapp_message_body && (
                        <button
                          onClick={() => setSelectedNotification(dsp)}
                          className="p-1 text-gray-500 hover:text-[#8F1717] hover:bg-gray-100 rounded"
                          title="View WhatsApp Message Body"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Dispatch Modal */}
      {selectedLoading && (
        <Modal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          title={`Confirm Customer Dispatch — ${selectedLoading.po_number}`}
          subtitle={`Buyer: ${selectedLoading.customer_name} | Product: ${selectedLoading.product_name} | From Loading: ${selectedLoading.loading_number}`}
        >
          <form onSubmit={handleConfirmDispatch} className="space-y-4 text-xs">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900">
              <div className="font-semibold mb-1">Dispatch Availability Check:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Total Loaded for this Entry: <strong>{selectedLoading.loading_quantity} QTL</strong></div>
                <div>Available to Dispatch: <strong className="text-emerald-700">{selectedLoading.available_to_dispatch} QTL</strong></div>
                <div>Fulfillment Type: <strong>{selectedLoading.fulfillment_type}</strong></div>
                <div>Warehouse Deduction: <strong>{selectedLoading.fulfillment_type === 'Warehouse' ? 'YES (Actual Warehouse Stock Reduced)' : 'NO (Direct Mill Delivery)'}</strong></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#252525] mb-1">Dispatch Date *</label>
                <input
                  type="date"
                  required
                  value={dispatchForm.dispatch_date}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_date: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Dispatch Quantity (QTL) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedLoading.available_to_dispatch}
                  required
                  placeholder="e.g. 40.00"
                  value={dispatchForm.dispatch_quantity}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_quantity: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono text-sm focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-[#252525] mb-1">Delivery Truck / Vehicle Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-31-AA-4412"
                  value={dispatchForm.vehicle_number}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Dispatch Remarks</label>
              <textarea
                rows={2}
                placeholder="Gate pass number, driver contact, delivery instructions..."
                value={dispatchForm.remarks}
                onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            {/* Privacy Guard Notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900 flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Customer Privacy Guaranteed:</strong> Confirming this dispatch triggers an automatic WhatsApp dispatch notification to <strong>{selectedLoading.customer_name}</strong> ({selectedLoading.customer_whatsapp || 'Buyer Phone'}). Industry mill names and purchase rates are strictly stripped from the template.
              </span>
            </div>

            <div className="pt-3 border-t border-[#E8E2DC] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] transition-colors shadow-xs"
              >
                {submitting ? 'Confirming & Notifying...' : 'Confirm Dispatch & Send WhatsApp'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View WhatsApp Message Body Modal */}
      {selectedNotification && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedNotification(null)}
          title={`Customer WhatsApp Notification — ${selectedNotification.dispatch_number}`}
          subtitle={`Recipient: ${selectedNotification.customer_name} (${selectedNotification.whatsapp_number})`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[#EFEAE2] rounded-lg border border-[#D5CEB8] text-gray-800 font-sans shadow-inner">
              <div className="whitespace-pre-wrap leading-relaxed">
                {selectedNotification.whatsapp_message_body}
              </div>
            </div>

            <div className="text-[11px] text-gray-500 flex items-center justify-between">
              <span>Message ID: <strong className="font-mono">{selectedNotification.wa_message_id || 'wam_simulated'}</strong></span>
              <span>Status: <strong className="text-emerald-700 font-bold">{selectedNotification.notification_status}</strong></span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
