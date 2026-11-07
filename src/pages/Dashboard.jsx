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
  Scale
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { api } from '../api';

export default function Dashboard({ setActivePage, onOpenQuickAction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.dashboard.getData();
      setData(res);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#777777] text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8F1717] mr-3"></div>
        Loading Keshar Kali operational statistics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-[#8F1717] p-4 text-sm text-red-700">
        Error loading dashboard: {error}
      </div>
    );
  }

  const { metrics, dailyLoading, dailyDispatch, industryDistribution, productDistribution, lowStockProducts, pendingTasks, recentActivities } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions Strip */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            Operational Command Center
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              Live Reconciled
            </span>
          </h1>
          <p className="text-xs text-[#777777]">
            Real-time procurement, loading, dispatches, and warehouse stock accounting
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => onOpenQuickAction('po')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] text-white px-3 py-1.5 rounded hover:bg-[#771212] transition-colors shadow-xs"
            title="Record incoming customer purchase order received by Keshar Kali"
          >
            <Inbox size={14} />
            <span>Receive PO</span>
          </button>

          <button 
            onClick={() => onOpenQuickAction('loading')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#5E1010] text-white px-3 py-1.5 rounded hover:bg-[#480c0c] transition-colors shadow-xs"
          >
            <Truck size={14} />
            <span>Add Loading</span>
          </button>

          <button 
            onClick={() => onOpenQuickAction('dispatch')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#C69A3B] text-[#5E1010] px-3 py-1.5 rounded hover:bg-[#b08730] transition-colors shadow-xs"
          >
            <Send size={14} />
            <span>Confirm Dispatch</span>
          </button>

          <button 
            onClick={() => setActivePage('reports-loading')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#E8E2DC] text-[#252525] px-3 py-1.5 rounded hover:bg-gray-50 transition-colors shadow-xs"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            <span>Excel Exports</span>
          </button>
        </div>
      </div>

      {/* Row 1: Primary Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
          label="Total Loaded" 
          value={`${metrics.totalLoadedQuantity.toLocaleString('en-IN')} QTL`} 
          subtext={`Pending Loading: ${metrics.pendingLoading} QTL`}
          icon={Truck} 
          color="gold"
          onClick={() => setActivePage('master-loading-register')}
        />
        <StatCard 
          label="Total Dispatched" 
          value={`${metrics.totalDispatchedQuantity.toLocaleString('en-IN')} QTL`} 
          subtext={`Pending Dispatch: ${metrics.pendingDispatch} QTL`}
          icon={Send} 
          color="green"
          onClick={() => setActivePage('dispatch-management')}
        />
        <StatCard 
          label="Pending Fulfillment" 
          value={`${metrics.overallPendingFulfillment.toLocaleString('en-IN')} QTL`} 
          subtext="Net Buyer Deliveries Due"
          icon={Clock} 
          color="amber"
          alert={metrics.overallPendingFulfillment > 0}
          onClick={() => setActivePage('pending-loadings')}
        />
      </div>

      {/* Row 2: Stock Position & Valuation Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard 
          label="Total Physical Stock" 
          value={`${metrics.totalPhysicalStock.toLocaleString('en-IN')} QTL`} 
          subtext="Audited Warehouse Inventory"
          icon={Warehouse} 
          color="red"
          onClick={() => setActivePage('stock-dashboard')}
        />
        <StatCard 
          label="Reserved Stock" 
          value={`${metrics.totalReservedStock.toLocaleString('en-IN')} QTL`} 
          subtext="Customer Order Commitments"
          icon={Scale} 
          color="burgundy"
          onClick={() => setActivePage('stock-dashboard')}
        />
        <StatCard 
          label="Available For Sale" 
          value={`${metrics.totalAvailableStock.toLocaleString('en-IN')} QTL`} 
          subtext="Physical - Reserved"
          icon={CheckCircle2} 
          color="green"
          onClick={() => setActivePage('stock-dashboard')}
        />
        <StatCard 
          label="Total Stock Valuation" 
          value={`₹${(metrics.totalStockValue || 0).toLocaleString('en-IN')}`} 
          subtext="Weighted Average Purchase Cost"
          icon={TrendingUp} 
          color="gold"
          onClick={() => setActivePage('stock-valuation')}
        />
      </div>

      {/* Low Stock Alerts (if any) */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-lg shadow-xs flex items-center justify-between">
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
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded transition-colors shadow-xs shrink-0"
          >
            Inward Replenishment
          </button>
        </div>
      )}

      {/* Row 3: Actionable Operational Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unallocated / Pending POs */}
        <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden flex flex-col">
          <div className="bg-[#FAF9F6] border-b border-[#E8E2DC] px-4 py-3 flex items-center justify-between">
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
                  <tr className="bg-gray-50 text-[#777777] border-b border-[#E8E2DC]">
                    <th className="py-2 px-3 text-left">PO #</th>
                    <th className="py-2 px-3 text-left">Buyer</th>
                    <th className="py-2 px-3 text-right">Ordered QTL</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DC]">
                  {pendingTasks.unallocatedPOs.map(po => (
                    <tr key={po.id} className="hover:bg-amber-50/30">
                      <td className="py-2.5 px-3 font-semibold text-[#8F1717]">{po.po_number}</td>
                      <td className="py-2.5 px-3 text-[#252525]">{po.customer_name}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">{po.ordered_quantity}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setActivePage('purchase-orders')}
                          className="px-2 py-1 rounded bg-[#8F1717] text-white text-[10px] font-semibold hover:bg-[#771212]"
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

        {/* Loadings Pending Dispatch */}
        <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden flex flex-col">
          <div className="bg-[#FAF9F6] border-b border-[#E8E2DC] px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5E1010] flex items-center gap-2">
              <Truck size={15} />
              Loadings Ready for Dispatch
            </h3>
            <button 
              onClick={() => setActivePage('dispatch-management')}
              className="text-xs text-[#5E1010] hover:underline flex items-center gap-1 font-semibold"
            >
              Dispatch Center <ArrowRight size={12} />
            </button>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            {pendingTasks.undispatchedLoadings.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#777777]">
                No pending loaded quantities waiting for dispatch.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[#777777] border-b border-[#E8E2DC]">
                    <th className="py-2 px-3 text-left">Loading #</th>
                    <th className="py-2 px-3 text-left">PO & Buyer</th>
                    <th className="py-2 px-3 text-left">Vehicle</th>
                    <th className="py-2 px-3 text-right">Available QTL</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DC]">
                  {pendingTasks.undispatchedLoadings.map(ld => (
                    <tr key={ld.id} className="hover:bg-amber-50/30">
                      <td className="py-2.5 px-3 font-semibold text-[#5E1010]">{ld.loading_number}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#252525]">{ld.customer_name}</div>
                        <div className="text-[10px] text-gray-500">{ld.po_number}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">{ld.vehicle_number}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {ld.pending_dispatch_qtl}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setActivePage('dispatch-management')}
                          className="px-2 py-1 rounded bg-[#C69A3B] text-[#5E1010] text-[10px] font-bold hover:bg-[#b08730]"
                        >
                          Dispatch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Industry Distribution & Stock Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Sourcing Distribution */}
        <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] mb-3 flex items-center justify-between">
            <span>Industry Sourcing Breakdown (Strictly Internal)</span>
            <span className="text-[10px] text-gray-500 font-normal">Actual loaded volume</span>
          </h3>
          <div className="space-y-3">
            {industryDistribution.map((ind, idx) => {
              const maxQtl = Math.max(...industryDistribution.map(i => i.total_loaded_qtl), 1);
              const pct = ((ind.total_loaded_qtl / maxQtl) * 100).toFixed(0);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#252525]">{ind.industry_name}</span>
                    <span className="font-mono font-bold text-[#8F1717]">{ind.total_loaded_qtl} QTL</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#8F1717] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Product Stock Distribution */}
        <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] mb-3 flex items-center justify-between">
            <span>Product Inventory Levels</span>
            <span className="text-[10px] text-gray-500 font-normal">Physical vs Reserved</span>
          </h3>
          <div className="space-y-3">
            {productDistribution.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-xs">
                <div>
                  <div className="font-semibold text-[#252525]">{p.name}</div>
                  <div className="text-[10px] text-[#777777]">{p.code}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="font-mono font-bold text-[#252525]">{p.physicalStock} QTL</div>
                    <div className="text-[10px] text-gray-400">Physical</div>
                  </div>
                  <div>
                    <div className="font-mono font-bold text-amber-700">{p.reservedStock} QTL</div>
                    <div className="text-[10px] text-gray-400">Reserved</div>
                  </div>
                  <div>
                    <div className="font-mono font-bold text-emerald-700">{p.availableStock} QTL</div>
                    <div className="text-[10px] text-gray-400">Available</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Recent Chronological Audit Log */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] mb-3 flex items-center justify-between">
          <span>Recent Operational Log</span>
          <button onClick={() => setActivePage('settings')} className="text-xs text-[#8F1717] hover:underline font-semibold">
            All Logs →
          </button>
        </h3>
        <div className="space-y-2">
          {recentActivities.slice(0, 5).map((log, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-700">
                  {log.action}
                </span>
                <span className="font-medium text-[#252525]">{log.entity_type} {log.entity_id}</span>
                <span className="text-[#777777] text-[11px] truncate max-w-md">{log.details}</span>
              </div>
              <div className="text-right shrink-0 text-[11px] text-[#777777] font-mono">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {log.actor}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

