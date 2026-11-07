// src/pages/PurchaseOrders.jsx
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  X, 
  Trash2, 
  Factory, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  TrendingUp, 
  Package, 
  Send,
  Building2,
  Calendar,
  Inbox
} from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';

export default function PurchaseOrders({ onOpenQuickAction, quickActionTrigger }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');

  // Modals
  const [selectedPO, setSelectedPO] = useState(null);
  const [poDetails, setPoDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false);
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);

  useEffect(() => {
    if (quickActionTrigger?.action === 'po') {
      setIsReceiveOpen(true);
    }
  }, [quickActionTrigger]);

  // Form states
  const [receiveForm, setReceiveForm] = useState({
    po_number: '',
    customer_id: '',
    product_id: '',
    po_date: new Date().toISOString().split('T')[0],
    ordered_quantity: '',
    customer_selling_rate: '',
    delivery_location: '',
    expected_delivery_date: '',
    notes: ''
  });

  const [allocForm, setAllocForm] = useState({
    industry_id: '',
    allocated_quantity: '',
    purchase_rate: '',
    expected_loading_date: '',
    notes: '',
    override_allowed: false
  });

  const [reserveForm, setReserveForm] = useState({
    warehouse_id: '',
    quantity: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, custRes, prodRes, indRes, whRes] = await Promise.all([
        api.purchaseOrders.getAll({ status: statusFilter, buyerId: buyerFilter, search }),
        api.customers.getAll(),
        api.products.getAll(),
        api.industries.getAll(),
        api.warehouses.getAll()
      ]);
      setPurchaseOrders(posRes.purchaseOrders || []);
      setCustomers(custRes.customers || []);
      setProducts(prodRes.products || []);
      setIndustries(indRes.industries || []);
      setWarehouses(whRes.warehouses || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, buyerFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleViewPODetails = async (poId) => {
    try {
      setLoadingDetails(true);
      setSelectedPO(poId);
      const res = await api.purchaseOrders.getById(poId);
      setPoDetails(res);
    } catch (err) {
      alert(`Error loading PO details: ${err.message}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleReceivePO = async (e) => {
    e.preventDefault();
    try {
      await api.purchaseOrders.create(receiveForm);
      setIsReceiveOpen(false);
      setReceiveForm({
        po_number: '',
        customer_id: '',
        product_id: '',
        po_date: new Date().toISOString().split('T')[0],
        ordered_quantity: '',
        customer_selling_rate: '',
        delivery_location: '',
        expected_delivery_date: '',
        notes: ''
      });
      loadData();
    } catch (err) {
      alert(`Failed to record received PO: ${err.message}`);
    }
  };

  const handleAddAllocation = async (e) => {
    e.preventDefault();
    try {
      await api.allocations.create({
        po_id: selectedPO,
        industry_id: allocForm.industry_id,
        product_id: poDetails.purchaseOrder.product_id,
        allocated_quantity: allocForm.allocated_quantity,
        purchase_rate: allocForm.purchase_rate,
        expected_loading_date: allocForm.expected_loading_date,
        notes: allocForm.notes,
        override_allowed: allocForm.override_allowed
      });
      setIsAllocModalOpen(false);
      setAllocForm({
        industry_id: '',
        allocated_quantity: '',
        purchase_rate: '',
        expected_loading_date: '',
        notes: '',
        override_allowed: false
      });
      handleViewPODetails(selectedPO);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveAllocation = async (allocId) => {
    if (!confirm('Are you sure you want to remove this sourcing allocation?')) return;
    try {
      await api.allocations.delete(allocId);
      handleViewPODetails(selectedPO);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReserveStock = async (e) => {
    e.preventDefault();
    try {
      await api.stock.reserve({
        poId: selectedPO,
        productId: poDetails.purchaseOrder.product_id,
        warehouseId: reserveForm.warehouse_id,
        quantity: reserveForm.quantity
      });
      setIsReserveModalOpen(false);
      setReserveForm({ warehouse_id: '', quantity: '' });
      handleViewPODetails(selectedPO);
      loadData();
      alert('Stock reserved successfully for this customer order!');
    } catch (err) {
      alert(`Reservation failed: ${err.message}`);
    }
  };

  const handleCancelPO = async (poId) => {
    if (!confirm('Are you sure you want to cancel this purchase order? All pending allocations and reservations will be cancelled.')) return;
    try {
      await api.purchaseOrders.cancel(poId);
      loadData();
      if (selectedPO === poId) setSelectedPO(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'New': 'bg-blue-100 text-blue-800 border-blue-200',
      'Partially Allocated': 'bg-amber-100 text-amber-800 border-amber-200',
      'Allocated': 'bg-purple-100 text-purple-800 border-purple-200',
      'Partially Loaded': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Loaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'Partially Dispatched': 'bg-orange-100 text-orange-800 border-orange-200',
      'Dispatched': 'bg-teal-100 text-teal-800 border-teal-200',
      'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
      'Cancelled': 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E2DC]">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Inbox size={18} className="text-[#8F1717]" />
              Received Customer Purchase Orders
            </h1>
            <p className="text-xs text-[#777777]">
              Manage buyer PO contracts received by Keshar Kali, multi-mill sourcing allocations, and fulfillment tracking
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReceiveOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded-md shadow-xs transition-colors"
              title="Record incoming customer purchase order received by Keshar Kali"
            >
              <Inbox size={14} />
              <span>Receive Customer PO</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <form onSubmit={handleSearchSubmit} className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search PO#, Buyer, Product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Partially Allocated">Partially Allocated</option>
            <option value="Allocated">Allocated</option>
            <option value="Partially Loaded">Partially Loaded</option>
            <option value="Loaded">Loaded</option>
            <option value="Partially Dispatched">Partially Dispatched</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Buyers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-xs font-semibold py-1.5 rounded transition-colors text-[#252525]"
          >
            <Filter size={13} />
            <span>Apply Filters</span>
          </button>
        </form>
      </div>

      {/* PO Listing Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th className="text-left">PO Number</th>
                <th className="text-center">Date</th>
                <th className="text-left">Buyer / Customer</th>
                <th className="text-left">Rice Product</th>
                <th className="text-right">Ordered QTL</th>
                <th className="text-right">Allocated QTL</th>
                <th className="text-right">Loaded QTL</th>
                <th className="text-right">Dispatched QTL</th>
                <th className="text-right">Remaining QTL</th>
                <th className="text-right">Selling Rate</th>
                <th className="text-right">Order Value</th>
                <th className="text-center">Status</th>
                <th className="text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-10 text-xs text-[#777777]">
                    No purchase orders found matching criteria.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po, idx) => (
                  <tr key={po.id} className="hover:bg-amber-50/40">
                    <td className="text-center text-[11px] text-[#777777] font-mono">{idx + 1}</td>
                    <td className="font-semibold text-[#8F1717] cursor-pointer hover:underline" onClick={() => handleViewPODetails(po.id)}>
                      {po.po_number}
                    </td>
                    <td className="text-center text-xs">{po.po_date}</td>
                    <td className="font-medium">{po.customer_name}</td>
                    <td>{po.product_name}</td>
                    <td className="text-right font-mono font-bold">{Number(po.ordered_quantity).toFixed(2)}</td>
                    <td className="text-right font-mono text-purple-700">{Number(po.allocated_quantity).toFixed(2)}</td>
                    <td className="text-right font-mono text-indigo-700">{Number(po.loaded_quantity).toFixed(2)}</td>
                    <td className="text-right font-mono text-emerald-700 font-bold">{Number(po.dispatched_quantity).toFixed(2)}</td>
                    <td className="text-right font-mono text-amber-700 font-bold">{Number(po.remaining_quantity).toFixed(2)}</td>
                    <td className="text-right font-mono">₹{Number(po.customer_selling_rate).toLocaleString('en-IN')}</td>
                    <td className="text-right font-mono font-semibold">₹{Number(po.order_value).toLocaleString('en-IN')}</td>
                    <td className="text-center">{getStatusBadge(po.status)}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewPODetails(po.id)}
                          className="p-1 rounded text-[#8F1717] hover:bg-red-50"
                          title="View Sourcing Allocations & Fulfillment"
                        >
                          <Eye size={15} />
                        </button>
                        {po.status !== 'Completed' && po.status !== 'Cancelled' && po.dispatched_quantity === 0 && (
                          <button
                            onClick={() => handleCancelPO(po.id)}
                            className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50"
                            title="Cancel Order"
                          >
                            <Trash2 size={14} />
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

      {/* Detail Drawer / Modal for Sourcing & Fulfillment */}
      {selectedPO && poDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPO(null)}
          title={`Order Fulfillment & Sourcing — ${poDetails.purchaseOrder.po_number}`}
          subtitle={`Buyer: ${poDetails.purchaseOrder.customer_name} | Product: ${poDetails.purchaseOrder.product_name} | Ordered: ${poDetails.purchaseOrder.ordered_quantity} QTL @ ₹${poDetails.purchaseOrder.customer_selling_rate}/QTL`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Fulfillment Progress Bar */}
            <div className="bg-white p-4 rounded-lg border border-[#E8E2DC] shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-[#8F1717] uppercase tracking-wide">Fulfillment Progress</span>
                <span className="font-mono font-bold text-emerald-800">
                  {poDetails.stats.totalDispatched} / {poDetails.purchaseOrder.ordered_quantity} QTL ({poDetails.stats.fulfillmentPercentage}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#8F1717] to-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, poDetails.stats.fulfillmentPercentage)}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs mt-3 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-gray-400 text-[10px]">Ordered</div>
                  <div className="font-mono font-bold">{poDetails.purchaseOrder.ordered_quantity} QTL</div>
                </div>
                <div>
                  <div className="text-purple-600 text-[10px]">Allocated</div>
                  <div className="font-mono font-bold">{poDetails.stats.totalAllocated} QTL</div>
                </div>
                <div>
                  <div className="text-indigo-600 text-[10px]">Loaded</div>
                  <div className="font-mono font-bold">{poDetails.stats.totalLoaded} QTL</div>
                </div>
                <div>
                  <div className="text-emerald-600 text-[10px]">Dispatched</div>
                  <div className="font-mono font-bold">{poDetails.stats.totalDispatched} QTL</div>
                </div>
              </div>
            </div>

            {/* Sourcing Economics Strip (Confidential) */}
            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <TrendingUp size={14} />
                  Confidential Sourcing Economics
                </h4>
                <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                  Internal Only
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-gray-500 text-[11px]">Weighted Purchase Rate:</div>
                  <div className="font-mono font-bold text-[#8F1717]">₹{poDetails.stats.weightedAvgPurchaseRate}/QTL</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">Customer Selling Rate:</div>
                  <div className="font-mono font-bold text-[#252525]">₹{poDetails.purchaseOrder.customer_selling_rate}/QTL</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">Total Procurement Cost:</div>
                  <div className="font-mono font-bold text-[#5E1010]">₹{poDetails.stats.totalProcurementCost.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">Est. Gross Margin:</div>
                  <div className="font-mono font-bold text-emerald-700">₹{poDetails.stats.estimatedGrossMargin.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            {/* Multi-Industry Sourcing Allocations Section */}
            <div className="bg-white rounded-lg border border-[#E8E2DC] overflow-hidden shadow-xs">
              <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8F1717] flex items-center gap-1.5">
                    <Factory size={15} />
                    Internal Industry Sourcing Allocations
                  </h4>
                  <p className="text-[11px] text-[#777777]">
                    Allocate one customer order across multiple rice mills
                  </p>
                </div>
                {poDetails.purchaseOrder.status !== 'Completed' && (
                  <button
                    onClick={() => {
                      const remainingToAlloc = Math.max(0, poDetails.purchaseOrder.ordered_quantity - poDetails.stats.totalAllocated);
                      setAllocForm({
                        ...allocForm,
                        allocated_quantity: remainingToAlloc > 0 ? remainingToAlloc : ''
                      });
                      setIsAllocModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-2.5 py-1.5 rounded transition-colors"
                  >
                    <Plus size={13} />
                    <span>Add Industry</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="excel-grid">
                  <thead>
                    <tr>
                      <th className="text-left">Industry / Rice Mill</th>
                      <th className="text-left">Location</th>
                      <th className="text-right">Allocated QTL</th>
                      <th className="text-right">Purchase Rate</th>
                      <th className="text-right">Purchase Amount</th>
                      <th className="text-right">Loaded QTL</th>
                      <th className="text-right">Pending Loading</th>
                      <th className="text-center">Status</th>
                      <th className="text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poDetails.allocations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-xs text-[#777777]">
                          No industry sourcing allocations created yet. Click "Add Industry" above.
                        </td>
                      </tr>
                    ) : (
                      poDetails.allocations.map((alloc) => (
                        <tr key={alloc.id}>
                          <td className="font-semibold text-[#252525]">{alloc.industry_name}</td>
                          <td className="text-xs text-gray-500">{alloc.industry_location}</td>
                          <td className="text-right font-mono font-bold text-purple-700">{alloc.allocated_quantity}</td>
                          <td className="text-right font-mono">₹{alloc.purchase_rate}</td>
                          <td className="text-right font-mono font-semibold">₹{alloc.purchase_amount.toLocaleString('en-IN')}</td>
                          <td className="text-right font-mono text-indigo-700">{alloc.loaded_quantity}</td>
                          <td className="text-right font-mono text-amber-700">{alloc.pending_loading_quantity}</td>
                          <td className="text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {alloc.status}
                            </span>
                          </td>
                          <td className="text-center">
                            {alloc.loaded_quantity === 0 && (
                              <button
                                onClick={() => handleRemoveAllocation(alloc.id)}
                                className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50"
                                title="Remove allocation"
                              >
                                <Trash2 size={13} />
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

            {/* Loading & Dispatches Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Loadings */}
              <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs">
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#5E1010] mb-2 flex items-center justify-between">
                  <span>Actual Loading Entries</span>
                  <span className="text-[11px] font-mono text-indigo-700">{poDetails.loadings.length} entries</span>
                </h5>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {poDetails.loadings.length === 0 ? (
                    <div className="text-xs text-gray-400 py-3 text-center">No loading records yet.</div>
                  ) : (
                    poDetails.loadings.map(l => (
                      <div key={l.id} className="text-xs p-2 rounded bg-gray-50 flex items-center justify-between border border-gray-100">
                        <div>
                          <span className="font-semibold text-[#5E1010]">{l.loading_number}</span>
                          <span className="text-gray-400 ml-2">({l.loading_date})</span>
                          <div className="text-[10px] text-gray-600">{l.industry_name} • Veh: {l.vehicle_number}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-indigo-700">{l.loading_quantity} QTL</div>
                          <span className="text-[10px] text-gray-500 font-medium">{l.fulfillment_type}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Dispatches */}
              <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] shadow-xs">
                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center justify-between">
                  <span>Customer Dispatches</span>
                  <span className="text-[11px] font-mono text-emerald-700">{poDetails.dispatches.length} dispatches</span>
                </h5>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {poDetails.dispatches.length === 0 ? (
                    <div className="text-xs text-gray-400 py-3 text-center">No dispatches confirmed yet.</div>
                  ) : (
                    poDetails.dispatches.map(d => (
                      <div key={d.id} className="text-xs p-2 rounded bg-gray-50 flex items-center justify-between border border-gray-100">
                        <div>
                          <span className="font-semibold text-emerald-800">{d.dispatch_number}</span>
                          <span className="text-gray-400 ml-2">({d.dispatch_date})</span>
                          <div className="text-[10px] text-gray-600">Veh: {d.vehicle_number} • {d.source_type}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-700">{d.dispatch_quantity} QTL</div>
                          <span className="text-[10px] text-emerald-600 font-medium">WhatsApp: {d.notification_status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Warehouse Stock Reservation Controls */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC] flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-[#252525]">Warehouse Inventory Reservation</h5>
                <p className="text-[11px] text-gray-500">
                  Active reservations for this PO: <strong>{poDetails.reservations.reduce((s, r) => s + (r.reserved_quantity - r.released_quantity), 0)} QTL</strong>
                </p>
              </div>
              <button
                onClick={() => setIsReserveModalOpen(true)}
                className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-[#252525] px-3 py-1.5 rounded transition-colors"
              >
                + Reserve Stock
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Receive Purchase Order Modal */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Record Received Customer Purchase Order"
        subtitle="Record incoming buyer purchase order received by Keshar Kali"
      >
        <div className="bg-amber-50/70 border border-amber-200 rounded p-2.5 text-xs text-[#5E1010] mb-3 flex items-start gap-2">
          <Inbox size={15} className="text-[#8F1717] shrink-0 mt-0.5" />
          <span>Keshar Kali receives purchase orders from customers. Enter the buyer's order details below as received.</span>
        </div>

        <form onSubmit={handleReceivePO} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Customer / Buyer *</label>
              <select
                required
                value={receiveForm.customer_id}
                onChange={(e) => setReceiveForm({ ...receiveForm, customer_id: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Buyer PO # / Reference (Optional)</label>
              <input
                type="text"
                placeholder="e.g. PO-ABC-884 (or auto-assigned if empty)"
                value={receiveForm.po_number}
                onChange={(e) => setReceiveForm({ ...receiveForm, po_number: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Rice Product / Variety *</label>
              <select
                required
                value={receiveForm.product_id}
                onChange={(e) => setReceiveForm({ ...receiveForm, product_id: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              >
                <option value="">Select Product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.variety} (Std: ₹{p.standard_selling_rate})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">PO Received Date *</label>
              <input
                type="date"
                required
                value={receiveForm.po_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, po_date: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Ordered Quantity (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 100"
                value={receiveForm.ordered_quantity}
                onChange={(e) => setReceiveForm({ ...receiveForm, ordered_quantity: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Agreed Selling Rate (₹/QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 3200"
                value={receiveForm.customer_selling_rate}
                onChange={(e) => setReceiveForm({ ...receiveForm, customer_selling_rate: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#252525] mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={receiveForm.expected_delivery_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, expected_delivery_date: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-[#252525] mb-1">Delivery Location / Godown Address *</label>
            <input
              type="text"
              required
              placeholder="e.g. Customer Godown, Kalamna Mandi, Nagpur"
              value={receiveForm.delivery_location}
              onChange={(e) => setReceiveForm({ ...receiveForm, delivery_location: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-[#252525] mb-1">Buyer Notes / Terms</label>
            <textarea
              rows={2}
              placeholder="Payment terms, special packaging instructions from buyer..."
              value={receiveForm.notes}
              onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsReceiveOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Inbox size={14} />
              <span>Record Received PO</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Sourcing Allocation Modal */}
      <Modal
        isOpen={isAllocModalOpen}
        onClose={() => setIsAllocModalOpen(false)}
        title="Add Industry Sourcing Allocation"
        subtitle="Commit procurement quantity and rate from a rice mill"
      >
        <form onSubmit={handleAddAllocation} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#252525] mb-1">Select Industry (Rice Mill) *</label>
            <select
              required
              value={allocForm.industry_id}
              onChange={(e) => {
                const indId = e.target.value;
                const ind = industries.find(i => String(i.id) === String(indId));
                setAllocForm({
                  ...allocForm,
                  industry_id: indId,
                  purchase_rate: ind?.default_purchase_rate || allocForm.purchase_rate
                });
              }}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            >
              <option value="">Select Sourcing Industry</option>
              {industries.map(ind => (
                <option key={ind.id} value={ind.id}>
                  {ind.name} ({ind.location}) — Std Rate: ₹{ind.default_purchase_rate}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Allocated Quantity (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 40"
                value={allocForm.allocated_quantity}
                onChange={(e) => setAllocForm({ ...allocForm, allocated_quantity: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Purchase Rate (₹/QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 2850"
                value={allocForm.purchase_rate}
                onChange={(e) => setAllocForm({ ...allocForm, purchase_rate: e.target.value })}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Expected Loading Date</label>
            <input
              type="date"
              value={allocForm.expected_loading_date}
              onChange={(e) => setAllocForm({ ...allocForm, expected_loading_date: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
            <input
              type="checkbox"
              id="override"
              checked={allocForm.override_allowed}
              onChange={(e) => setAllocForm({ ...allocForm, override_allowed: e.target.checked })}
              className="rounded text-[#8F1717] focus:ring-[#8F1717]"
            />
            <label htmlFor="override" className="text-[11px] text-amber-900 font-medium">
              Authorized Override: Allow allocation to exceed customer PO quantity
            </label>
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAllocModalOpen(false)}
              className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs"
            >
              Confirm Sourcing Allocation
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Reservation Modal */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title="Reserve Warehouse Stock for Customer Order"
        subtitle="Soft commitment of existing inventory without physical outward deduction"
      >
        <form onSubmit={handleReserveStock} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#252525] mb-1">Select Warehouse / Godown *</label>
            <select
              required
              value={reserveForm.warehouse_id}
              onChange={(e) => setReserveForm({ ...reserveForm, warehouse_id: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            >
              <option value="">Select Warehouse</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.location}) — Stock: {w.current_stock} QTL</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Quantity to Reserve (QTL) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 50"
              value={reserveForm.quantity}
              onChange={(e) => setReserveForm({ ...reserveForm, quantity: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900">
            <strong>Accounting Guarantee:</strong> Reserving stock creates an allocation commitment that reduces <em>Available Stock</em> for sales, but strictly does <strong>not</strong> deduct physical warehouse inventory until confirmed dispatch.
          </div>

          <div className="pt-3 border-t border-[#E8E2DC] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsReserveModalOpen(false)}
              className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs"
            >
              Confirm Reservation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

