// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Truck, 
  Send, 
  Warehouse, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  Inbox,
  FileSpreadsheet,
  Layers,
  Scale,
  RefreshCw
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';

export default function Dashboard({ setActivePage, onOpenQuickAction }) {
  const { showToast } = useNotification();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial || !data) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const res = await api.dashboard.getData();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const handlePortalRefresh = () => loadData(false);
    window.addEventListener('portal-refresh-data', handlePortalRefresh);
    return () => window.removeEventListener('portal-refresh-data', handlePortalRefresh);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-[#777777] text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8F1717] mr-3"></div>
        Loading Keshar Kali operational statistics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card bg-red-50/80 border-l-4 border-[#8F1717] p-4 text-sm text-red-700 rounded-lg flex items-center justify-between shadow-xs">
        <div>
          <strong className="font-semibold">Unable to load dashboard:</strong> {error}
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1 bg-[#8F1717] text-white text-xs font-semibold rounded hover:bg-[#771212] transition-colors shadow-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const { metrics, dailyLoading, dailyDispatch, industryDistribution, productDistribution, lowStockProducts, pendingTasks, recentActivities, pendingLoadings } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions Strip */}
      <div className="glass-panel rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#252525] tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Operations and dispatch overview
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            type="button"
            onClick={() => loadData(false)}
            disabled={loading || isRefreshing}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/70 hover:bg-white text-gray-700 px-3 py-2 rounded-xl border border-[#E8E2DC] transition-all shadow-xs cursor-pointer disabled:opacity-60"
            title="Refresh dashboard statistics"
          >
            <RefreshCw size={13} className={loading || isRefreshing ? 'animate-spin text-[#8F1717]' : 'text-gray-500'} />
            <span>Refresh</span>
          </button>

          <button 
            onClick={() => onOpenQuickAction('po')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-[#8F1717] to-[#771212] hover:from-[#771212] hover:to-[#5E1010] text-white px-3.5 py-2 rounded-xl shadow-[0_0_12px_rgba(143,23,23,0.3)] hover:shadow-[0_0_18px_rgba(143,23,23,0.5)] border border-[#C69A3B]/40 transition-all"
            title="Record incoming customer purchase order received by Keshar Kali"
          >
            <Inbox size={14} className="text-[#C69A3B]" />
            <span>Receive PO</span>
          </button>

          <button 
            onClick={() => onOpenQuickAction('loading')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-[#5E1010] to-[#480c0c] hover:from-[#480c0c] hover:to-[#380909] text-white px-3.5 py-2 rounded-xl shadow-[0_0_12px_rgba(94,16,16,0.3)] hover:shadow-[0_0_18px_rgba(94,16,16,0.5)] border border-white/20 transition-all"
          >
            <Truck size={14} />
            <span>Add Loading</span>
          </button>

          <button 
            onClick={() => setActivePage('reports-loading')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/70 backdrop-blur-md border border-[#E8E2DC] text-[#252525] px-3.5 py-2 rounded-xl hover:bg-white transition-all shadow-xs"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            <span>Excel Exports</span>
          </button>
        </div>
      </div>

      {/* Row 1: Primary Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        <StatCard 
          label="Received Customer POs" 
          value={`${metrics.totalPurchaseOrders}`} 
          subtext={`Value: ₹${(metrics.totalOrderValue || 0).toLocaleString('en-IN')}`}
          icon={Inbox} 
          color="red"
          onClick={() => setActivePage('purchase-orders')}
        />
        <StatCard 
          label="Ordered Quantity" 
          value={`${metrics.totalOrderedQuantity.toLocaleString('en-IN')} QTL`} 
          subtext={`Allocated: ${metrics.totalAllocatedQuantity} QTL`}
          icon={Layers} 
          color="burgundy"
          onClick={() => setActivePage('purchase-orders')}
        />
        <StatCard 
          label="Total Loaded & Dispatched" 
          value={`${metrics.totalLoadedQuantity.toLocaleString('en-IN')} QTL`} 
          subtext={`${metrics.totalLoadedQuantity.toLocaleString('en-IN')} QTL delivered to buyers`}
          icon={Truck} 
          color="green"
          onClick={() => setActivePage('master-loading-register')}
        />
        <StatCard 
          label="Pending Mill Loading" 
          value={`${metrics.pendingLoading.toLocaleString('en-IN')} QTL`} 
          subtext="Orders Awaiting Mill Trucks"
          icon={Clock} 
          color="amber"
          alert={metrics.pendingLoading > 0}
          onClick={() => setActivePage('master-loading-register')}
        />
      </div>

      {/* Stock Position Bar (only shown when physical stock exists) */}
      {metrics.totalPhysicalStock > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatCard 
            label="Total Warehouse Stock" 
            value={`${metrics.totalPhysicalStock.toLocaleString('en-IN')} QTL`} 
            subtext="Physical Inventory" 
            icon={Warehouse} 
            color="red"
            onClick={() => setActivePage('stock-dashboard')}
          />
        </div>
      )}

      {/* Low Stock Alerts (if any) */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-2xl shadow-[0_0_16px_rgba(245,158,11,0.2)] backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-amber-900">Low Stock Reorder Alert</h4>
              <p className="text-xs text-amber-800">
                {lowStockProducts.length} product(s) below safety threshold: {' '}
                <strong>{lowStockProducts.map(p => `${p.productName} (${p.physicalBalance} QTL)`).join(', ')}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActivePage('stock-inward')}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl transition-all shadow-xs shrink-0"
          >
            Inward Replenishment
          </button>
        </div>
      )}

      {/* Row 3: Actionable Operational Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unallocated / Pending POs */}
        <div className="glass-panel rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="bg-white/60 backdrop-blur-md border-b border-[#E8E2DC]/80 px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] flex items-center gap-2">
              <ShoppingCart size={15} />
              Pending PO Allocations
            </h3>
            <button 
              onClick={() => setActivePage('purchase-orders')}
              className="text-xs text-[#8F1717] hover:underline flex items-center gap-1 font-semibold"
            >
              View All POs <ArrowRight size={12} />
            </button>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            {pendingTasks.unallocatedPOs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#777777]">
                All active purchase orders are fully allocated!
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/40 text-[#777777] border-b border-[#E8E2DC]">
                    <th className="py-2 px-3 text-left">PO #</th>
                    <th className="py-2 px-3 text-left">Buyer</th>
                    <th className="py-2 px-3 text-right">Ordered QTL</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DC]">
                  {pendingTasks.unallocatedPOs.map(po => (
                    <tr key={po.id} className="hover:bg-amber-50/40">
                      <td className="py-2.5 px-3 font-semibold text-[#8F1717]">{po.po_number}</td>
                      <td className="py-2.5 px-3 text-[#252525]">{po.customer_name}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{po.ordered_quantity}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setActivePage('purchase-orders')}
                          className="px-2.5 py-1 rounded-lg bg-[#8F1717] text-white text-[10px] font-semibold hover:bg-[#771212] shadow-xs"
                        >
                          Allocate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Dispatched Truck Loadings */}
        <div className="glass-panel rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="bg-white/60 backdrop-blur-md border-b border-[#E8E2DC]/80 px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5E1010] flex items-center gap-2">
              <Truck size={15} />
              Recent Dispatched Truck Loadings
            </h3>
            <button 
              onClick={() => setActivePage('master-loading-register')}
              className="text-xs text-[#5E1010] hover:underline flex items-center gap-1 font-semibold"
            >
              Loading Register <ArrowRight size={12} />
            </button>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            {(!pendingTasks.recentLoadings || pendingTasks.recentLoadings.length === 0) ? (
              <div className="p-6 text-center text-xs text-[#777777]">
                No truck loadings recorded yet.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[#777777] border-b border-[#E8E2DC]">
                    <th className="py-2 px-3 text-left">Loading #</th>
                    <th className="py-2 px-3 text-left">PO & Buyer</th>
                    <th className="py-2 px-3 text-left">Vehicle</th>
                    <th className="py-2 px-3 text-right">Dispatched QTL</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DC]">
                  {pendingTasks.recentLoadings.map(ld => (
                    <tr key={ld.id} className="hover:bg-amber-50/30">
                      <td className="py-2.5 px-3 font-semibold text-[#5E1010]">{ld.loading_number}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#252525]">{ld.customer_name}</div>
                        <div className="text-[10px] text-gray-500">{ld.po_number}</div>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-xs text-gray-700">{ld.vehicle_number}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-700">
                        {ld.loading_quantity} QTL
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Dispatched
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Pending Loadings & Stock Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Loadings */}
        <div className="glass-panel rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] flex items-center gap-2">
                <Clock size={14} className="text-[#8F1717]" />
                <span>Pending Loadings</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  {metrics.pendingLoading?.toLocaleString('en-IN') || 0} QTL Pending
                </span>
                <button
                  onClick={() => setActivePage('master-loading-register')}
                  className="text-xs text-[#8F1717] hover:underline flex items-center gap-1 font-semibold"
                >
                  Register →
                </button>
              </div>
            </div>

            {(!pendingLoadings || pendingLoadings.length === 0) ? (
              <div className="p-8 text-center text-xs text-[#777777]">
                No shipments awaiting mill trucks. All active orders loaded!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/40 text-[#777777] border-b border-[#E8E2DC]">
                      <th className="py-2 px-2 text-left">Sub-Order #</th>
                      <th className="py-2 px-2 text-left">Buyer / PO</th>
                      <th className="py-2 px-2 text-left">Product</th>
                      <th className="py-2 px-2 text-right">Pending QTL</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DC]">
                    {pendingLoadings.slice(0, 5).map((ld, idx) => (
                      <tr key={ld.id || idx} className="hover:bg-amber-50/40">
                        <td className="py-2 px-2 font-mono font-bold text-blue-700">
                          {ld.sub_order_no || 'Direct'}
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-semibold text-[#252525] truncate max-w-[150px]">{ld.buyer_name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{ld.po_number}</div>
                        </td>
                        <td className="py-2 px-2 text-gray-700 truncate max-w-[120px]">
                          {ld.product_name}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-bold text-amber-700">
                          {Number(ld.pending_quantity).toFixed(2)} QTL
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => setActivePage('master-loading-register')}
                            className="px-2 py-0.5 rounded bg-[#8F1717] text-white text-[10px] font-semibold hover:bg-[#771212] shadow-xs"
                          >
                            Load
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="pt-3 mt-3 border-t border-gray-100/80 flex items-center justify-between text-[11px] text-gray-500">
            <span>Awaiting trucks at sourcing mills</span>
            <button
              onClick={() => setActivePage('master-loading-register')}
              className="font-semibold text-[#8F1717] hover:underline"
            >
              Open Master Loading Register →
            </button>
          </div>
        </div>

        {/* Product Stock Distribution */}
        <div className="glass-panel rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] mb-3 flex items-center justify-between">
            <span>Product Inventory Levels</span>
            <span className="text-[10px] text-gray-500 font-normal">Audited Stock</span>
          </h3>
          <div className="space-y-3">
            {productDistribution.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100/80 last:border-0 text-xs">
                <div>
                  <div className="font-semibold text-[#252525]">{p.name}</div>
                  <div className="text-[10px] text-[#777777]">{p.code}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="tabular-nums font-bold text-emerald-700 text-sm">{p.physicalStock} QTL</div>
                    <div className="text-[10px] text-gray-400">In Stock</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

