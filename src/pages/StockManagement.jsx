// src/pages/StockManagement.jsx
// Unified Stock Management & Inventory Hub
// Consolidates Stock Overview, Ledger, Inward, Outward, Transfers, Adjustments, and Valuation into a single seamless portal.

import React, { useState, useEffect } from 'react';
import { 
  Warehouse, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Scale, 
  TrendingUp, 
  LayoutDashboard, 
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  Package
} from 'lucide-react';
import { api } from '../api';

// Subcomponents
import StockDashboard from './StockDashboard';
import StockLedger from './StockLedger';
import StockInward from './StockInward';
import StockOutward from './StockOutward';
import StockTransfers from './StockTransfers';
import StockAdjustments from './StockAdjustments';
import StockValuation from './StockValuation';

export default function StockManagement({ initialTab = 'ledger' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Sync when initialTab prop changes from external navigation (e.g. Dashboard quick links)
  useEffect(() => {
    if (initialTab) {
      const normalized = initialTab.startsWith('stock-') 
        ? (initialTab === 'stock-dashboard' ? 'overview' : initialTab.replace('stock-', ''))
        : initialTab;
      setActiveTab(normalized);
    }
  }, [initialTab]);

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await api.stock.getDashboard();
      setSummaryData(res);
    } catch (err) {
      console.error('Failed to load stock summary stats:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
    const handlePortalRefresh = () => loadSummary();
    window.addEventListener('portal-refresh-data', handlePortalRefresh);
    return () => window.removeEventListener('portal-refresh-data', handlePortalRefresh);
  }, []);

  const handleSubNavigation = (target) => {
    const normalized = target.startsWith('stock-')
      ? (target === 'stock-dashboard' ? 'overview' : target.replace('stock-', ''))
      : target;
    setActiveTab(normalized);
  };

  const tabs = [
    { id: 'ledger', label: 'Stock Ledger', icon: FileText, desc: 'Chronological running balance' },
    { id: 'inward', label: 'Stock Inward', icon: ArrowDownLeft, desc: 'Receive stock at mills/returns' },
    { id: 'outward', label: 'Stock Outward', icon: ArrowUpRight, desc: 'Issue stock and record customer dispatches' },
    { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, desc: 'Inter-mill movement' },
    { id: 'adjustments', label: 'Adjustments', icon: Scale, desc: 'Physical audit count reconciliation' },
    { id: 'overview', label: 'Overview & Mills', icon: LayoutDashboard, desc: 'Stock metrics & mill capacities' },
    { id: 'valuation', label: 'Valuation & WAC', icon: TrendingUp, desc: 'Weighted average asset valuation' },
  ];

  const isTransactionTab = ['inward', 'outward', 'transfers', 'adjustments'].includes(activeTab);

  return (
    <div className="space-y-4">
      {/* Top Banner: Brand Header & Live Stock Pill Metrics */}
      <div className="glass-panel rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Warehouse size={20} className="text-[#8F1717]" />
              <span>Stock Management & Mill Inventory</span>
            </h1>
            <p className="text-xs text-[#777777]">
              Authoritative physical balance and live running ledger accounting across milling units
            </p>
          </div>

          {/* Quick Metrics Strip */}
          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            {summaryData ? (
              <>
                <div className="glass-card-base px-3.5 py-1.5 border border-[#8F1717]/40 shadow-[0_0_12px_rgba(143,23,23,0.15)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8F1717]" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Physical:</span>
                  <span className="font-mono font-bold text-[#8F1717] text-xs">
                    {summaryData.totalPhysicalStock?.toLocaleString('en-IN') || 0} QTL
                  </span>
                </div>

                <div className="glass-card-base px-3.5 py-1.5 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Available:</span>
                  <span className="font-mono font-bold text-emerald-700 text-xs">
                    {summaryData.totalAvailableStock?.toLocaleString('en-IN') || 0} QTL
                  </span>
                </div>

                <div className="glass-card-base px-3.5 py-1.5 border border-[#C69A3B]/50 shadow-[0_0_12px_rgba(198,154,59,0.2)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C69A3B]" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valuation:</span>
                  <span className="font-mono font-bold text-[#C69A3B] text-xs">
                    ₹{(summaryData.totalStockValue || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  onClick={loadSummary}
                  title="Refresh stock metrics"
                  className="p-1.5 text-gray-400 hover:text-black hover:bg-white/60 rounded-lg transition-colors border border-transparent hover:border-[#E8E2DC]"
                >
                  <RotateCw size={14} className={loadingSummary ? 'animate-spin' : ''} />
                </button>
              </>
            ) : (
              <div className="text-[11px] text-gray-400 italic">Loading inventory metrics...</div>
            )}
          </div>
        </div>

        {/* Low Stock Warning Banner (if any) */}
        {summaryData?.lowStockCount > 0 && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-[0_0_14px_rgba(245,158,11,0.18)] backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>{summaryData.lowStockCount} product(s)</strong> are currently below minimum safety reorder thresholds.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('inward')}
              className="text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg shadow-xs transition-colors"
            >
              Post Inward +
            </button>
          </div>
        )}

        {/* Primary Navigation Segmented Control / Tabs */}
        <div className="mt-4 pt-3 border-t border-[#E8E2DC]/80">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8F1717] to-[#771212] text-white border border-[#C69A3B]/40 shadow-[0_0_14px_rgba(143,23,23,0.35)] font-bold'
                      : 'text-gray-600 hover:text-[#252525] hover:bg-white/60 border border-transparent hover:border-[#E8E2DC]/80 backdrop-blur-xs'
                  }`}
                  title={tab.desc}
                >
                  <Icon size={15} className={isActive ? 'text-[#C69A3B]' : 'text-gray-500'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Inward/Outward/Transfer/Adjustment Switcher for Transaction Screens */}
      {isTransactionTab && (
        <div className="glass-panel rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Stock Operation:
            </span>
            <span className="text-xs font-bold text-[#8F1717]">
              {activeTab === 'inward' && '📥 Stock Inward Receipt (Incoming)'}
              {activeTab === 'outward' && '📤 Stock Outward Issue (Outgoing)'}
              {activeTab === 'transfers' && '🔄 Inter-Warehouse Godown Transfer'}
              {activeTab === 'adjustments' && '⚖️ Physical Count Audit Adjustment'}
            </span>
          </div>

          {/* Quick Toggle Buttons */}
          <div className="inline-flex rounded-xl bg-white/60 backdrop-blur-md p-1 border border-[#E8E2DC] gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('inward')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'inward'
                  ? 'bg-gradient-to-r from-[#8F1717] to-[#771212] text-white border border-[#C69A3B]/40 shadow-[0_0_12px_rgba(143,23,23,0.35)]'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <ArrowDownLeft size={13} />
              <span>Inward (+)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outward')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'outward'
                  ? 'bg-gradient-to-r from-[#8F1717] to-[#771212] text-white border border-[#C69A3B]/40 shadow-[0_0_12px_rgba(143,23,23,0.35)]'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <ArrowUpRight size={13} />
              <span>Outward (-)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transfers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'transfers'
                  ? 'bg-gradient-to-r from-[#8F1717] to-[#771212] text-white border border-[#C69A3B]/40 shadow-[0_0_12px_rgba(143,23,23,0.35)]'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <ArrowLeftRight size={13} />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('adjustments')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'adjustments'
                  ? 'bg-gradient-to-r from-[#8F1717] to-[#771212] text-white border border-[#C69A3B]/40 shadow-[0_0_12px_rgba(143,23,23,0.35)]'
                  : 'text-gray-600 hover:text-black hover:bg-white/80'
              }`}
            >
              <Scale size={13} />
              <span>Adjustment</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content View */}
      <div className="transition-opacity duration-150">
        {activeTab === 'ledger' && (
          <StockLedger 
            setActiveTab={setActiveTab} 
            onNewInward={() => setActiveTab('inward')}
            onNewOutward={() => setActiveTab('outward')}
          />
        )}

        {activeTab === 'inward' && (
          <StockInward 
            setActivePage={handleSubNavigation} 
            onSuccess={loadSummary} 
          />
        )}

        {activeTab === 'outward' && (
          <StockOutward 
            setActivePage={handleSubNavigation} 
            onSuccess={loadSummary} 
          />
        )}

        {activeTab === 'transfers' && (
          <StockTransfers 
            setActivePage={handleSubNavigation} 
            onSuccess={loadSummary} 
          />
        )}

        {activeTab === 'adjustments' && (
          <StockAdjustments 
            setActivePage={handleSubNavigation} 
            onSuccess={loadSummary} 
          />
        )}

        {activeTab === 'overview' && (
          <StockDashboard 
            setActivePage={handleSubNavigation} 
          />
        )}

        {activeTab === 'valuation' && (
          <StockValuation 
            setActivePage={handleSubNavigation} 
          />
        )}
      </div>
    </div>
  );
}

