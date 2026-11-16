// src/pages/PurchaseOrders.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  Inbox,
  Layers,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Users,
  Upload,
  FileText,
  Image,
  Download,
  Check,
  RotateCcw
} from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';

export default function PurchaseOrders({ onOpenQuickAction, quickActionTrigger }) {
  const { showToast, confirm } = useNotification();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('new-to-old');
  const [pendingFilter, setPendingFilter] = useState('all'); // 'all' | 'pending-qtl' | 'fully-loaded'
  const [expandedPOs, setExpandedPOs] = useState({});

  // Helper: Format date as DD/MM/YYYY
  const formatDateDMY = (dateVal) => {
    if (!dateVal) return '—';
    const s = String(dateVal).trim();
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const yyyy = isoMatch[1];
      const mm = isoMatch[2].padStart(2, '0');
      const dd = isoMatch[3].padStart(2, '0');
      return `${dd}/${mm}/${yyyy}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return s;
  };

  const toggleExpandPO = (id) => {
    setExpandedPOs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandAll = () => {
    const allExpanded = sortedPurchaseOrders.length > 0 && sortedPurchaseOrders.every(p => expandedPOs[p.id]);
    if (allExpanded) {
      setExpandedPOs({});
    } else {
      const next = {};
      sortedPurchaseOrders.forEach(p => { next[p.id] = true; });
      setExpandedPOs(next);
    }
  };

  // Sub-Order Bill Upload & Preview Modals
  const [billUploadModal, setBillUploadModal] = useState({
    isOpen: false,
    poId: null,
    poNumber: '',
    subOrderNo: '',
    buyerName: '',
    billNo: '',
    fileData: '',
    fileName: '',
    mimeType: '',
    fileSize: 0,
    isUploading: false
  });

  const [billPreviewModal, setBillPreviewModal] = useState({
    isOpen: false,
    billUrl: '',
    billNo: '',
    fileName: '',
    subOrderNo: '',
    poNumber: '',
    poId: null
  });

  const openUploadModal = (po, sub) => {
    setBillUploadModal({
      isOpen: true,
      poId: po.id,
      poNumber: po.po_number,
      subOrderNo: sub.sub_order_no || sub.subOrderNo,
      buyerName: sub.buyer_name || sub.buyerName || po.customer_name,
      billNo: sub.bill_no || sub.billNo || '',
      fileData: '',
      fileName: '',
      mimeType: '',
      fileSize: 0,
      isUploading: false
    });
  };

  const handleBillFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('File size exceeds 15MB. Please choose a smaller PDF or image.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setBillUploadModal(prev => ({
        ...prev,
        fileData: event.target.result,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/pdf'
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSubOrderBill = async (e) => {
    e.preventDefault();
    if (!billUploadModal.fileData) {
      showToast('Please select a PDF document or image file to upload.', 'warning');
      return;
    }
    try {
      setBillUploadModal(prev => ({ ...prev, isUploading: true }));
      await api.purchaseOrders.uploadSubOrderBill(
        billUploadModal.poId,
        billUploadModal.subOrderNo,
        {
          billNo: billUploadModal.billNo,
          fileName: billUploadModal.fileName,
          fileData: billUploadModal.fileData,
          mimeType: billUploadModal.mimeType
        }
      );
      setBillUploadModal(prev => ({ ...prev, isOpen: false, isUploading: false }));
      showToast(`Mill bill uploaded successfully for Sub PO ${billUploadModal.subOrderNo}!`, 'success');
      loadData();
      if (selectedPO) {
        handleViewPODetails(selectedPO);
      }
    } catch (err) {
      showToast(`Failed to upload bill: ${err.message}`, 'error');
      setBillUploadModal(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleDeleteSubOrderBill = async (poId, subOrderNo) => {
    const ok = await confirm({
      title: 'Delete Bill Document',
      message: `Are you sure you want to delete the bill document for ${subOrderNo}?`,
      confirmText: 'Delete Bill',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.purchaseOrders.deleteSubOrderBill(poId, subOrderNo);
      setBillPreviewModal(prev => ({ ...prev, isOpen: false }));
      showToast(`Bill document removed for Sub PO ${subOrderNo}.`, 'success');
      loadData();
      if (selectedPO) {
        handleViewPODetails(selectedPO);
      }
    } catch (err) {
      showToast(`Failed to delete bill: ${err.message}`, 'error');
    }
  };

  // Modals
  const [selectedPO, setSelectedPO] = useState(null);
  const [poDetails, setPoDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false);

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

  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, custRes, prodRes, indRes, whRes] = await Promise.all([
        api.purchaseOrders.getAll({ status: statusFilter, buyerId: buyerFilter, search, sortOrder }),
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
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, buyerFilter, sortOrder, search]);

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || buyerFilter || pendingFilter !== 'all' || sortOrder !== 'new-to-old'
  );

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setBuyerFilter('');
    setPendingFilter('all');
    setSortOrder('new-to-old');
  };

  const pendingCount = useMemo(() => {
    return purchaseOrders.filter(p => Number(p.remaining_quantity ?? (p.ordered_quantity - (p.loaded_quantity || 0))) > 0).length;
  }, [purchaseOrders]);

  const fullyLoadedCount = useMemo(() => {
    return purchaseOrders.filter(p => Number(p.remaining_quantity ?? (p.ordered_quantity - (p.loaded_quantity || 0))) <= 0).length;
  }, [purchaseOrders]);

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      // 1. Pending filter
      const remaining = Number(po.remaining_quantity ?? (po.ordered_quantity - (po.loaded_quantity || 0)));
      if (pendingFilter === 'pending-qtl' && remaining <= 0) return false;
      if (pendingFilter === 'fully-loaded' && remaining > 0) return false;

      // 2. Status filter
      if (statusFilter && po.status !== statusFilter) return false;

      // 3. Buyer filter
      if (buyerFilter) {
        const matchesMainCustomer = String(po.customer_id) === String(buyerFilter);
        const selectedCustomer = customers.find(c => String(c.id) === String(buyerFilter));
        const matchesSubCustomer = Boolean(selectedCustomer && po.sub_orders?.some(s => 
          (s.buyer_name || s.buyerName) === selectedCustomer.name
        ));
        if (!matchesMainCustomer && !matchesSubCustomer) return false;
      }

      // 4. Live search filter (instant client-side response as user types!)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const mainMatch = (
          po.po_number?.toLowerCase().includes(q) ||
          po.customer_name?.toLowerCase().includes(q) ||
          po.customer_name_text?.toLowerCase().includes(q) ||
          po.product_name?.toLowerCase().includes(q) ||
          po.status?.toLowerCase().includes(q) ||
          po.sub_order_no?.toLowerCase().includes(q) ||
          po.delivery_location?.toLowerCase().includes(q) ||
          po.original_order_id?.toLowerCase().includes(q)
        );
        const subMatch = po.sub_orders?.some(s => 
          (s.sub_order_no || s.subOrderNo)?.toLowerCase().includes(q) ||
          (s.buyer_name || s.buyerName)?.toLowerCase().includes(q) ||
          (s.product_name || s.productName)?.toLowerCase().includes(q) ||
          (s.delivery_location || s.deliveryLocation)?.toLowerCase().includes(q) ||
          (s.bill_no || s.billNo)?.toLowerCase().includes(q)
        );
        if (!mainMatch && !subMatch) return false;
      }

      return true;
    });
  }, [purchaseOrders, pendingFilter, statusFilter, buyerFilter, search, customers]);

  const sortedPurchaseOrders = useMemo(() => {
    return [...filteredPurchaseOrders].sort((a, b) => {
      const dateA = a.po_date || '';
      const dateB = b.po_date || '';
      const subA = a.sub_order_no || '';
      const subB = b.sub_order_no || '';
      const idA = a.id || 0;
      const idB = b.id || 0;

      if (sortOrder === 'old-to-new') {
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        if (subA !== subB) return subA.localeCompare(subB);
        return idA - idB;
      } else {
        // Default: new-to-old
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        if (subA !== subB) return subB.localeCompare(subA);
        return idB - idA;
      }
    });
  }, [filteredPurchaseOrders, sortOrder]);

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
      showToast(`Error loading PO details: ${err.message}`, 'error');
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
      showToast('Purchase Order received and registered successfully!', 'success');
      loadData();
    } catch (err) {
      showToast(`Failed to record received PO: ${err.message}`, 'error');
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
      showToast('Mill allocation recorded successfully!', 'success');
      handleViewPODetails(selectedPO);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveAllocation = async (allocId) => {
    const ok = await confirm({
      title: 'Remove Allocation',
      message: 'Are you sure you want to remove this sourcing allocation?',
      confirmText: 'Remove Allocation',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.allocations.delete(allocId);
      showToast('Sourcing allocation removed.', 'success');
      handleViewPODetails(selectedPO);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCancelPO = async (poId) => {
    const ok = await confirm({
      title: 'Cancel Purchase Order',
      message: 'Are you sure you want to cancel this purchase order? All pending allocations will be cancelled.',
      confirmText: 'Cancel Purchase Order',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.purchaseOrders.cancel(poId);
      showToast('Purchase order cancelled successfully.', 'success');
      loadData();
      if (selectedPO === poId) setSelectedPO(null);
    } catch (err) {
      showToast(err.message, 'error');
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E8E2DC] pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Filter size={13} className="text-[#8F1717]" /> Filter Orders:
            </span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8F1717]/10 text-[#8F1717] border border-[#8F1717]/20">
                Filtered ({sortedPurchaseOrders.length} of {purchaseOrders.length})
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-[11px] font-semibold text-[#8F1717] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={11} /> Clear All Filters
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search PO#, Buyer, Sub-PO..."
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

          {/* Pending QTL Fulfillment Filter */}
          <select
            value={pendingFilter}
            onChange={(e) => setPendingFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs font-semibold text-[#8F1717] focus:ring-1 focus:ring-[#8F1717] focus:outline-none cursor-pointer"
            title="Filter by Pending QTL fulfillment status"
          >
            <option value="all">Fulfillment: All ({purchaseOrders.length})</option>
            <option value="pending-qtl">⚠️ Pending QTL ({pendingCount})</option>
            <option value="fully-loaded">✅ Fully Loaded ({fullyLoadedCount})</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs font-semibold text-[#8F1717] focus:ring-1 focus:ring-[#8F1717] focus:outline-none cursor-pointer"
            title="Sort chronological order"
          >
            <option value="new-to-old">Sort: Newest to Oldest</option>
            <option value="old-to-new">Sort: Oldest to Newest</option>
          </select>

          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1 bg-[#8F1717] hover:bg-[#771212] text-white text-xs font-semibold py-1.5 px-2 rounded transition-colors cursor-pointer"
            >
              <Filter size={13} />
              <span>Apply</span>
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-1.5 px-2.5 rounded transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* PO Listing Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        {/* Table Toolbar with Glance All Toggle and Pending QTL Quick Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-gray-50/80 border-b border-[#E8E2DC] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-700">Orders List</span>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setPendingFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  pendingFilter === 'all'
                    ? 'bg-[#8F1717] text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All Orders ({purchaseOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setPendingFilter('pending-qtl')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  pendingFilter === 'pending-qtl'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
                title="Filter POs that have pending QTL remaining to be loaded"
              >
                <span>⚠️ Pending QTL</span>
                <span className={`px-1 py-0.2 rounded text-[10px] ${pendingFilter === 'pending-qtl' ? 'bg-black/20 text-white' : 'bg-amber-100 text-amber-900'}`}>
                  {pendingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPendingFilter('fully-loaded')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  pendingFilter === 'fully-loaded'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                }`}
                title="Filter POs that are fully loaded (0 QTL remaining)"
              >
                <span>✅ Fully Loaded</span>
                <span className={`px-1 py-0.2 rounded text-[10px] ${pendingFilter === 'fully-loaded' ? 'bg-black/20 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
                  {fullyLoadedCount}
                </span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleExpandAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#8F1717] bg-white hover:bg-red-50 border border-red-200 rounded shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
            title="Expand or collapse sub-orders across all POs for a quick glance"
          >
            <Layers size={13} />
            <span>
              {sortedPurchaseOrders.length > 0 && sortedPurchaseOrders.every(p => expandedPOs[p.id])
                ? 'Collapse All Sub-Orders'
                : 'Glance All Sub-Orders (Expand All)'}
            </span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-20 text-center whitespace-nowrap">SL NO</th>
                <th 
                  className="text-left cursor-pointer hover:bg-gray-100/70 select-none transition-colors"
                  onClick={() => setSortOrder(prev => prev === 'new-to-old' ? 'old-to-new' : 'new-to-old')}
                  title="Click to toggle New to Old / Old to New sort"
                >
                  <div className="flex items-center gap-1">
                    <span>PO Number</span>
                    <ArrowUpDown size={12} className={sortOrder === 'new-to-old' ? 'text-[#8F1717]' : 'text-blue-600'} />
                    <span className="text-[10px] font-mono text-gray-500 font-normal">
                      ({sortOrder === 'new-to-old' ? 'Newest' : 'Oldest'})
                    </span>
                  </div>
                </th>
                <th 
                  className="text-center cursor-pointer hover:bg-gray-100/70 select-none transition-colors"
                  onClick={() => setSortOrder(prev => prev === 'new-to-old' ? 'old-to-new' : 'new-to-old')}
                  title="Click to toggle New to Old / Old to New sort"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown size={12} className="text-gray-400" />
                  </div>
                </th>
                <th className="text-left">Buyer / Customer</th>
                <th className="text-left">Rice Product</th>
                <th className="text-right">Ordered QTL</th>
                <th className="text-right">Loaded QTL</th>
                <th className="text-right">Remaining QTL</th>
                <th className="text-right">Selling Rate</th>
                <th className="text-right">Order Value</th>
                <th className="text-center">Status</th>
                <th className="text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPurchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-xs text-[#777777]">
                    No purchase orders found matching criteria.
                  </td>
                </tr>
              ) : (
                sortedPurchaseOrders.map((po, idx) => {
                  const subOrdersList = po.sub_orders || [];
                  const hasMultipleSubs = subOrdersList.length > 1;
                  const isExpanded = !!expandedPOs[po.id];

                  // Extract list of unique buyers
                  const uniqueBuyers = Array.from(
                    new Set(subOrdersList.map(s => s.buyer_name || s.buyerName).filter(Boolean))
                  );
                  if (uniqueBuyers.length === 0 && po.customer_name) {
                    uniqueBuyers.push(po.customer_name);
                  }

                  // Format sub-order numbers display
                  const firstSub = subOrdersList[0]?.sub_order_no || subOrdersList[0]?.subOrderNo;
                  const lastSub = subOrdersList[subOrdersList.length - 1]?.sub_order_no || subOrdersList[subOrdersList.length - 1]?.subOrderNo;

                  return (
                    <React.Fragment key={po.id}>
                      <tr className={`hover:bg-amber-50/40 transition-colors ${isExpanded ? 'bg-amber-50/30' : ''}`}>
                        {/* SL NO & Sub-Orders Layers Glance Button */}
                        <td className="text-center font-mono py-2 px-2 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-700 min-w-[18px] text-right">{idx + 1}</span>
                            {subOrdersList.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandPO(po.id);
                                }}
                                className={`p-1 rounded-md transition-all cursor-pointer inline-flex items-center justify-center shadow-2xs ${
                                  isExpanded 
                                    ? 'bg-[#8F1717] text-white shadow-xs' 
                                    : 'text-[#8F1717] bg-red-50 hover:bg-red-100 border border-red-200'
                                }`}
                                title={isExpanded ? 'Collapse Sub-Orders Glance' : `Quick Glance ${subOrdersList.length} Sub-Orders & Buyers`}
                              >
                                <Layers size={13} />
                              </button>
                            ) : (
                              <span className="w-5 inline-block" />
                            )}
                          </div>
                        </td>

                        {/* PO Number + Sub Numbers Glance */}
                        <td className="font-semibold text-[#8F1717]">
                          <div 
                            className="font-mono font-bold cursor-pointer hover:underline inline-flex items-center gap-1"
                            onClick={() => handleViewPODetails(po.id)}
                            title="Click to view full PO sourcing & allocations"
                          >
                            <span>{po.po_number}</span>
                          </div>

                          {/* Easy Glance for Sub Numbers */}
                          {subOrdersList.length > 0 ? (
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              {subOrdersList.map((s, sIdx) => {
                                const sNo = s.sub_order_no || s.subOrderNo;
                                return (
                                  <span 
                                    key={sIdx} 
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                    title={`${sNo}: ${s.buyer_name || s.buyerName} (${Number(s.ordered_quantity || s.orderedQuantity || 0).toFixed(1)} QTL)`}
                                  >
                                    {sNo}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            po.sub_order_no && (
                              <div className="text-[10px] text-blue-700 font-mono font-semibold mt-0.5">
                                Sub: {po.sub_order_no}
                              </div>
                            )
                          )}
                        </td>

                        {/* PO Date */}
                        <td className="text-center text-xs font-mono">{formatDateDMY(po.po_date)}</td>

                        {/* Buyer / Customer Easy Glance */}
                        <td>
                          {subOrdersList.length <= 1 ? (
                            <div className="font-semibold text-gray-900">{uniqueBuyers[0] || po.customer_name}</div>
                          ) : subOrdersList.length <= 3 ? (
                            <div className="space-y-1">
                              {subOrdersList.map((s, sIdx) => (
                                <div key={sIdx} className="text-xs">
                                  <span className="font-mono text-blue-700 font-bold text-[10px] mr-1">{s.sub_order_no || s.subOrderNo}:</span>
                                  <span className="font-semibold text-gray-900">{s.buyer_name || s.buyerName}</span>
                                  <span className="text-gray-500 font-mono text-[10px] ml-1">({Number(s.ordered_quantity || s.orderedQuantity || 0).toFixed(1)} QTL)</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {subOrdersList.slice(0, 2).map((s, sIdx) => (
                                <div key={sIdx} className="text-xs">
                                  <span className="font-mono text-blue-700 font-bold text-[10px] mr-1">{s.sub_order_no || s.subOrderNo}:</span>
                                  <span className="font-semibold text-gray-900">{s.buyer_name || s.buyerName}</span>
                                  <span className="text-gray-500 font-mono text-[10px] ml-1">({Number(s.ordered_quantity || s.orderedQuantity || 0).toFixed(1)} QTL)</span>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleExpandPO(po.id); }}
                                className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer shadow-2xs ${
                                  isExpanded 
                                    ? 'bg-[#8F1717] text-white border-[#8F1717]' 
                                    : 'bg-red-50 text-[#8F1717] border-red-200 hover:bg-red-100'
                                }`}
                                title={`Click to glance all ${subOrdersList.length} sub-orders:\n${subOrdersList.map(s => `${s.sub_order_no || s.subOrderNo}: ${s.buyer_name || s.buyerName} (${s.ordered_quantity || s.orderedQuantity} QTL)`).join('\n')}`}
                              >
                                <Users size={10} />
                                <span>{isExpanded ? 'Hide buyer list' : `+ ${subOrdersList.length - 2} more buyers (glance all)`}</span>
                                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                              </button>
                            </div>
                          )}
                        </td>

                        <td>{po.product_name}</td>
                        <td className="text-right font-mono font-bold">{Number(po.ordered_quantity).toFixed(2)}</td>
                        <td className="text-right font-mono text-indigo-700 font-bold">{Number(po.loaded_quantity).toFixed(2)}</td>
                        <td className="text-right font-mono text-amber-700 font-bold">{Number(po.remaining_quantity).toFixed(2)}</td>
                        <td className="text-right font-mono">₹{Number(po.customer_selling_rate).toLocaleString('en-IN')}</td>
                        <td className="text-right font-mono font-semibold">₹{Number(po.order_value).toLocaleString('en-IN')}</td>
                        <td className="text-center">{getStatusBadge(po.status)}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Quick Glance Toggle Button */}
                            {subOrdersList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpandPO(po.id)}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isExpanded 
                                    ? 'bg-[#8F1717] text-white' 
                                    : 'text-[#8F1717] hover:bg-red-50'
                                }`}
                                title={isExpanded ? 'Collapse Sub-Orders Glance' : 'Quick Glance Sub-Orders & Buyers'}
                              >
                                <Layers size={14} />
                              </button>
                            )}

                            {/* Open Whole PO Drawer Button */}
                            <button
                              onClick={() => handleViewPODetails(po.id)}
                              className="p-1 rounded text-[#8F1717] hover:bg-red-50 transition-colors cursor-pointer"
                              title="Open Whole PO Sourcing & Allocations Drawer"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Cancel PO */}
                            {po.status !== 'Completed' && po.status !== 'Cancelled' && po.dispatched_quantity === 0 && (
                              <button
                                onClick={() => handleCancelPO(po.id)}
                                className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Cancel Order"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* INLINE SUB-ORDERS & BUYERS GLANCE ACCORDION */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-[#E8E2DC]">
                          <td colSpan={12} className="p-0 border-y border-amber-200">
                            <div className="bg-gradient-to-r from-amber-50/70 via-white to-blue-50/40 p-3 pl-8">
                              {/* Top Bar of Accordion */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#8F1717] text-white text-[11px] font-bold tracking-wide uppercase">
                                    <Layers size={11} />
                                    Sub-Orders & Buyers Quick Glance
                                  </span>
                                  <span className="text-xs font-mono font-bold text-gray-800">
                                    Master PO: {po.po_number}
                                  </span>
                                  <span className="text-[11px] text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 font-medium">
                                    {subOrdersList.length} Sub-Orders • {uniqueBuyers.length} Buyers
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleViewPODetails(po.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8F1717] hover:text-red-900 bg-white hover:bg-red-50 border border-red-200 px-2.5 py-1 rounded transition-colors shadow-2xs cursor-pointer"
                                  title="Open full drawer for sourcing allocations, loading notes, and mill dispatches"
                                >
                                  <span>Open Whole PO Details</span>
                                  <ExternalLink size={12} />
                                </button>
                              </div>

                              {/* Mini Sub-Orders Table */}
                              <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-2xs">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100/90 text-gray-700 font-semibold border-b border-gray-200 text-[11px]">
                                      <th className="py-2 px-3 text-left w-10">#</th>
                                      <th className="py-2 px-3 text-left">Sub PO Number</th>
                                      <th className="py-2 px-3 text-left">Buyer / Consignee Name</th>
                                      <th className="py-2 px-3 text-left">Product Variety</th>
                                      <th className="py-2 px-3 text-right">Ordered QTL</th>
                                      <th className="py-2 px-3 text-right">Loaded QTL</th>
                                      <th className="py-2 px-3 text-right">Pending QTL</th>
                                      <th className="py-2 px-3 text-right">Selling Rate</th>
                                      <th className="py-2 px-3 text-right">Subtotal Value</th>
                                      <th className="py-2 px-3 text-center">Mill Bill</th>
                                      <th className="py-2 px-3 text-center">Quick Load</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {subOrdersList.map((sub, sIdx) => {
                                      const ordQty = Number(sub.ordered_quantity || sub.orderedQuantity || 0);
                                      const ldQty = Number(sub.loaded_quantity || sub.loadedQuantity || 0);
                                      const remQty = Math.max(0, ordQty - ldQty);
                                      return (
                                        <tr key={sIdx} className="hover:bg-amber-50/50 transition-colors">
                                          <td className="py-1.5 px-3 text-gray-400 font-mono text-[10px]">{sIdx + 1}</td>
                                          <td className="py-1.5 px-3 font-mono font-bold text-blue-700">
                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
                                              {sub.sub_order_no || sub.subOrderNo || `Sub #${sIdx + 1}`}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-3 font-bold text-gray-900">
                                            {sub.buyer_name || sub.buyerName || po.customer_name}
                                          </td>
                                          <td className="py-1.5 px-3 text-gray-700">
                                            {sub.product_name || sub.productName || po.product_name}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-900">
                                            {ordQty.toFixed(2)}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono font-bold text-indigo-700">
                                            {ldQty.toFixed(2)}
                                          </td>
                                          <td className={`py-1.5 px-3 text-right font-mono font-bold ${remQty > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {remQty.toFixed(2)}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono text-gray-700">
                                            ₹{Number(sub.rate || po.customer_selling_rate || 0).toLocaleString('en-IN')}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-800">
                                            ₹{Number(sub.amount || (ordQty * (sub.rate || 0)) || 0).toLocaleString('en-IN')}
                                          </td>
                                          <td className="py-1.5 px-3 text-center">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                              {sub.bill_no || sub.billNo ? (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold font-mono text-[11px]">
                                                  #{sub.bill_no || sub.billNo}
                                                </span>
                                              ) : (
                                                <span className="text-gray-400 italic text-[10px]">No Bill #</span>
                                              )}

                                              {/* Sub PO Bill Document Status */}
                                              {sub.bill_url || sub.billUrl ? (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setBillPreviewModal({
                                                        isOpen: true,
                                                        billUrl: sub.bill_url || sub.billUrl,
                                                        billNo: sub.bill_no || sub.billNo,
                                                        fileName: sub.bill_file_name || sub.billFileName,
                                                        subOrderNo: sub.sub_order_no || sub.subOrderNo,
                                                        poNumber: po.po_number,
                                                        poId: po.id
                                                      });
                                                    }}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-semibold transition-colors cursor-pointer"
                                                    title="Click to view/download bill PDF or image"
                                                  >
                                                    {(sub.bill_file_name || sub.billFileName || '').endsWith('.pdf') ? (
                                                      <FileText size={11} className="text-red-600" />
                                                    ) : (
                                                      <Image size={11} className="text-blue-600" />
                                                    )}
                                                    <span>View Bill</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openUploadModal(po, sub);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
                                                    title="Replace Bill Document"
                                                  >
                                                    <Upload size={11} />
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openUploadModal(po, sub);
                                                  }}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-[#8F1717] border border-amber-200 text-[10px] font-semibold transition-colors cursor-pointer shadow-2xs mt-0.5"
                                                  title="Upload Mill Bill as PDF or Image for this Sub-Order"
                                                >
                                                  <Upload size={11} />
                                                  <span>+ Upload Bill</span>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-1.5 px-3 text-center">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenQuickAction?.({
                                                  action: 'loading',
                                                  poId: po.id,
                                                  subOrderNo: sub.sub_order_no || sub.subOrderNo
                                                });
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#8F1717] hover:bg-[#771212] text-white font-semibold text-[10px] shadow-2xs cursor-pointer transition-colors"
                                              title={`Record truck loading for ${sub.sub_order_no || sub.subOrderNo} (${remQty.toFixed(2)} QTL pending)`}
                                            >
                                              <Plus size={10} />
                                              <span>Load</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
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
                  {poDetails.stats.totalLoaded} / {poDetails.purchaseOrder.ordered_quantity} QTL ({poDetails.stats.fulfillmentPercentage}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#8F1717] to-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, poDetails.stats.fulfillmentPercentage)}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-gray-400 text-[10px]">Ordered</div>
                  <div className="font-mono font-bold">{poDetails.purchaseOrder.ordered_quantity} QTL</div>
                </div>
                <div>
                  <div className="text-indigo-600 text-[10px]">Loaded</div>
                  <div className="font-mono font-bold text-indigo-700">{poDetails.stats.totalLoaded} QTL</div>
                </div>
                <div>
                  <div className="text-amber-600 text-[10px]">Remaining</div>
                  <div className="font-mono font-bold text-amber-700">{poDetails.stats.remainingQuantity} QTL</div>
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
                    Industry Sourcing (External Mill Procurement)
                  </h4>
                  <p className="text-[11px] text-[#777777]">
                    When the supplier buys from other suppliers/mills to load into the Keshar Kali brand
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
                    <span>+ Sourced Mill</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="excel-grid">
                  <thead>
                    <tr>
                      <th className="text-left">External Supplier / Mill</th>
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
                          <span className="font-semibold text-gray-700 block mb-0.5">Fulfilled directly from Own Mill Production</span>
                          <span>No external sourcing required. Click "+ Sourced Mill" only when buying stock from another supplier to load under Keshar Kali brand.</span>
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

            {/* Constituent Sub-Orders from Orders Webapp */}
            {poDetails.subOrders && poDetails.subOrders.length > 0 && (
              <div className="bg-white rounded-lg border border-[#E8E2DC] overflow-hidden shadow-xs">
                <div className="bg-[#FAF9F6] px-4 py-3 border-b border-[#E8E2DC] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Layers size={15} className="text-blue-700" />
                      Constituent Sub-Orders ({poDetails.subOrders.length})
                    </h4>
                    <p className="text-[11px] text-[#777777]">
                      Sub-orders grouped under master PO {poDetails.purchaseOrder.po_number}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="excel-grid">
                    <thead>
                      <tr>
                        <th className="text-left">Sub No</th>
                        <th className="text-left">Buyer / Consignee</th>
                        <th className="text-left">Product Variety</th>
                        <th className="text-right">Volume (QTL)</th>
                        <th className="text-right">Rate</th>
                        <th className="text-right">Amount</th>
                        <th className="text-center">Mill Bill & Document</th>
                        <th className="text-left">Destination</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poDetails.subOrders.map(sub => (
                        <tr key={sub.id || sub.sub_order_no || sub.subOrderNo} className="hover:bg-blue-50/20">
                          <td className="font-mono font-bold text-blue-700">{sub.sub_order_no || sub.subOrderNo}</td>
                          <td className="font-semibold text-gray-800">{sub.buyer_name || sub.buyerName}</td>
                          <td className="text-gray-600">{sub.product_name || sub.productName}</td>
                          <td className="text-right font-mono font-bold">{Number(sub.ordered_quantity || sub.orderedQuantity || 0).toFixed(2)}</td>
                          <td className="text-right font-mono">₹{Number(sub.rate || 0).toLocaleString('en-IN')}</td>
                          <td className="text-right font-mono font-bold text-[#8F1717]">₹{Number(sub.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              {sub.bill_no || sub.billNo ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold font-mono text-[11px]">
                                  #{sub.bill_no || sub.billNo}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic text-[10px]">No Bill #</span>
                              )}

                              {sub.bill_url || sub.billUrl ? (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBillPreviewModal({
                                        isOpen: true,
                                        billUrl: sub.bill_url || sub.billUrl,
                                        billNo: sub.bill_no || sub.billNo,
                                        fileName: sub.bill_file_name || sub.billFileName,
                                        subOrderNo: sub.sub_order_no || sub.subOrderNo,
                                        poNumber: poDetails.purchaseOrder.po_number,
                                        poId: poDetails.purchaseOrder.id
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-semibold transition-colors cursor-pointer"
                                    title="View / Download Bill Document"
                                  >
                                    {(sub.bill_file_name || sub.billFileName || '').endsWith('.pdf') ? (
                                      <FileText size={11} className="text-red-600" />
                                    ) : (
                                      <Image size={11} className="text-blue-600" />
                                    )}
                                    <span>View Bill</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openUploadModal(poDetails.purchaseOrder, sub)}
                                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
                                    title="Replace Bill Document"
                                  >
                                    <Upload size={11} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openUploadModal(poDetails.purchaseOrder, sub)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-[#8F1717] border border-amber-200 text-[10px] font-semibold transition-colors cursor-pointer shadow-2xs mt-0.5"
                                  title="Upload Mill Bill as PDF or Image"
                                >
                                  <Upload size={11} />
                                  <span>+ Upload Bill</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="text-[11px] text-gray-500">{sub.delivery_location || sub.deliveryLocation || '—'}</td>
                          <td className="text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                              {sub.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                          <span className="text-gray-400 font-mono text-[10px] ml-2">({formatDateDMY(l.loading_date)})</span>
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
                          <span className="text-gray-400 font-mono text-[10px] ml-2">({formatDateDMY(d.dispatch_date)})</span>
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
        title="Add External Industry Sourcing"
        subtitle="When the supplier buys from other suppliers/mills to load into the Keshar Kali brand"
      >
        <form onSubmit={handleAddAllocation} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#252525] mb-1">Select External Supplier (Rice Mill) *</label>
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
              <option value="">Select External Supplier / Rice Mill</option>
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

      {/* Sub-Order Mill Bill Upload Modal */}
      {billUploadModal.isOpen && (
        <Modal
          isOpen={true}
          onClose={() => !billUploadModal.isUploading && setBillUploadModal(prev => ({ ...prev, isOpen: false }))}
          title={`Upload Mill Bill — Sub PO ${billUploadModal.subOrderNo}`}
          subtitle={`Master PO: ${billUploadModal.poNumber} | Consignee: ${billUploadModal.buyerName}`}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSaveSubOrderBill} className="space-y-4 text-xs">
            <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200">
              <div className="text-[11px] text-amber-900 font-medium">
                Upload the official mill invoice/bill document for this individual sub-order. Supported formats: <strong>PDF</strong>, <strong>PNG</strong>, <strong>JPG</strong>, <strong>WEBP</strong> (Max 15MB).
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">
                Mill Bill / Invoice Number
              </label>
              <input
                type="text"
                placeholder="e.g. 131, 1300, 2450"
                value={billUploadModal.billNo}
                onChange={(e) => setBillUploadModal(prev => ({ ...prev, billNo: e.target.value }))}
                className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono font-bold text-gray-800 focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                Enter the bill number issued by the rice mill for this specific buyer's sub-order.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">
                Select Bill Document (PDF or Image) *
              </label>
              <div className="border-2 border-dashed border-[#E8E2DC] hover:border-[#8F1717] rounded-xl p-4 text-center bg-gray-50/50 transition-colors">
                <input
                  type="file"
                  id="subOrderBillFile"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleBillFileSelect}
                  className="hidden"
                />
                <label htmlFor="subOrderBillFile" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                  <Upload size={24} className="text-[#8F1717]" />
                  <div className="text-xs font-semibold text-gray-700">
                    {billUploadModal.fileName ? (
                      <span className="text-[#8F1717] font-bold">{billUploadModal.fileName}</span>
                    ) : (
                      <span>Click or Drag & Drop to select Bill File</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">PDF, PNG, JPG up to 15MB</span>
                </label>

                {billUploadModal.fileData && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-center gap-2">
                    {billUploadModal.mimeType.includes('pdf') ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded border border-red-200 text-xs font-mono font-bold">
                        <FileText size={14} />
                        <span>PDF Document Ready ({Math.round(billUploadModal.fileSize / 1024)} KB)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={billUploadModal.fileData}
                          alt="Preview"
                          className="max-h-36 max-w-full rounded border border-gray-300 object-contain shadow-2xs"
                        />
                        <span className="text-[10px] text-gray-500 font-mono">
                          Image Preview ({Math.round(billUploadModal.fileSize / 1024)} KB)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2DC] flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={billUploadModal.isUploading}
                onClick={() => setBillUploadModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={billUploadModal.isUploading || !billUploadModal.fileData}
                className="inline-flex items-center gap-1.5 px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {billUploadModal.isUploading ? (
                  <span>Uploading...</span>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Upload & Save Bill</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Sub-Order Mill Bill Preview Modal */}
      {billPreviewModal.isOpen && (
        <Modal
          isOpen={true}
          onClose={() => setBillPreviewModal(prev => ({ ...prev, isOpen: false }))}
          title={`Mill Bill — Sub PO ${billPreviewModal.subOrderNo}`}
          subtitle={`Master PO: ${billPreviewModal.poNumber} | Bill No: ${billPreviewModal.billNo || 'Not specified'}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            {/* Top Details Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {billPreviewModal.subOrderNo}
                </span>
                {billPreviewModal.billNo && (
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Bill #{billPreviewModal.billNo}
                  </span>
                )}
                <span className="text-gray-500 font-mono text-[11px] truncate max-w-[220px]">
                  {billPreviewModal.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={billPreviewModal.billUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 rounded transition-colors shadow-2xs"
                >
                  <ExternalLink size={12} />
                  <span>Open in New Tab</span>
                </a>
                <a
                  href={billPreviewModal.billUrl}
                  download={billPreviewModal.fileName || `Bill_${billPreviewModal.subOrderNo}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 rounded transition-colors shadow-2xs"
                >
                  <Download size={12} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteSubOrderBill(billPreviewModal.poId, billPreviewModal.subOrderNo)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 rounded transition-colors shadow-2xs cursor-pointer"
                  title="Delete this bill document"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Viewer Box */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center p-2 min-h-[450px]">
              {billPreviewModal.billUrl?.endsWith('.pdf') ? (
                <iframe
                  src={billPreviewModal.billUrl}
                  className="w-full h-[600px] rounded border border-gray-200 bg-white"
                  title="Bill PDF Viewer"
                />
              ) : (
                <img
                  src={billPreviewModal.billUrl}
                  alt="Mill Bill Document"
                  className="max-h-[600px] max-w-full rounded object-contain shadow-xs bg-white"
                />
              )}
            </div>

            <div className="pt-2 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setBillPreviewModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-1.5 font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

