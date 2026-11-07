// src/pages/CustomerNotifications.jsx
import React, { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, CheckCircle2, AlertTriangle, Eye, ShieldCheck, Send } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';

export default function CustomerNotifications() {
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsRes, configRes] = await Promise.all([
        api.whatsapp.getLogs(),
        api.whatsapp.getConfig()
      ]);
      setLogs(logsRes.logs || []);
      setConfig(configRes);
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

  const handleRetry = async (notificationId) => {
    try {
      setRetryingId(notificationId);
      await api.whatsapp.retry(notificationId);
      loadData();
      alert('Notification re-sent successfully!');
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Mode Status */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <MessageSquare size={18} className="text-[#8F1717]" />
              Customer WhatsApp Dispatch Notifications
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck size={12} /> Confidentiality Enforced
            </span>
          </div>
          <p className="text-xs text-[#777777]">
            Real-time delivery receipts, template auditing, idempotency checks, and privacy enforcement
          </p>
        </div>

        {config && (
          <div className="bg-[#FAF9F6] border border-[#E8E2DC] px-3 py-1.5 rounded text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-gray-600 font-medium">Gateway: <strong>{config.mode}</strong></span>
          </div>
        )}
      </div>

      {/* Privacy Guarantee Banner */}
      <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3.5 rounded-r-lg shadow-xs text-xs text-emerald-950 flex items-start gap-3">
        <ShieldCheck size={20} className="text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-emerald-900">Zero-Leakage Customer Privacy Safeguard</h4>
          <p className="text-emerald-800 mt-0.5">
            Every notification sent through the Keshar Kali engine is strictly scrubbed. Buyers receive order numbers, products, dispatched quantities, and remaining balances. Internal rice mills, sourcing locations, and mill procurement rates are <strong>never</strong> transmitted to customer phones.
          </p>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-center">Timestamp</th>
                <th className="text-left">Customer / Buyer</th>
                <th className="text-center">Recipient Phone</th>
                <th className="text-left">PO Number</th>
                <th className="text-left">Dispatch ID</th>
                <th className="text-right">Quantity QTL</th>
                <th className="text-center">Vehicle</th>
                <th className="text-center">Status</th>
                <th className="text-center">Retries</th>
                <th className="text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-xs text-gray-400">
                    No customer notifications logged yet. Dispatches will automatically trigger alerts.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-amber-50/40">
                    <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                    <td className="text-center text-xs font-mono">{new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="font-semibold text-[#252525]">{log.customer_name}</td>
                    <td className="text-center font-mono text-xs">{log.recipient_phone}</td>
                    <td className="font-semibold text-[#8F1717]">{log.po_number}</td>
                    <td className="font-mono text-emerald-800">{log.dispatch_number}</td>
                    <td className="text-right font-mono font-bold">{log.dispatch_quantity}</td>
                    <td className="text-center font-mono text-xs">{log.vehicle_number}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                        log.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="text-center font-mono text-xs">{log.retry_count}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded text-gray-600 hover:text-[#8F1717] hover:bg-gray-100"
                          title="View message payload"
                        >
                          <Eye size={14} />
                        </button>
                        {log.status === 'Failed' && (
                          <button
                            onClick={() => handleRetry(log.id)}
                            disabled={retryingId === log.id}
                            className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="Retry send"
                          >
                            <RefreshCw size={14} className={retryingId === log.id ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Modal Preview */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`WhatsApp Payload — ${selectedLog.dispatch_number}`}
          subtitle={`Sent to: ${selectedLog.customer_name} (${selectedLog.recipient_phone})`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[#EFEAE2] rounded-lg border border-[#D5CEB8] text-gray-900 font-sans shadow-inner">
              <div className="whitespace-pre-wrap leading-relaxed">
                {selectedLog.message_body}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
              <div>WhatsApp Message ID: <strong className="font-mono text-gray-700">{selectedLog.wa_message_id}</strong></div>
              <div>Idempotency Key: <strong className="font-mono text-gray-700">{selectedLog.idempotency_key}</strong></div>
              <div>Status: <strong className="text-emerald-700 font-bold">{selectedLog.status}</strong></div>
              <div>Last Attempt: <strong className="text-gray-700">{new Date(selectedLog.last_attempt_at).toLocaleString()}</strong></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

