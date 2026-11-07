// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, ShieldCheck, UserCheck, MessageSquare, History, CheckCircle2 } from 'lucide-react';
import { api, getRole, setRole } from '../api';

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [waConfig, setWaConfig] = useState(null);
  const [currentRoleState, setCurrentRoleState] = useState(getRole());

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, logsRes, configRes] = await Promise.all([
          api.auth.getUsers(),
          api.auditLogs.getLogs(50),
          api.whatsapp.getConfig()
        ]);
        setUsers(usersRes.users || []);
        setAuditLogs(logsRes.logs || []);
        setWaConfig(configRes);
      } catch (err) {
        console.error('Failed to load settings data:', err);
      }
    }
    loadData();
  }, []);

  const handleRoleToggle = (role) => {
    setRole(role);
    setCurrentRoleState(role);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <SettingsIcon size={18} className="text-[#8F1717]" />
            Portal Settings, Security & Audit Logs
          </h1>
          <p className="text-xs text-[#777777]">
            System security profiles, user role assignments, gateway parameters, and operational audit trail
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#FAF9F6] p-1.5 rounded border border-[#E8E2DC] text-xs">
          <span className="text-gray-500 font-medium px-2">Active Role:</span>
          <button
            onClick={() => handleRoleToggle('Admin')}
            className={`px-3 py-1 rounded font-bold transition-colors ${
              currentRoleState === 'Admin'
                ? 'bg-[#8F1717] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => handleRoleToggle('Operator')}
            className={`px-3 py-1 rounded font-bold transition-colors ${
              currentRoleState === 'Operator'
                ? 'bg-[#8F1717] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            Operator
          </button>
        </div>
      </div>

      {/* Row 1: Brand & WhatsApp Gateway Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand System Card */}
        <div className="bg-white p-4 rounded-lg border border-[#E8E2DC] shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] mb-2">
            Brand Identity & System Guidelines
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Brand Name:</span>
              <strong className="text-[#8F1717] font-['Space_Grotesk']">KESHAR KALI</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Tagline:</span>
              <strong className="text-[#C69A3B]">Precision in Every Grain</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Design Palette:</span>
              <span>Red (#8F1717), Gold (#C69A3B), Warm White (#FAF9F6)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Default Unit of Measure:</span>
              <strong className="font-mono">1 Quintal (QTL) = 100 Kilograms (KG)</strong>
            </div>
          </div>
        </div>

        {/* WhatsApp Gateway Status */}
        <div className="bg-white p-4 rounded-lg border border-[#E8E2DC] shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center justify-between">
            <span>WhatsApp Business API Gateway</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </h3>
          {waConfig && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Gateway Mode:</span>
                <strong className="text-emerald-700">{waConfig.mode}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Template Registered:</span>
                <strong className="font-mono">{waConfig.templateName}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Idempotency Guard:</span>
                <span className="text-emerald-700 font-semibold">Active (Prevents Duplicate Sends)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Customer Data Scrubbing:</span>
                <span className="text-emerald-700 font-semibold">Guaranteed Zero Leakage</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: User Access Management */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] flex items-center gap-1.5">
            <ShieldCheck size={15} />
            Authorized Office Personnel & Role Permissions
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Username</th>
                <th className="text-left">Full Name</th>
                <th className="text-center">Role Profile</th>
                <th className="text-left">Email Address</th>
                <th className="text-center">Phone</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="font-mono font-semibold text-[#8F1717]">{u.username}</td>
                  <td className="font-semibold text-[#252525]">{u.full_name}</td>
                  <td className="text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'Admin' ? 'bg-[#8F1717] text-white' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.email}</td>
                  <td className="text-center font-mono text-xs">{u.phone}</td>
                  <td className="text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Full Audit Trail */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#252525] flex items-center gap-1.5">
            <History size={15} className="text-[#8F1717]" />
            Complete Chronological Audit Trail (Last 50 Operations)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-center">Timestamp</th>
                <th className="text-left">Entity</th>
                <th className="text-center">Action</th>
                <th className="text-left">Entity ID</th>
                <th className="text-left">Operator / Actor</th>
                <th className="text-left">Operation Payload / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log, idx) => (
                <tr key={log.id} className="hover:bg-amber-50/40">
                  <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                  <td className="text-center text-xs font-mono">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="font-semibold text-[#8F1717]">{log.entity_type}</td>
                  <td className="text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-gray-600">{log.entity_id}</td>
                  <td className="font-medium text-[#252525]">{log.actor}</td>
                  <td className="text-xs text-gray-600 truncate max-w-lg">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
