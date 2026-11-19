// src/pages/MasterLoadingRegister.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Download, 
  Printer, 
  Plus, 
  Filter, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Building2,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import ExcelGrid from '../components/ExcelGrid';
import Modal from '../components/Modal';
import { api, downloadBlob } from '../api';
import { formatDateDMY } from '../utils/date';
import { useNotification } from '../context/NotificationContext';

export default function MasterLoadingRegister({ onOpenQuickAction, quickActionTrigger }) {
  const { showToast, confirm } = useNotification();
  const [loadingEntries, setLoadingEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [productId, setProductId] = useState('');
  const [loadingStatus, setLoadingStatus] = useState('');
  const [dispatchStatus, setDispatchStatus] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [search, setSearch] = useState('');

  // Pending sub-orders across all active purchase orders
  const pendingSubOrders = useMemo(() => {
    const list = [];
    for (const po of purchaseOrders) {
      if (po.status === 'Completed' || po.status === 'Cancelled') continue;
      const subs = po.sub_orders || [];
      if (subs.length > 0) {
        for (const s of subs) {
          const ordQty = Number(s.ordered_quantity || s.orderedQuantity || 0);
          const ldQty = Number(s.loaded_quantity || s.loadedQuantity || 0);
          const remQty = Math.max(0, ordQty - ldQty);
          if (remQty > 0.001) {
            list.push({
              key: `${po.id}-${s.sub_order_no || s.subOrderNo || s.id}`,
              po_id: po.id,
              po_number: po.po_number,
              po_date: po.po_date,
              sub_order_no: s.sub_order_no || s.subOrderNo,
              sub_order_id: s.id,
              buyer_name: s.buyer_name || s.buyerName || po.customer_name,
              product_name: s.product_name || s.productName || po.product_name,
              product_id: po.product_id,
              delivery_location: s.delivery_location || s.deliveryLocation || po.delivery_location || 'Commercial Market',
              ordered_quantity: ordQty,
              loaded_quantity: ldQty,
              pending_quantity: remQty,
              rate: Number(s.rate || po.customer_selling_rate || 2800)
            });
          }
        }
      } else {
        const ordQty = Number(po.ordered_quantity || 0);
        const ldQty = Number(po.loaded_quantity || 0);
        const remQty = Math.max(0, ordQty - ldQty);
        if (remQty > 0.001) {
          list.push({
            key: `po-${po.id}`,
            po_id: po.id,
            po_number: po.po_number,
            po_date: po.po_date,
            sub_order_no: po.sub_order_no || 'Direct PO',
            sub_order_id: null,
            buyer_name: po.customer_name,
            product_name: po.product_name,
            product_id: po.product_id,
            delivery_location: po.delivery_location || 'Commercial Market',
            ordered_quantity: ordQty,
            loaded_quantity: ldQty,
            pending_quantity: remQty,
            rate: Number(po.customer_selling_rate || 2800)
          });
        }
      }
    }
    return list;
  }, [purchaseOrders]);

  // Selection in the Pending Sub-Orders list on page
  const [selectedSubKeys, setSelectedSubKeys] = useState(new Set());
  const [pendingPanelOpen, setPendingPanelOpen] = useState(true);
  const [pendingFilter, setPendingFilter] = useState('');

  const filteredPendingSubOrders = useMemo(() => {
    if (!pendingFilter.trim()) return pendingSubOrders;
    const term = pendingFilter.toLowerCase();
    return pendingSubOrders.filter(s =>
      s.po_number?.toLowerCase().includes(term) ||
      s.sub_order_no?.toLowerCase().includes(term) ||
      s.buyer_name?.toLowerCase().includes(term) ||
      s.product_name?.toLowerCase().includes(term) ||
      s.delivery_location?.toLowerCase().includes(term)
    );
  }, [pendingSubOrders, pendingFilter]);

  // Add / Bulk Loading Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [truckForm, setTruckForm] = useState({
    industry_id: '',
    loading_date: new Date().toISOString().split('T')[0],
    fulfillment_type: 'Direct',
    warehouse_id: '',
    loading_location: 'Mill Facility',
    vehicle_number: '',
    driver_phone: '',
    remarks: ''
  });
  const [manifestItems, setManifestItems] = useState([]);

  const totalTruckQuantity = useMemo(() => {
    return manifestItems.reduce((sum, item) => sum + (Number(item.loading_quantity) || 0), 0);
  }, [manifestItems]);

  const totalTruckAmount = useMemo(() => {
    return manifestItems.reduce((sum, item) => sum + ((Number(item.loading_quantity) || 0) * (Number(item.purchase_rate) || 0)), 0);
  }, [manifestItems]);

  useEffect(() => {
    if (quickActionTrigger?.action === 'loading') {
      const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
      setTruckForm(prev => ({
        ...prev,
        industry_id: prev.industry_id || (defaultInd ? defaultInd.id : '')
      }));

      if (quickActionTrigger.poId) {
        const poId = Number(quickActionTrigger.poId);
        const subNo = quickActionTrigger.subOrderNo || '';
        const matchingSub = pendingSubOrders.find(s => s.po_id === poId && (!subNo || s.sub_order_no === subNo));

        if (matchingSub) {
          setManifestItems([{
            ...matchingSub,
            loading_quantity: matchingSub.pending_quantity.toFixed(2),
            purchase_rate: defaultInd?.default_purchase_rate || matchingSub.rate || 2800
          }]);
        } else {
          const po = purchaseOrders.find(p => p.id === poId);
          if (po) {
            const sub = po.sub_orders?.find(s => (s.sub_order_no || s.subOrderNo) === subNo);
            const ordQty = Number(sub ? (sub.ordered_quantity || sub.orderedQuantity) : po.ordered_quantity);
            const ldQty = Number(sub ? (sub.loaded_quantity || sub.loadedQuantity || 0) : (po.loaded_quantity || 0));
            const remQty = Math.max(0, ordQty - ldQty);
            setManifestItems([{
              key: `${po.id}-${subNo || 'direct'}`,
              po_id: po.id,
              po_number: po.po_number,
              po_date: po.po_date,
              sub_order_no: subNo || po.sub_order_no || 'Direct PO',
              sub_order_id: sub?.id || null,
              buyer_name: sub?.buyer_name || sub?.buyerName || po.customer_name,
              product_name: sub?.product_name || sub?.productName || po.product_name,
              product_id: po.product_id,
              delivery_location: sub?.delivery_location || sub?.deliveryLocation || po.delivery_location || 'Commercial Market',
              ordered_quantity: ordQty,
              loaded_quantity: ldQty,
              pending_quantity: remQty,
              loading_quantity: remQty > 0 ? remQty.toFixed(2) : ordQty.toFixed(2),
              purchase_rate: defaultInd?.default_purchase_rate || po.customer_selling_rate || 2800
            }]);
          }
        }
      }
      setIsAddOpen(true);
    }
  }, [quickActionTrigger, pendingSubOrders, purchaseOrders, industries]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesRes, summaryRes, custRes, indRes, poRes, prodRes, whRes] = await Promise.all([
        api.loadingRegister.getAll({
          startDate,
          endDate,
          buyerId,
          industryId,
          productId,
          vehicleNumber: vehicleSearch,
          loadingStatus,
          dispatchStatus,
          search
        }),
        api.loadingRegister.getSummary(),
        api.customers.getAll(),
        api.industries.getAll(),
        api.purchaseOrders.getAll(),
        api.products.getAll(),
        api.warehouses.getAll()
      ]);

      setLoadingEntries(entriesRes.loadingEntries || []);
      setSummary(summaryRes);
      setCustomers(custRes.customers || []);
      setIndustries(indRes.industries || []);
      setPurchaseOrders(poRes.purchaseOrders || []);
      setProducts(prodRes.products || []);
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
    }, 200);
    return () => clearTimeout(timer);
  }, [startDate, endDate, buyerId, industryId, productId, loadingStatus, dispatchStatus, vehicleSearch, search]);

  const hasActiveFilters = Boolean(
    startDate || endDate || buyerId || industryId || productId || loadingStatus || dispatchStatus || vehicleSearch.trim() || search.trim()
  );

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setBuyerId('');
    setIndustryId('');
    setProductId('');
    setLoadingStatus('');
    setDispatchStatus('');
    setVehicleSearch('');
    setSearch('');
  };

  // Immediate reactive client-side filtering for instantaneous table updates
  const filteredLoadingEntries = useMemo(() => {
    return loadingEntries.filter(row => {
      if (startDate && row.loading_date < startDate) return false;
      if (endDate && row.loading_date > endDate) return false;
      if (buyerId && String(row.customer_id) !== String(buyerId)) {
        const cust = customers.find(c => String(c.id) === String(buyerId));
        if (!cust || (row.sub_buyer_name !== cust.name && row.customer_name !== cust.name)) {
          return false;
        }
      }
      if (industryId && String(row.industry_id) !== String(industryId)) return false;
      if (productId && String(row.product_id) !== String(productId)) return false;
      if (loadingStatus && row.loading_status !== loadingStatus) return false;
      if (dispatchStatus && row.dispatch_status !== dispatchStatus) return false;
      if (vehicleSearch.trim() && !row.vehicle_number?.toLowerCase().includes(vehicleSearch.trim().toLowerCase())) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match = (
          row.loading_number?.toLowerCase().includes(q) ||
          row.po_number?.toLowerCase().includes(q) ||
          row.sub_order_no?.toLowerCase().includes(q) ||
          row.customer_name?.toLowerCase().includes(q) ||
          row.sub_buyer_name?.toLowerCase().includes(q) ||
          row.product_name?.toLowerCase().includes(q) ||
          row.industry_name?.toLowerCase().includes(q) ||
          row.vehicle_number?.toLowerCase().includes(q) ||
          row.loading_location?.toLowerCase().includes(q) ||
          row.remarks?.toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      return true;
    });
  }, [loadingEntries, startDate, endDate, buyerId, industryId, productId, loadingStatus, dispatchStatus, vehicleSearch, search, customers]);

  const handleCellChange = async (rowId, key, value, fullRow) => {
    try {
      await api.loadingRegister.updateCell(rowId, { [key]: value });
      // Update local state without full reload for instant Excel responsiveness
      setLoadingEntries(prev => prev.map(r => r.id === rowId ? { ...r, [key]: value } : r));
      showToast('Cell saved successfully', 'success', 2000);
    } catch (err) {
      showToast(`Failed to save cell: ${err.message}`, 'error');
    }
  };

  const handleBulkPaste = async (pastedRows, startRow, startCol) => {
    try {
      // Allow pasting vehicle numbers, locations, or remarks into existing rows
      const updatedRows = [];
      pastedRows.forEach((pRow, rOffset) => {
        const targetRowIdx = startRow + rOffset;
        if (targetRowIdx < loadingEntries.length) {
          const row = loadingEntries[targetRowIdx];
          const updated = { id: row.id };
          if (pRow[0]) updated.vehicle_number = pRow[0];
          if (pRow[1]) updated.loading_location = pRow[1];
          if (pRow[2]) updated.remarks = pRow[2];
          updatedRows.push(updated);
        }
      });

      if (updatedRows.length > 0) {
        await api.loadingRegister.bulkSave(updatedRows);
        showToast(`Bulk updated ${updatedRows.length} rows successfully`, 'success');
        loadData();
      }
    } catch (err) {
      showToast(`Bulk paste failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteRow = async (id, loadingNumber) => {
    const ok = await confirm({
      title: 'Delete Loading Entry',
      message: `Are you sure you want to delete loading entry ${loadingNumber}? Associated inward inventory movements will be reversed.`,
      confirmText: 'Delete Loading Entry',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.loadingRegister.delete(id);
      showToast(`Loading entry ${loadingNumber} deleted and stock reversed.`, 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleSelectSub = (subKey) => {
    setSelectedSubKeys(prev => {
      const next = new Set(prev);
      if (next.has(subKey)) {
        next.delete(subKey);
      } else {
        next.add(subKey);
      }
      return next;
    });
  };

  const handleToggleSelectAllPending = () => {
    if (filteredPendingSubOrders.length === 0) return;
    const allSelected = filteredPendingSubOrders.every(s => selectedSubKeys.has(s.key));
    if (allSelected) {
      setSelectedSubKeys(new Set());
    } else {
      setSelectedSubKeys(new Set(filteredPendingSubOrders.map(s => s.key)));
    }
  };

  const handleOpenBulkLoadingWithSelected = () => {
    const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
    const items = pendingSubOrders
      .filter(s => selectedSubKeys.has(s.key))
      .map(s => ({
        ...s,
        loading_quantity: s.pending_quantity.toFixed(2),
        purchase_rate: defaultInd?.default_purchase_rate || s.rate || 2800
      }));

    if (items.length === 0) {
      showToast('Please select at least one sub-order for bulk loading.', 'warning');
      return;
    }

    setTruckForm({
      industry_id: defaultInd ? defaultInd.id : '',
      loading_date: new Date().toISOString().split('T')[0],
      fulfillment_type: 'Direct',
      warehouse_id: '',
      loading_location: items[0]?.delivery_location || 'Mill Facility',
      vehicle_number: '',
      driver_phone: '',
      remarks: ''
    });
    setManifestItems(items);
    setIsAddOpen(true);
  };

  const handleOpenLoadForSingleSub = (sub) => {
    const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
    setTruckForm({
      industry_id: defaultInd ? defaultInd.id : '',
      loading_date: new Date().toISOString().split('T')[0],
      fulfillment_type: 'Direct',
      warehouse_id: '',
      loading_location: sub.delivery_location || 'Mill Facility',
      vehicle_number: '',
      driver_phone: '',
      remarks: ''
    });
    setManifestItems([{
      ...sub,
      loading_quantity: sub.pending_quantity.toFixed(2),
      purchase_rate: defaultInd?.default_purchase_rate || sub.rate || 2800
    }]);
    setIsAddOpen(true);
  };

  const handleOpenNewLoadingModal = () => {
    const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
    setTruckForm({
      industry_id: defaultInd ? defaultInd.id : '',
      loading_date: new Date().toISOString().split('T')[0],
      fulfillment_type: 'Direct',
      warehouse_id: '',
      loading_location: 'Mill Facility',
      vehicle_number: '',
      driver_phone: '',
      remarks: ''
    });
    setManifestItems([]);
    setIsAddOpen(true);
  };

  const handleAddSubToManifest = (subKey) => {
    if (!subKey) return;
    const sub = pendingSubOrders.find(s => s.key === subKey);
    if (!sub) return;
    if (manifestItems.some(m => m.key === subKey)) return;

    const defaultInd = industries.find(i => String(i.id) === String(truckForm.industry_id)) || industries[0];
    const isOwn = defaultInd?.is_default === 1 || defaultInd?.name?.toLowerCase().includes('bhagwathi');
    setManifestItems(prev => [
      ...prev,
      {
        ...sub,
        loading_quantity: sub.pending_quantity.toFixed(2),
        purchase_rate: isOwn ? 0 : (defaultInd?.default_purchase_rate || sub.rate || 2800)
      }
    ]);
  };

  const handleRemoveSubFromManifest = (key) => {
    setManifestItems(prev => prev.filter(m => m.key !== key));
  };

  const handleUpdateManifestItemQty = (key, val) => {
    setManifestItems(prev => prev.map(m => m.key === key ? { ...m, loading_quantity: val } : m));
  };

  const handleUpdateManifestItemRate = (key, val) => {
    setManifestItems(prev => prev.map(m => m.key === key ? { ...m, purchase_rate: val } : m));
  };

  const handleCreateLoading = async (e) => {
    e.preventDefault();
    if (manifestItems.length === 0) {
      showToast('Please add at least one sub-order to the truck loading manifest.', 'warning');
      return;
    }

    if (!truckForm.vehicle_number.trim()) {
      showToast('Please enter a valid Truck / Vehicle Number.', 'warning');
      return;
    }

    if (!truckForm.industry_id) {
      showToast('Please select a Sourcing Rice Mill / Industry.', 'warning');
      return;
    }

    if (truckForm.fulfillment_type === 'Warehouse' && !truckForm.warehouse_id) {
      showToast('Please select a Destination Mill Facility for inward.', 'warning');
      return;
    }

    // Validate quantities
    for (const item of manifestItems) {
      const q = Number(item.loading_quantity);
      if (!q || q <= 0) {
        showToast(`Invalid loading quantity for Sub-Order ${item.sub_order_no} (${item.buyer_name}). Must be greater than 0.`, 'warning');
        return;
      }
      if (q > item.pending_quantity) {
        showToast(`Overload prevented: Sub-Order ${item.sub_order_no} (${item.buyer_name}) has only ${item.pending_quantity.toFixed(2)} QTL pending. Cannot load ${q} QTL.`, 'error');
        return;
      }
    }

    try {
      await api.loadingRegister.create({
        industry_id: truckForm.industry_id,
        loading_date: truckForm.loading_date,
        fulfillment_type: truckForm.fulfillment_type,
        warehouse_id: truckForm.fulfillment_type === 'Warehouse' ? truckForm.warehouse_id : null,
        loading_location: truckForm.loading_location,
        vehicle_number: truckForm.vehicle_number.toUpperCase().trim(),
        driver_phone: truckForm.driver_phone,
        remarks: truckForm.remarks,
        items: manifestItems.map(item => ({
          po_id: item.po_id,
          sub_order_no: item.sub_order_no,
          sub_order_id: item.sub_order_id,
          product_id: item.product_id,
          loading_quantity: Number(item.loading_quantity),
          purchase_rate: Number(item.purchase_rate),
          loading_location: item.delivery_location || truckForm.loading_location
        }))
      });

      setIsAddOpen(false);
      setSelectedSubKeys(new Set());
      setManifestItems([]);
      loadData();
      showToast(`Truck loading recorded successfully! ${manifestItems.length} sub-order(s) loaded on vehicle ${truckForm.vehicle_number.toUpperCase().trim()}.`, 'success');
    } catch (err) {
      showToast(`Loading entry failed: ${err.message}`, 'error');
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await api.reports.exportMasterLoading({
        startDate,
        endDate,
        buyerId,
        industryId
      });
      downloadBlob(blob, `Keshar_Kali_Master_Loading_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Master Loading Register exported to Excel successfully!', 'success');
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Define columns for Excel-style Grid
  const columns = [
    { key: 'loading_number', label: 'Loading ID', width: '110px' },
    { key: 'loading_date', label: 'Date', width: '100px', align: 'center', render: (val) => <span className="tabular-nums text-xs">{formatDateDMY(val)}</span> },
    { key: 'po_number', label: 'PO #', width: '105px' },
    { 
      key: 'sub_order_no', 
      label: 'Sub-PO #', 
      width: '105px', 
      align: 'center',
      render: (val) => val ? (
        <span className="tabular-nums text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {val}
        </span>
      ) : (
        <span className="text-gray-400 text-[10px]">—</span>
      )
    },
    { 
      key: 'customer_name', 
      label: 'Buyer / Consignee', 
      width: '160px',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{row.sub_buyer_name || val}</span>
          {row.sub_order_no && row.sub_buyer_name && row.sub_buyer_name !== val && (
            <span className="text-[10px] text-gray-500 block">Lead PO: {val}</span>
          )}
        </div>
      )
    },
    { key: 'product_name', label: 'Rice Product', width: '130px' },
    { 
      key: 'industry_name', 
      label: 'Sourcing Source', 
      width: '200px',
      render: (val, row) => {
        const isOwn = row.is_default_partner === 1 || val?.toLowerCase().includes('bhagwathi');
        return (
          <div>
            <span className="font-semibold text-gray-900 block leading-tight">{val || '—'}</span>
            <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-bold ${
              isOwn 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}>
              {isOwn ? '✓ Own Mill Production' : '⚡ Industry Sourced (Other Supplier)'}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'fulfillment_type', 
      label: 'Fulfillment', 
      width: '105px', 
      align: 'center',
      render: (val) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${val === 'Warehouse' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
          {val}
        </span>
      )
    },
    { 
      key: 'vehicle_number', 
      label: 'Vehicle Number', 
      width: '130px', 
      align: 'center',
      editable: true,
      render: (val) => <span className="tabular-nums font-semibold text-[#8F1717]">{val}</span>
    },
    { 
      key: 'loading_quantity', 
      label: 'Loading QTL', 
      width: '105px', 
      align: 'right',
      render: (val) => <span className="tabular-nums font-bold">{Number(val).toFixed(2)}</span>
    },
    { 
      key: 'purchase_rate', 
      label: 'Purchase Rate', 
      width: '115px', 
      align: 'right',
      render: (val) => <span className="tabular-nums">₹{Number(val).toFixed(2)}</span>
    },
    { 
      key: 'loading_amount', 
      label: 'Loading Amount', 
      width: '125px', 
      align: 'right',
      render: (val) => <span className="tabular-nums font-bold text-gray-800">₹{Number(val).toLocaleString('en-IN')}</span>
    },
    { 
      key: 'dispatch_status', 
      label: 'Status', 
      width: '110px', 
      align: 'center',
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
          Dispatched
        </span>
      )
    },
    { 
      key: 'loading_location', 
      label: 'Loading Location', 
      width: '140px',
      editable: true 
    },
    { 
      key: 'remarks', 
      label: 'Remarks', 
      width: '160px',
      editable: true 
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '70px',
      align: 'center',
      render: (_, row) => (
        <button
          onClick={() => handleDeleteRow(row.id, row.loading_number)}
          className="p-1 text-red-400 hover:text-red-700 rounded hover:bg-red-50"
          title="Delete loading entry and reverse stock"
        >
          <Trash2 size={13} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Flagship Header & Action Toolbar */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E2DC]">
          <div>
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Truck size={18} className="text-[#8F1717]" />
              Master Loading Register
            </h1>
            <p className="text-xs text-[#777777]">
              The authoritative daily operational grid — fast keyboard navigation, multi-row Excel paste, and auto-save
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenNewLoadingModal}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
            >
              <Plus size={14} />
              <span>Record Loading Entry</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded transition-colors shadow-xs"
            >
              <FileSpreadsheet size={14} />
              <span>Excel Export (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-[#252525] px-3 py-1.5 rounded transition-colors shadow-xs no-print"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Compact Totals Strip Above Grid */}
        {summary && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Today's Loading</div>
              <div className="text-sm font-bold tabular-nums text-[#8F1717]">{summary.todayLoading.qtl} QTL</div>
              <div className="text-[10px] text-gray-400">{summary.todayLoading.count} trucks loaded today</div>
            </div>

            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Total Loaded to Date</div>
              <div className="text-sm font-bold tabular-nums text-[#252525]">{summary.totalLoading.qtl} QTL</div>
              <div className="text-[10px] text-gray-400">₹{summary.totalLoading.amount.toLocaleString('en-IN')}</div>
            </div>

            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Pending Mill Loading</div>
              <div className="text-sm font-bold tabular-nums text-amber-700">{summary.pendingLoading.qtl} QTL</div>
              <div className="text-[10px] text-amber-600">Awaiting mill bagging/trucks</div>
            </div>

            <div className="bg-[#FAF9F6] p-2.5 rounded border border-[#E8E2DC] text-center sm:text-left">
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Today's Loaded & Dispatched</div>
              <div className="text-sm font-bold tabular-nums text-emerald-700">{summary.todayDispatch?.qtl || summary.todayLoading?.qtl} QTL</div>
              <div className="text-[10px] text-emerald-600">{summary.todayLoading?.count || 0} truck(s) dispatched</div>
            </div>
          </div>
        )}

        {/* Dense Filters Toolbar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E8E2DC] pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Filter size={13} className="text-[#8F1717]" /> Filters:
            </span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8F1717]/10 text-[#8F1717] border border-[#8F1717]/20">
                Filtered ({filteredLoadingEntries.length} of {loadingEntries.length})
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

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search Vehicle, Loading#, Sub-PO, Buyer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <select
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Buyers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={industryId}
            onChange={(e) => setIndustryId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Rice Mills (Internal)</option>
            {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>

          <input
            type="text"
            placeholder="Filter Vehicle No..."
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-xs"
          />

          <div className="flex items-center gap-1">
            <input
              type="date"
              title="From Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-[11px]"
            />
            <input
              type="date"
              title="To Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none text-[11px]"
            />
          </div>

          <div className="flex items-center">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full flex items-center justify-center gap-1 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded text-xs transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            ) : (
              <div className="text-[11px] text-gray-400 italic px-2">
                All records active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Sub-Orders Awaiting Truck Loading (Bulk & Multi-PO Selector) */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="p-3 bg-gradient-to-r from-[#FAF9F6] to-white border-b border-[#E8E2DC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-red-50 text-[#8F1717] border border-red-100">
              <Layers size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-[#252525] font-['Space_Grotesk'] uppercase tracking-wider">
                  Sub-Orders Awaiting Truck Loading
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8F1717] text-white">
                  {pendingSubOrders.length} Pending
                </span>
                {selectedSubKeys.size > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {selectedSubKeys.size} Selected for Truck
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#777777]">
                Select single or multiple sub-orders across different POs to combine into a single bulk truck loading manifest
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingSubOrders.length > 0 && (
              <>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter sub-orders..."
                    value={pendingFilter}
                    onChange={(e) => setPendingFilter(e.target.value)}
                    className="pl-7 pr-2.5 py-1 text-xs bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none w-44"
                  />
                  {pendingFilter && (
                    <button
                      type="button"
                      onClick={() => setPendingFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px]"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenBulkLoadingWithSelected}
                  disabled={selectedSubKeys.size === 0}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-all shadow-xs ${
                    selectedSubKeys.size > 0
                      ? 'bg-[#8F1717] hover:bg-[#771212] text-white cursor-pointer ring-2 ring-red-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  }`}
                  title={selectedSubKeys.size === 0 ? 'Select checkboxes below to create a bulk truck loading' : 'Load selected sub-orders together'}
                >
                  <Truck size={13} />
                  <span>Create Bulk Truck Loading ({selectedSubKeys.size})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setPendingPanelOpen(prev => !prev)}
              className="p-1 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100"
              title={pendingPanelOpen ? 'Collapse panel' : 'Expand panel'}
            >
              {pendingPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {pendingPanelOpen && (
          <div>
            {filteredPendingSubOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 bg-[#FAF9F6]/50">
                {pendingSubOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 size={24} className="text-emerald-600 mb-1" />
                    <span className="font-semibold text-gray-700">All Purchase Orders & Sub-Orders are fully loaded!</span>
                    <span className="text-[11px] text-gray-400">No pending shipments awaiting mill trucks. New orders will appear here automatically.</span>
                  </div>
                ) : (
                  <span>No sub-orders match filter "{pendingFilter}"</span>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[#FAF9F6] text-[#777777] font-semibold uppercase text-[10px] tracking-wider border-b border-[#E8E2DC] sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 text-center w-10">
                        <input
                          type="checkbox"
                          checked={filteredPendingSubOrders.length > 0 && filteredPendingSubOrders.every(s => selectedSubKeys.has(s.key))}
                          onChange={handleToggleSelectAllPending}
                          className="rounded border-gray-300 text-[#8F1717] focus:ring-[#8F1717] cursor-pointer"
                          title="Select all"
                        />
                      </th>
                      <th className="p-2.5">Sub-PO #</th>
                      <th className="p-2.5">Lead PO #</th>
                      <th className="p-2.5">Buyer / Consignee</th>
                      <th className="p-2.5">Rice Product</th>
                      <th className="p-2.5">Delivery Destination</th>
                      <th className="p-2.5 text-right">Ordered</th>
                      <th className="p-2.5 text-right">Loaded</th>
                      <th className="p-2.5 text-right text-[#8F1717]">Pending (QTL)</th>
                      <th className="p-2.5 text-center w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DC]">
                    {filteredPendingSubOrders.map((sub) => {
                      const isSelected = selectedSubKeys.has(sub.key);
                      return (
                        <tr
                          key={sub.key}
                          className={`hover:bg-[#FAF9F6] transition-colors ${isSelected ? 'bg-amber-50/60 font-medium' : ''}`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectSub(sub.key)}
                              className="rounded border-gray-300 text-[#8F1717] focus:ring-[#8F1717] cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 font-mono font-bold text-blue-700">
                            <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {sub.sub_order_no}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-gray-700">
                            {sub.po_number}
                            <span className="text-[10px] text-gray-400 block">{formatDateDMY(sub.po_date)}</span>
                          </td>
                          <td className="p-2.5 font-semibold text-gray-900">
                            {sub.buyer_name}
                          </td>
                          <td className="p-2.5 text-gray-800">
                            {sub.product_name}
                          </td>
                          <td className="p-2.5 text-gray-600">
                            {sub.delivery_location || '—'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-gray-600">
                            {sub.ordered_quantity.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-gray-500">
                            {sub.loaded_quantity.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-[#8F1717]">
                            {sub.pending_quantity.toFixed(2)} QTL
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenLoadForSingleSub(sub)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-red-50 text-[#8F1717] border border-red-200 hover:border-[#8F1717] rounded shadow-2xs transition-colors"
                            >
                              + Load Truck
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flagship Excel Interactive Data Grid */}
      <ExcelGrid
        columns={columns}
        data={filteredLoadingEntries}
        onCellChange={handleCellChange}
        onBulkPaste={handleBulkPaste}
      />

      {/* Record Master Loading Modal / Bulk Multi-PO Truck Manifest */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Record Master Loading Entry"
        subtitle="Confirm physical truck loading at rice mill (multi-PO bulk loading supported)"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleCreateLoading} className="space-y-4 text-xs">
          {/* Truck Logistics Header */}
          <div className="bg-[#FAF9F6] p-3.5 rounded-lg border border-[#E8E2DC] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8F1717] uppercase tracking-wide">
              <Truck size={14} />
              <span>Truck Logistics & Mill Sourcing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#252525] mb-1">Sourcing Mill / Supplier *</label>
                <select
                  required
                  value={truckForm.industry_id}
                  onChange={(e) => {
                    const indId = e.target.value;
                    const ind = industries.find(i => String(i.id) === String(indId));
                    const isOwn = ind?.is_default === 1 || ind?.name?.toLowerCase().includes('bhagwathi');
                    setTruckForm(prev => ({
                      ...prev,
                      industry_id: indId,
                      loading_location: ind?.location || prev.loading_location
                    }));
                    // If own mill, purchase rate is 0 (own stock). If external supplier, use default rate
                    setManifestItems(prev => prev.map(m => ({
                      ...m,
                      purchase_rate: isOwn ? 0 : (ind?.default_purchase_rate || m.purchase_rate || 2800)
                    })));
                  }}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                >
                  <option value="">Select Sourcing Mill / Supplier</option>
                  {industries.map(ind => {
                    const isOwn = ind.is_default === 1 || ind.name?.toLowerCase().includes('bhagwathi');
                    return (
                      <option key={ind.id} value={ind.id}>
                        {isOwn ? `[Own Mill] ${ind.name}` : `[External Sourced] ${ind.name} (${ind.location})`}
                      </option>
                    );
                  })}
                </select>

                {(() => {
                  const selInd = industries.find(i => String(i.id) === String(truckForm.industry_id));
                  if (!selInd) return null;
                  const isOwn = selInd.is_default === 1 || selInd.name?.toLowerCase().includes('bhagwathi');
                  return (
                    <div className={`mt-1.5 p-1.5 rounded text-[11px] leading-tight border ${
                      isOwn ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}>
                      {isOwn ? (
                        <span><strong className="font-semibold">✓ Own Mill Production:</strong> Direct loading from supplier's own mill stock into Keshar Kali brand.</span>
                      ) : (
                        <span><strong className="font-semibold">⚡ Industry Sourcing:</strong> Supplier buying from this other supplier/mill to load in Keshar Kali brand.</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Loading Date *</label>
                <input
                  type="date"
                  required
                  value={truckForm.loading_date}
                  onChange={(e) => setTruckForm({ ...truckForm, loading_date: e.target.value })}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Fulfillment Workflow *</label>
                <select
                  required
                  value={truckForm.fulfillment_type}
                  onChange={(e) => setTruckForm({ ...truckForm, fulfillment_type: e.target.value })}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                >
                  <option value="Direct">Direct Dispatch (Mill straight to Buyer)</option>
                  <option value="Warehouse">Mill Inward / Inter-Mill Movement</option>
                </select>
              </div>

              {truckForm.fulfillment_type === 'Warehouse' && (
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Destination Mill Facility *</label>
                  <select
                    required
                    value={truckForm.warehouse_id}
                    onChange={(e) => setTruckForm({ ...truckForm, warehouse_id: e.target.value })}
                    className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                  >
                    <option value="">Select Destination Mill</option>
                    {industries.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.location})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Truck / Vehicle Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-31-AA-4412"
                  value={truckForm.vehicle_number}
                  onChange={(e) => setTruckForm({ ...truckForm, vehicle_number: e.target.value })}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Driver Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98220 12345"
                  value={truckForm.driver_phone}
                  onChange={(e) => setTruckForm({ ...truckForm, driver_phone: e.target.value })}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Loading Location / Mandi Gate</label>
                <input
                  type="text"
                  placeholder="e.g. Balaji Mill Yard, Bhandara Gate 2"
                  value={truckForm.loading_location}
                  onChange={(e) => setTruckForm({ ...truckForm, loading_location: e.target.value })}
                  className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Truck Loading Manifest (Sub-Orders from Single or Multiple POs) */}
          <div className="bg-white rounded-lg border border-[#E8E2DC] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2DC] pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#252525] uppercase tracking-wide flex items-center gap-1.5">
                    <Layers size={14} className="text-[#8F1717]" />
                    Truck Loading Manifest (Sub-Orders)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {manifestItems.length} Sub-Order{manifestItems.length !== 1 ? 's' : ''} on Truck
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  You can combine sub-orders from multiple different customer POs onto this single truck
                </p>
              </div>

              {/* Add Sub-Order Selector */}
              <div className="flex items-center gap-1.5">
                <select
                  value=""
                  onChange={(e) => {
                    handleAddSubToManifest(e.target.value);
                  }}
                  className="p-1.5 bg-[#FAF9F6] border border-[#8F1717] rounded text-xs font-semibold text-[#8F1717] focus:ring-1 focus:ring-[#8F1717] focus:outline-none cursor-pointer max-w-xs"
                >
                  <option value="">+ Add Sub-Order from any PO...</option>
                  {pendingSubOrders
                    .filter(s => !manifestItems.some(m => m.key === s.key))
                    .map(s => (
                      <option key={s.key} value={s.key}>
                        {s.sub_order_no} | {s.po_number} — {s.buyer_name} ({s.product_name}, {s.pending_quantity.toFixed(2)} QTL pend)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {manifestItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 border border-dashed border-[#E8E2DC] rounded-lg bg-[#FAF9F6]">
                <p className="font-semibold text-gray-700 mb-1">No Sub-Orders Added to this Truck Manifest Yet</p>
                <p className="text-[11px] text-gray-400">
                  Select a sub-order from the dropdown above to add it to this truck loading trip.
                </p>
              </div>
            ) : (() => {
              const currentInd = industries.find(i => String(i.id) === String(truckForm.industry_id));
              const isCurrentIndOwn = currentInd?.is_default === 1 || currentInd?.name?.toLowerCase().includes('bhagwathi');

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#FAF9F6] text-[#777777] font-semibold uppercase text-[10px] tracking-wider border-b border-[#E8E2DC]">
                      <tr>
                        <th className="p-2">Sub-PO #</th>
                        <th className="p-2">Lead PO #</th>
                        <th className="p-2">Buyer / Consignee</th>
                        <th className="p-2">Product Variety</th>
                        <th className="p-2 text-right">Pending</th>
                        <th className="p-2 text-right w-28 text-[#8F1717]">Loading QTL *</th>
                        <th className="p-2 text-right w-32">
                          {isCurrentIndOwn ? 'Sourcing Rate' : 'Purchase Rate (₹) *'}
                          <span className="block text-[9px] font-normal normal-case text-gray-400">
                            {isCurrentIndOwn ? 'Own Mill (₹0)' : 'Paid to Supplier'}
                          </span>
                        </th>
                        <th className="p-2 text-right">
                          {isCurrentIndOwn ? 'Cost' : 'Subtotal (₹)'}
                        </th>
                        <th className="p-2 text-center w-10">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2DC]">
                      {manifestItems.map((item) => {
                        const loadQty = Number(item.loading_quantity) || 0;
                        const rate = Number(item.purchase_rate) || 0;
                        const subtotal = loadQty * rate;
                        const isOverload = loadQty > item.pending_quantity;

                        return (
                          <tr key={item.key} className="hover:bg-[#FAF9F6]/50">
                            <td className="p-2 font-mono font-bold text-blue-700">
                              <span className="bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {item.sub_order_no}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-gray-700">
                              {item.po_number}
                            </td>
                            <td className="p-2 font-semibold text-gray-900">
                              {item.buyer_name}
                              {item.delivery_location && (
                                <span className="text-[10px] text-gray-400 block font-normal">{item.delivery_location}</span>
                              )}
                            </td>
                            <td className="p-2 text-gray-800">
                              {item.product_name}
                            </td>
                            <td className="p-2 text-right font-mono text-gray-600">
                              {item.pending_quantity.toFixed(2)}
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={item.pending_quantity}
                                required
                                value={item.loading_quantity}
                                onChange={(e) => handleUpdateManifestItemQty(item.key, e.target.value)}
                                className={`w-24 p-1 text-right font-mono font-bold border rounded focus:outline-none ${
                                  isOverload
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-[#E8E2DC] bg-white focus:ring-1 focus:ring-[#8F1717]'
                                }`}
                              />
                              {isOverload && (
                                <span className="block text-[9px] text-red-600 font-medium">Max: {item.pending_quantity.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {isCurrentIndOwn ? (
                                <span className="inline-block px-2 py-0.5 text-[11px] font-mono text-emerald-800 bg-emerald-50 rounded border border-emerald-200">
                                  ₹0 (Own Mill)
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="e.g. 2850"
                                  required
                                  value={item.purchase_rate}
                                  onChange={(e) => handleUpdateManifestItemRate(item.key, e.target.value)}
                                  className="w-24 p-1 text-right font-mono border border-[#E8E2DC] rounded bg-white focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                                />
                              )}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-gray-900">
                              {isCurrentIndOwn ? '—' : `₹${Math.round(subtotal).toLocaleString('en-IN')}`}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSubFromManifest(item.key)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                                title="Remove sub-order from this truck manifest"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Total Truck Loading Banner */}
            {manifestItems.length > 0 && (() => {
              const currentInd = industries.find(i => String(i.id) === String(truckForm.industry_id));
              const isCurrentIndOwn = currentInd?.is_default === 1 || currentInd?.name?.toLowerCase().includes('bhagwathi');

              return (
                <div className="bg-[#FAF9F6] p-3 rounded-lg border border-[#E8E2DC] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Truck Loading</span>
                      <span className="text-base font-bold font-mono text-[#8F1717]">
                        {totalTruckQuantity.toFixed(2)} QTL
                      </span>
                    </div>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">
                        {isCurrentIndOwn ? 'Sourcing Basis' : 'Total Procurement Cost'}
                      </span>
                      <span className="text-base font-bold font-mono text-gray-900">
                        {isCurrentIndOwn ? 'Own Mill Production' : `₹${Math.round(totalTruckAmount).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 font-medium">
                    {manifestItems.length} sub-order{manifestItems.length !== 1 ? 's' : ''} across {new Set(manifestItems.map(m => m.po_id)).size} PO(s)
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Remarks */}
          <div>
            <label className="block font-semibold text-[#252525] mb-1">Remarks & Inspection Notes</label>
            <textarea
              rows={2}
              placeholder="Weighbridge slip no, moisture 12.5%, sortex clean, truck seal no..."
              value={truckForm.remarks}
              onChange={(e) => setTruckForm({ ...truckForm, remarks: e.target.value })}
              className="w-full p-2 bg-white border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          {/* Submit Actions */}
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
              disabled={manifestItems.length === 0 || totalTruckQuantity <= 0}
              className={`px-5 py-2 font-semibold rounded shadow-xs transition-colors ${
                manifestItems.length > 0 && totalTruckQuantity > 0
                  ? 'bg-[#8F1717] hover:bg-[#771212] text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Confirm & Post Bulk Truck Loading {totalTruckQuantity > 0 ? `(${totalTruckQuantity.toFixed(2)} QTL)` : ''}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

