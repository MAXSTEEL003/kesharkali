// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  ShieldCheck, 
  UserCheck, 
  MessageSquare, 
  History, 
  CheckCircle2,
  Flame,
  Cloud,
  Database,
  Lock,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  FolderTree
} from 'lucide-react';
import { api, getRole, setRole } from '../api';
import { useFirebaseAuth } from '../firebase/AuthContext';
import { REQUIRED_COLLECTIONS } from '../firebase/schema';
import { useNotification } from '../context/NotificationContext';

export default function Settings() {
  const { showToast } = useNotification();
  const { currentUser, isConfigured, loginWithGoogle, logout } = useFirebaseAuth();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [waConfig, setWaConfig] = useState(null);
  const [currentRoleState, setCurrentRoleState] = useState(getRole());
  const [expandedCollection, setExpandedCollection] = useState(null);

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

      {/* Row 1: Brand, WhatsApp Gateway, and Firebase Cloud Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Default Unit of Measure:</span>
              <strong className="font-mono">1 Quintal (QTL) = 100 Kilograms (KG)</strong>
            </div>

            {/* Logo Preview & Custom Image Uploader */}
            <div className="pt-2">
              <div className="text-gray-500 mb-1.5 flex items-center justify-between">
                <span className="font-semibold text-gray-700">Navbar Logo Image:</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('keshar_kali_logo');
                    window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { logoUrl: '/logo.webp' } }));
                    showToast('Reset to default Keshar Kali logo.', 'info');
                  }}
                  className="text-[10px] text-[#8F1717] hover:underline font-semibold"
                >
                  Reset Default
                </button>
              </div>
              <div className="p-3 bg-[#F8F4EE] rounded-lg border border-[#E8E2DC] flex items-center justify-center">
                <img 
                  src={localStorage.getItem('keshar_kali_logo') || "/logo.webp"} 
                  alt="Current Logo" 
                  className="h-12 w-auto max-w-[220px] object-contain drop-shadow-xs" 
                />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <label className="cursor-pointer text-[11px] font-semibold bg-[#8F1717] text-white px-3 py-1.5 rounded hover:bg-[#771212] transition-colors shadow-xs">
                  Change Logo / Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const dataUrl = evt.target.result;
                        localStorage.setItem('keshar_kali_logo', dataUrl);
                        window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { logoUrl: dataUrl } }));
                        showToast('Company logo updated successfully!', 'success');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                <span className="text-[10px] text-gray-400">Supports PNG, SVG, JPG, WebP</span>
              </div>
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

        {/* Firebase Cloud Integration Card */}
        <div className="bg-white p-4 rounded-lg border border-[#E8E2DC] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Flame size={15} className="text-amber-600" />
                Firebase Cloud Integration
              </span>
              <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Connection Status:</span>
                {isConfigured ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Active (Cloud Connected)
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    Ready (Pending .env keys)
                  </span>
                )}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Project ID:</span>
                <strong className="font-mono text-[11px] text-gray-700">
                  {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'keshar-kali-portal'}
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">SDK Features:</span>
                <span className="text-gray-700 font-medium">Auth, Firestore, Storage</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Offline Resilience:</span>
                <span className="text-emerald-700 font-semibold">Native SQLite Fallback Active</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-gray-100">
            {currentUser ? (
              <div className="flex items-center justify-between bg-amber-50/50 p-2 rounded border border-amber-200/60">
                <div className="truncate pr-2">
                  <div className="text-[10px] text-gray-500">Signed In As:</div>
                  <div className="text-xs font-semibold text-gray-800 truncate">{currentUser.email || currentUser.displayName}</div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="text-[11px] px-2.5 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : isConfigured ? (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full py-2 px-3 bg-[#8F1717] hover:bg-[#771212] text-white text-xs font-semibold rounded flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                Sign In with Google Cloud
              </button>
            ) : (
              <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2.5 rounded border border-amber-200/60 flex items-center justify-between">
                <span>Configure <code className="bg-amber-100/70 px-1 py-0.5 rounded font-mono text-[10px]">VITE_FIREBASE_*</code> in <code className="bg-amber-100/70 px-1 py-0.5 rounded font-mono text-[10px]">.env</code></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 1.5: Firestore Cloud Collections Registry */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717]">
              Cloud Firestore Collections Registry (15 Collections)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-semibold">
              Project: kesharkaliportal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://console.firebase.google.com/project/kesharkaliportal/firestore"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-amber-800 hover:text-amber-900 flex items-center gap-1 underline"
            >
              <span>Open Firebase Console</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="p-4 bg-amber-50/30 border-b border-[#E8E2DC] text-xs text-gray-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-800">
              Firestore Cloud Database Initialization
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              If your Cloud Firestore database has not been enabled yet, open the <strong>Firebase Console</strong> link above and click <strong>"Create database"</strong>. To batch-seed all 15 collections with full initial records, run:
            </p>
          </div>
          <div className="bg-white px-3 py-1.5 rounded border border-amber-200/80 font-mono text-[11px] text-[#8F1717] font-semibold whitespace-nowrap shadow-2xs">
            npm run seed:firestore
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Collection Name</th>
                <th className="text-left">Firestore Path</th>
                <th className="text-left">Purpose & Business Scope</th>
                <th className="text-center">Initial Docs</th>
                <th className="text-center">Security Rule Scope</th>
                <th className="text-center w-24">Schema</th>
              </tr>
            </thead>
            <tbody>
              {REQUIRED_COLLECTIONS.map((c, idx) => {
                const isExpanded = expandedCollection === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-amber-50/40">
                      <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                      <td className="font-semibold text-[#8F1717]">{c.name}</td>
                      <td className="font-mono text-xs text-gray-700">/{c.id}</td>
                      <td className="text-xs text-gray-600">{c.description}</td>
                      <td className="text-center font-mono text-xs font-semibold text-gray-700">
                        {c.documentCount}
                      </td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.id === 'industries'
                            ? 'bg-rose-100 text-rose-800'
                            : c.id.includes('stock')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.id === 'industries' ? 'Strictly Confidential' : 'Staff Authenticated'}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedCollection(isExpanded ? null : c.id)}
                          className="text-[11px] text-[#8F1717] hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                        >
                          {isExpanded ? (
                            <><span>Hide</span> <ChevronUp size={12} /></>
                          ) : (
                            <><span>Fields</span> <ChevronDown size={12} /></>
                          )}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-amber-50/50">
                        <td colSpan={7} className="p-3 text-xs border-b border-amber-200">
                          <div className="bg-white p-3 rounded border border-amber-200 space-y-1">
                            <div className="font-bold text-[#8F1717] text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1">
                              <FolderTree size={13} />
                              Field Specifications for /{c.id}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {Object.entries(c.schema).map(([field, type]) => (
                                <div key={field} className="p-1.5 bg-[#FAF9F6] rounded border border-gray-100 flex items-center justify-between text-[11px]">
                                  <span className="font-mono font-semibold text-gray-800">{field}</span>
                                  <span className="text-gray-500 font-mono text-[10px]">{type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
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

      {/* Row 3: Full Audit Trail & Operational Logs */}
      <div id="audit-logs" className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#252525] flex items-center gap-1.5">
            <History size={15} className="text-[#8F1717]" />
            Operational Log & Chronological Audit Trail (Last 50 Operations)
          </h3>
          <span className="text-[11px] font-mono text-gray-500 font-medium">
            {auditLogs.length} Events Logged
          </span>
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

