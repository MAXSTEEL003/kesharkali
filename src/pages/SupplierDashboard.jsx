// src/pages/SupplierDashboard.jsx
// Dedicated Supplier Fulfilment & Operations Workspace for Application B
import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  Send,
  FileText,
  UploadCloud,
  Calendar,
  Layers,
  Search,
  Eye,
  HelpCircle,
  RefreshCw,
  Printer,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  FileCheck,
  ArrowRight,
  Warehouse,
  ExternalLink,
  Download,
  Factory,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Users,
  Trash2,
  Upload
} from 'lucide-react';
import { api, getRole, getSupplierId, setSupplierId } from '../api';
import Modal from '../components/Modal';
import { formatDateDMY } from '../utils/date';

export default function SupplierDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Core Data
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadings, setLoadings] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [products, setProducts] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [currentSupplierId, setCurrentSupplierIdState] = useState(getSupplierId() || '5');

  // Modals & Selection States
  const [selectedPO, setSelectedPO] = useState(null);
  const [isPODetailOpen, setIsPODetailOpen] = useState(false);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  // Forms
  const [queryForm, setQueryForm] = useState({ queryText: '' });
  const [rescheduleForm, setRescheduleForm] = useState({ revisedDate: '', reason: '' });
  const [poLedgerEvents, setPoLedgerEvents] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [loadingForm, setLoadingForm] = useState({
    poId: '',
    subOrderNo: '',
    loadingDate: new Date().toISOString().split('T')[0],
    loadingLocation: 'Mill Facility',
    vehicleNumber: '',
    driverPhone: '',
    loadingQuantity: '',
    remarks: ''
  });

  const [docForm, setDocForm] = useState({
    poId: '',
    loadingId: '',
    documentType: 'Supplier Invoice',
    fileName: '',
    fileUrl: '',
    fileSize: 0,
    mimeType: 'application/pdf'
  });

  const [dispatchForm, setDispatchForm] = useState({
    loadingId: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    dispatchQuantity: '',
    vehicleNumber: '',
    driverPhone: '',
    remarks: ''
  });

  // Filters & Sorting
  const [poSearch, setPoSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('ALL');
  const [poSortOrder, setPoSortOrder] = useState('new-to-old');
  const [pendingFilter, setPendingFilter] = useState('all'); // 'all' | 'pending-qtl' | 'fully-loaded'
  const [syncingWithAppA, setSyncingWithAppA] = useState(false);
  const [expandedPOs, setExpandedPOs] = useState({});

  // Sub-Order Mill Bill Upload & Preview Modals
  const [billUploadModal, setBillUploadModal] = useState({
    isOpen: false,
    poId: null,
    poNumber: '',
    subOrderNo: '',
    buyerName: '',
    billNo: '',
    fileName: '',
    fileData: null,
    fileSize: 0,
    mimeType: '',
    isUploading: false
  });

  const [billPreviewModal, setBillPreviewModal] = useState({
    isOpen: false,
    poId: null,
    poNumber: '',
    subOrderNo: '',
    buyerName: '',
    billNo: '',
    billUrl: '',
    fileName: '',
    uploadedAt: null
  });

  const openSubBillUploadModal = (po, sub) => {
    setBillUploadModal({
      isOpen: true,
      poId: po.id,
      poNumber: po.po_number,
      subOrderNo: sub.sub_order_no || sub.subOrderNo,
      buyerName: sub.buyer_name || sub.buyerName || po.customer_name_text || po.customer_name,
      billNo: sub.bill_no || sub.billNo || '',
      fileName: '',
      fileData: null,
      fileSize: 0,
      mimeType: '',
      isUploading: false
    });
  };

  const openSubBillPreviewModal = (po, sub) => {
    setBillPreviewModal({
      isOpen: true,
      poId: po.id,
      poNumber: po.po_number,
      subOrderNo: sub.sub_order_no || sub.subOrderNo,
      buyerName: sub.buyer_name || sub.buyerName || po.customer_name_text || po.customer_name,
      billNo: sub.bill_no || sub.billNo || 'N/A',
      billUrl: sub.bill_url || sub.billUrl || '',
      fileName: sub.bill_file_name || sub.billFileName || 'mill_bill.pdf',
      uploadedAt: sub.bill_uploaded_at || sub.billUploadedAt || null
    });
  };

  const handleSubBillFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File exceeds maximum size of 15MB. Please choose a smaller file.');
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
      alert('Please select a PDF document or image file to upload.');
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
      alert(`Mill bill uploaded successfully for Sub PO ${billUploadModal.subOrderNo}!`);
      setRefreshKey(k => k + 1);
      if (selectedPO) {
        handleOpenPODetail(selectedPO);
      }
    } catch (err) {
      alert(`Failed to upload bill: ${err.message}`);
      setBillUploadModal(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleDeleteSubOrderBill = async (poId, subOrderNo) => {
    if (!confirm(`Are you sure you want to delete the bill document for ${subOrderNo}?`)) return;
    try {
      await api.purchaseOrders.deleteSubOrderBill(poId, subOrderNo);
      setBillPreviewModal(prev => ({ ...prev, isOpen: false }));
      alert(`Bill deleted for Sub PO ${subOrderNo}.`);
      setRefreshKey(k => k + 1);
      if (selectedPO) {
        handleOpenPODetail(selectedPO);
      }
    } catch (err) {
      alert(`Failed to delete bill: ${err.message}`);
    }
  };

  const toggleExpandPO = (id) => {
    setExpandedPOs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandAll = () => {
    const allExpanded = filteredPOs.length > 0 && filteredPOs.every(p => expandedPOs[p.id]);
    if (allExpanded) {
      setExpandedPOs({});
    } else {
      const next = {};
      filteredPOs.forEach(p => { next[p.id] = true; });
      setExpandedPOs(next);
    }
  };

  const handleSyncWithAppA = async () => {
    try {
      setSyncingWithAppA(true);
      const res = await api.integration.syncAppA();
      setRefreshKey(k => k + 1);
      alert(`Successfully synchronized with App A! ${res.count || 0} active placed orders checked.`);
    } catch (err) {
      setRefreshKey(k => k + 1);
    } finally {
      setSyncingWithAppA(false);
    }
  };

  // Load All Supplier Data
  useEffect(() => {
    let isMounted = true;
    async function fetchSupplierData() {
      try {
        setLoading(true);
        setError(null);

        const [poRes, loadRes, dspRes, docRes, stockRes, prodRes, indRes] = await Promise.all([
          api.purchaseOrders.getAll().catch(() => ({ purchaseOrders: [] })),
          api.loadingRegister.getAll().catch(() => ({ loadingEntries: [] })),
          api.dispatches.getAll().catch(() => ({ dispatches: [] })),
          api.supplier.getDocuments().catch(() => ({ documents: [] })),
          api.stock.getSummary().catch(() => ({ summary: [] })),
          api.products.getAll().catch(() => ({ products: [] })),
          api.industries.getAll().catch(() => ({ industries: [] }))
        ]);

        if (isMounted) {
          setPurchaseOrders(poRes.purchaseOrders || []);
          setLoadings(loadRes.loadingEntries || []);
          setDispatches(dspRes.dispatches || []);
          setDocuments(docRes.documents || []);
          setStockSummary(stockRes.summary || []);
          setProducts(prodRes.products || []);
          setIndustries(indRes.industries || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load supplier workspace');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSupplierData();
    return () => { isMounted = false; };
  }, [refreshKey]);

  // Derived KPI Metrics
  const metrics = useMemo(() => {
    const total = purchaseOrders.length;
    const newCount = purchaseOrders.filter(p => p.status === 'New' || p.status === 'Pending' || p.status === 'Pending Acceptance').length;
    const accepted = purchaseOrders.filter(p => p.status === 'Accepted' || p.status === 'In Progress').length;
    const partiallyLoaded = purchaseOrders.filter(p => p.status === 'Partially Loaded').length;
    const loaded = purchaseOrders.filter(p => p.status === 'Loaded').length;
    const dispatched = purchaseOrders.filter(p => p.status === 'Dispatched' || p.status === 'Completed').length;
    const totalQtlOrdered = purchaseOrders.reduce((sum, p) => sum + (Number(p.ordered_quantity) || 0), 0);
    const totalQtlLoaded = loadings.reduce((sum, l) => sum + (Number(l.loading_quantity) || 0), 0);
    const totalQtlDispatched = dispatches.reduce((sum, d) => sum + (Number(d.dispatch_quantity) || 0), 0);

    return {
      total,
      newCount,
      accepted,
      partiallyLoaded,
      loaded,
      dispatched,
      totalQtlOrdered,
      totalQtlLoaded,
      totalQtlDispatched
    };
  }, [purchaseOrders, loadings, dispatches]);

  // Pending & Fully Loaded Counts for Quick Filter Pills
  const pendingCount = useMemo(() => {
    return purchaseOrders.filter(p => Number(p.remaining_quantity ?? (p.ordered_quantity - (p.loaded_quantity || 0))) > 0).length;
  }, [purchaseOrders]);

  const fullyLoadedCount = useMemo(() => {
    return purchaseOrders.filter(p => Number(p.remaining_quantity ?? (p.ordered_quantity - (p.loaded_quantity || 0))) <= 0).length;
  }, [purchaseOrders]);

  // Filtered & Chronologically Sorted POs
  const filteredPOs = useMemo(() => {
    const list = purchaseOrders.filter(po => {
      const remaining = Number(po.remaining_quantity ?? (po.ordered_quantity - (po.loaded_quantity || 0)));
      if (pendingFilter === 'pending-qtl' && remaining <= 0) return false;
      if (pendingFilter === 'fully-loaded' && remaining > 0) return false;

      const matchSearch = !poSearch || 
        po.po_number?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.sub_order_no?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.bill_no?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.original_order_id?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.product_name?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.customer_name?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.customer_name_text?.toLowerCase().includes(poSearch.toLowerCase());

      const matchStatus = poStatusFilter === 'ALL' || 
        (poStatusFilter === 'New' && (po.status === 'New' || po.status === 'Pending Acceptance' || po.status === 'Pending')) ||
        po.status === poStatusFilter;
      return matchSearch && matchStatus;
    });

    return [...list].sort((a, b) => {
      const dateA = a.po_date || '';
      const dateB = b.po_date || '';
      const subA = a.sub_order_no || '';
      const subB = b.sub_order_no || '';
      const idA = a.id || 0;
      const idB = b.id || 0;

      if (poSortOrder === 'old-to-new') {
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        if (subA !== subB) return subA.localeCompare(subB);
        return idA - idB;
      } else {
        // Default: new-to-old (Newest to Oldest)
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        if (subA !== subB) return subB.localeCompare(subA);
        return idB - idA;
      }
    });
  }, [purchaseOrders, poSearch, poStatusFilter, poSortOrder, pendingFilter]);

  // Action Handlers
  const handleOpenPODetail = async (po) => {
    setSelectedPO(po);
    setIsPODetailOpen(true);
    try {
      const res = await api.purchaseOrders.getById(po.id);
      if (res && res.purchaseOrder) {
        const enrichedSubs = (res.subOrders && res.subOrders.length > 0)
          ? res.subOrders
          : (po.sub_orders && po.sub_orders.length > 0 ? po.sub_orders : []);
        setSelectedPO({
          ...po,
          ...res.purchaseOrder,
          sub_orders: enrichedSubs
        });
      }
    } catch (err) {
      console.warn('Error fetching detailed PO data:', err);
    }
  };
  const handleAcceptPO = async (po) => {
    try {
      await api.supplier.acceptPO(po.id, { expectedLoadingDate: po.delivery_date });
      setRefreshKey(k => k + 1);
      if (selectedPO && selectedPO.id === po.id) {
        setSelectedPO(prev => ({ ...prev, status: 'Accepted' }));
      }
      alert(`PO ${po.po_number} accepted successfully. Fulfilment status synced to Orders Portal.`);
    } catch (err) {
      alert(`Error accepting PO: ${err.message}`);
    }
  };

  const handleOpenQuery = (po) => {
    setSelectedPO(po);
    setQueryForm({ queryText: po.query_text || '' });
    setIsQueryModalOpen(true);
  };

  const handleSubmitQuery = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;
    try {
      await api.supplier.queryPO(selectedPO.id, { queryText: queryForm.queryText });
      setIsQueryModalOpen(false);
      setRefreshKey(k => k + 1);
      alert(`Query for PO ${selectedPO.po_number} submitted to Admin.`);
    } catch (err) {
      alert(`Error submitting query: ${err.message}`);
    }
  };

  const handleOpenReschedule = (po) => {
    setSelectedPO(po);
    setRescheduleForm({ revisedDate: po.revised_date || po.delivery_date || '', reason: '' });
    setIsRescheduleModalOpen(true);
  };

  const handleSubmitReschedule = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;
    try {
      await api.supplier.reschedulePO(selectedPO.id, {
        revisedDate: rescheduleForm.revisedDate,
        reason: rescheduleForm.reason
      });
      setIsRescheduleModalOpen(false);
      setRefreshKey(k => k + 1);
      alert(`Reschedule request for ${selectedPO.po_number} sent to Admin.`);
    } catch (err) {
      alert(`Error requesting reschedule: ${err.message}`);
    }
  };

  const handleViewLedger = async (po) => {
    setSelectedPO(po);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await api.supplier.getPOLedger(po.id);
      setPoLedgerEvents(res.ledger || []);
    } catch (err) {
      setPoLedgerEvents([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleOpenLoadForSub = (po, sub) => {
    const ordQty = Number(sub.ordered_quantity || sub.orderedQuantity || 0);
    const ldQty = Number(sub.loaded_quantity || sub.loadedQuantity || 0);
    const remQty = Math.max(0, ordQty - ldQty);
    setLoadingForm({
      poId: String(po.id),
      subOrderNo: sub.sub_order_no || sub.subOrderNo || '',
      loadingDate: new Date().toISOString().split('T')[0],
      loadingLocation: sub.delivery_location || sub.deliveryLocation || po.delivery_location || 'Mill Facility',
      vehicleNumber: '',
      driverPhone: '',
      loadingQuantity: remQty > 0 ? remQty.toFixed(2) : ordQty.toFixed(2),
      remarks: `Loading for Sub-Order ${sub.sub_order_no || sub.subOrderNo} (${sub.buyer_name || sub.buyerName})`
    });
    setIsLoadingModalOpen(true);
  };

  const handleCreateLoading = async (e) => {
    e.preventDefault();
    const po = purchaseOrders.find(p => String(p.id) === String(loadingForm.poId));
    if (!po) {
      alert('Please select a valid Purchase Order');
      return;
    }

    const loadQty = Number(loadingForm.loadingQuantity);
    if (!loadQty || loadQty <= 0) {
      alert('Please enter a valid loading quantity');
      return;
    }

    // Sub-order overload check if sub-order is picked
    if (loadingForm.subOrderNo && po.sub_orders) {
      const sub = po.sub_orders.find(s => (s.sub_order_no || s.subOrderNo) === loadingForm.subOrderNo);
      if (sub) {
        const subOrd = Number(sub.ordered_quantity || sub.orderedQuantity || 0);
        const subLd = Number(sub.loaded_quantity || sub.loadedQuantity || 0);
        if (subLd + loadQty > subOrd && getRole() !== 'Admin') {
          alert(`Overloading prevented: Sub-order ${loadingForm.subOrderNo} (${sub.buyer_name || sub.buyerName}) ordered ${subOrd} QTL, already loaded ${subLd} QTL. Adding ${loadQty} QTL exceeds sub-order quantity.`);
          return;
        }
      }
    } else {
      const existingLoaded = loadings
        .filter(l => String(l.po_id) === String(po.id) && l.loading_status !== 'Cancelled')
        .reduce((sum, l) => sum + (Number(l.loading_quantity) || 0), 0);

      const orderQty = Number(po.ordered_quantity);

      if (existingLoaded + loadQty > orderQty && getRole() !== 'Admin') {
        alert(`Overloading prevented: Order requires ${orderQty} QTL. Already loaded: ${existingLoaded} QTL. Attempting to add ${loadQty} QTL exceeds total.`);
        return;
      }
    }

    try {
      const defaultInd = industries.find(i => i.is_default === 1) || industries[0];
      await api.loadingRegister.create({
        po_id: po.id,
        sub_order_no: loadingForm.subOrderNo || null,
        industry_id: po.supplier_id || po.industry_id || (defaultInd ? defaultInd.id : 5),
        product_id: po.product_id,
        fulfillment_type: 'Direct',
        loading_location: loadingForm.loadingLocation,
        vehicle_number: loadingForm.vehicleNumber.toUpperCase().trim(),
        driver_phone: loadingForm.driverPhone,
        loading_quantity: loadQty,
        purchase_rate: po.supplier_rate || po.customer_selling_rate || 2800,
        loading_date: loadingForm.loadingDate,
        remarks: loadingForm.remarks
      });

      setIsLoadingModalOpen(false);
      setLoadingForm({
        poId: '',
        subOrderNo: '',
        loadingDate: new Date().toISOString().split('T')[0],
        loadingLocation: 'Mill Facility',
        vehicleNumber: '',
        driverPhone: '',
        loadingQuantity: '',
        remarks: ''
      });
      setRefreshKey(k => k + 1);
      alert('Loading entry recorded successfully and synced with Orders Portal!');
    } catch (err) {
      alert(`Error creating loading: ${err.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setDocForm(prev => ({
        ...prev,
        fileName: file.name,
        fileUrl: uploadEvent.target.result,
        fileSize: file.size,
        mimeType: file.type || 'application/pdf'
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    if (!docForm.poId || !docForm.fileUrl) {
      alert('Please select a PO and upload a file');
      return;
    }

    try {
      await api.supplier.uploadDocument({
        poId: docForm.poId,
        loadingId: docForm.loadingId || null,
        documentType: docForm.documentType,
        fileName: docForm.fileName,
        fileUrl: docForm.fileUrl,
        fileSize: docForm.fileSize,
        mimeType: docForm.mimeType
      });

      setIsDocUploadModalOpen(false);
      setDocForm({
        poId: '',
        loadingId: '',
        documentType: 'Supplier Invoice',
        fileName: '',
        fileUrl: '',
        fileSize: 0,
        mimeType: 'application/pdf'
      });
      setRefreshKey(k => k + 1);
      alert('Document uploaded and synchronized with Orders Webapp!');
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    }
  };

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchForm.loadingId || !dispatchForm.dispatchQuantity) {
      alert('Please fill in required fields');
      return;
    }

    try {
      await api.dispatches.confirm({
        loading_id: dispatchForm.loadingId,
        dispatch_date: dispatchForm.dispatchDate,
        dispatch_quantity: Number(dispatchForm.dispatchQuantity),
        vehicle_number: dispatchForm.vehicleNumber.toUpperCase().trim(),
        driver_phone: dispatchForm.driverPhone,
        remarks: dispatchForm.remarks
      });

      setIsDispatchModalOpen(false);
      setDispatchForm({
        loadingId: '',
        dispatchDate: new Date().toISOString().split('T')[0],
        dispatchQuantity: '',
        vehicleNumber: '',
        driverPhone: '',
        remarks: ''
      });
      setRefreshKey(k => k + 1);
      alert('Dispatch confirmed and synced to customer/admin view!');
    } catch (err) {
      alert(`Dispatch error: ${err.message}`);
    }
  };

  const printPODocument = (po) => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head>
          <title>Purchase Order — ${po.po_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #222; }
            .header { border-bottom: 2px solid #8F1717; padding-bottom: 15px; margin-bottom: 25px; }
            .title { font-size: 24px; font-weight: bold; color: #8F1717; }
            .meta { font-size: 12px; color: #666; margin-top: 5px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 14px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            .table th, .table td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 12px; }
            .table th { background: #f8f4ee; color: #5E1010; font-weight: 600; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #e0f2fe; color: #0369a1; }
            .sub-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: monospace; font-weight: bold; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .bill-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: monospace; font-weight: bold; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .section-title { font-size: 14px; font-weight: bold; color: #8F1717; margin-top: 25px; margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">KESHAR KALI — PURCHASE ORDER</div>
            <div class="meta">Precision in Every Grain • Official Milling Procurement Voucher</div>
          </div>
          <div class="grid">
            <div>
              <strong>PO Number:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #8F1717;">${po.po_number}</span><br/>
              <strong>Sub Order No(s):</strong> <span class="sub-badge">${po.sub_order_no || 'N/A'}</span><br/>
              <strong>Mill Bill No:</strong> <span class="bill-badge">${po.bill_no || 'Pending Loading'}</span><br/>
              <strong>Original Order ID:</strong> ${po.original_order_id || 'Direct'}<br/>
              <strong>Date:</strong> ${formatDateDMY(po.po_date || po.order_date)}<br/>
              <strong>Status:</strong> <span class="badge">${po.status}</span>
            </div>
            <div>
              <strong>Customer / Buyer:</strong> ${po.customer_name_text || po.customer_name || 'Designated Buyer'}<br/>
              <strong>Delivery Destination:</strong> ${po.delivery_location || 'Designated Destination'}<br/>
              <strong>Contact:</strong> ${po.customer_contact_text || 'Available through Dispatch Coordinator'}<br/>
              <strong>Assigned Supplier:</strong> Bhagwathi Rice and Agro Industries (BRI / SUP-06)
            </div>
          </div>
          
          <div class="section-title">Consignment Specification Summary</div>
          <table class="table">
            <thead>
              <tr>
                <th>Product Description</th>
                <th>Variety / Brand</th>
                <th>Ordered Qty (QTL)</th>
                <th>Agreed Rate (₹/QTL)</th>
                <th>Estimated Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${po.product_name}</strong></td>
                <td>${po.product_variety || 'Premium Steamed Rice'}</td>
                <td style="font-weight: bold;">${po.ordered_quantity} QTL</td>
                <td>₹${Number(po.supplier_rate || po.customer_selling_rate || 0).toLocaleString('en-IN')}</td>
                <td style="font-weight: bold; color: #8F1717;">₹${(Number(po.ordered_quantity) * Number(po.supplier_rate || po.customer_selling_rate || 0)).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          ${po.sub_orders && po.sub_orders.length > 0 ? `
            <div class="section-title">Constituent Sub-Orders Breakdown (${po.sub_orders.length})</div>
            <table class="table">
              <thead>
                <tr>
                  <th>Sub No</th>
                  <th>Consignee (Buyer)</th>
                  <th>Variety</th>
                  <th>Volume (QTL)</th>
                  <th>Rate Ex-Mill</th>
                  <th>Total Amount</th>
                  <th>Mill Bill No</th>
                  <th>Unloading Point</th>
                </tr>
              </thead>
              <tbody>
                ${po.sub_orders.map(s => `
                  <tr>
                    <td><span class="sub-badge">${s.sub_order_no}</span></td>
                    <td><strong>${s.buyer_name}</strong></td>
                    <td>${s.product_name}</td>
                    <td style="font-weight: bold;">${s.ordered_quantity} QTL</td>
                    <td>₹${Number(s.rate).toLocaleString('en-IN')}</td>
                    <td style="font-weight: bold; color: #8F1717;">₹${Number(s.amount).toLocaleString('en-IN')}</td>
                    <td>${s.bill_no ? (s.bill_no === 'Pending Loading' ? '<em>Pending</em>' : '#' + s.bill_no) : '—'}</td>
                    <td>${s.delivery_location || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div style="margin-top: 30px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
            Confidential Procurement Voucher. Synchronized via Two-Portal Sourcing Integration. All dispatches must carry authentic weighbridge slips and LR copies.
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 250);
  };

  const activeSupplier = industries.find(i => String(i.id) === String(currentSupplierId)) || { 
    id: 5, 
    name: 'Bhagwathi Rice and Agro Industries',
    location: 'APMC Industrial Area, Gadchiroli',
    phone: '+91 94401 88941'
  };

  const handleSupplierSelect = (id) => {
    setSupplierId(id);
    setCurrentSupplierIdState(id);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="glass-panel rounded-3xl p-6 shadow-sm border border-white/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#8F1717] text-white">
              Application B
            </span>
            <span className="text-xs text-[#C69A3B] font-semibold flex items-center gap-1">
              <ShieldCheck size={14} /> Two-Portal Integrated Supplier Portal
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#252525] font-['Space_Grotesk'] tracking-tight">
            Supplier Fulfilment & Operations Workspace
          </h1>
          <p className="text-xs text-gray-500">
            Automated PO allocation, multi-vehicle loading, weighbridge slips, and real-time reverse synchronization.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Assigned Milling Unit:</span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-[#C69A3B]/40 text-[#5E1010] text-xs font-bold shadow-2xs">
              <Factory size={13} className="text-[#8F1717]" />
              <span>{activeSupplier.name}</span>
              <span className="text-[10px] font-mono bg-white/80 px-1.5 py-0.5 rounded text-gray-600 border border-amber-200">
                Code: {activeSupplier.name?.toLowerCase().includes('bhagwath') || activeSupplier.name?.toLowerCase().includes('bhagwati') ? 'BRI / SUP-06' : `SUP-${activeSupplier.id}`}
              </span>
            </div>
            {industries.length > 1 && (
              <select
                value={currentSupplierId}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-gray-700 font-medium focus:ring-1 focus:ring-[#8F1717] cursor-pointer"
                title="Switch active supplier view"
              >
                {industries.map(ind => (
                  <option key={ind.id} value={ind.id}>
                    {ind.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncWithAppA}
            disabled={loading || syncingWithAppA}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/80 hover:bg-white text-gray-700 border border-gray-200 transition-all shadow-2xs cursor-pointer"
            title="Sync with App A (Orders Webapp)"
          >
            <RefreshCw size={14} className={loading || syncingWithAppA ? 'animate-spin text-[#8F1717]' : ''} />
            <span>{syncingWithAppA ? 'Syncing...' : 'Sync with App A'}</span>
          </button>

          <button
            onClick={() => setIsLoadingModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-[#8F1717] to-[#771212] text-white shadow-xs hover:shadow-sm transition-all"
          >
            <Truck size={14} className="text-[#C69A3B]" />
            <span>Record Loading</span>
          </button>

          <button
            onClick={() => setIsDocUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#C69A3B] text-[#5E1010] font-bold shadow-xs hover:bg-[#b08730] transition-all"
          >
            <UploadCloud size={14} />
            <span>Upload Bill / Slip</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-black/5">
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'pos', label: 'Purchase Orders', icon: Inbox, count: metrics.newCount },
          { id: 'stock', label: 'Stock Ledger', icon: Warehouse },
          { id: 'loading', label: 'Loading Register', icon: Truck },
          { id: 'documents', label: 'Bills & Documents', icon: FileText, count: documents.length },
          { id: 'dispatch', label: 'Transport & Dispatch', icon: Send }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#8F1717] text-white shadow-xs'
                  : 'bg-white/60 hover:bg-white text-gray-600 hover:text-gray-900 border border-transparent'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-[#C69A3B]' : 'text-gray-400'} />
              <span>{tab.label}</span>
              {Boolean(tab.count) && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white text-[#8F1717]' : 'bg-[#8F1717]/10 text-[#8F1717]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setRefreshKey(k => k + 1)} className="font-bold underline">Retry</button>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="glass-card rounded-2xl p-4 border border-white/60 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">New POs</span>
              <div className="text-2xl font-bold font-mono text-[#8F1717]">{metrics.newCount}</div>
              <span className="text-[10px] text-amber-600 font-medium mt-1 block">Awaiting confirmation</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Accepted</span>
              <div className="text-2xl font-bold font-mono text-emerald-600">{metrics.accepted}</div>
              <span className="text-[10px] text-gray-400 font-medium mt-1 block">Scheduled for loading</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Partially Loaded</span>
              <div className="text-2xl font-bold font-mono text-blue-600">{metrics.partiallyLoaded}</div>
              <span className="text-[10px] text-blue-500 font-medium mt-1 block">In vehicle queue</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Loaded (100%)</span>
              <div className="text-2xl font-bold font-mono text-indigo-600">{metrics.loaded}</div>
              <span className="text-[10px] text-gray-400 font-medium mt-1 block">Ready for transit</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Dispatched</span>
              <div className="text-2xl font-bold font-mono text-purple-600">{metrics.dispatched}</div>
              <span className="text-[10px] text-gray-400 font-medium mt-1 block">On road / Delivered</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Total Ordered</span>
              <div className="text-2xl font-bold font-mono text-[#252525]">{metrics.totalQtlOrdered} <span className="text-xs">QTL</span></div>
              <span className="text-[10px] text-emerald-600 font-medium mt-1 block">{metrics.totalQtlLoaded} QTL Loaded</span>
            </div>
          </div>

          {/* Quick POs Awaiting Attention */}
          <div className="glass-panel rounded-3xl p-5 shadow-2xs border border-white/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#252525] font-['Space_Grotesk']">
                  Purchase Orders Requiring Immediate Action
                </h2>
                <p className="text-[11px] text-gray-500">Incoming purchase orders synchronized from Orders Webapp (App A)</p>
              </div>
              <button
                onClick={() => setActiveTab('pos')}
                className="text-xs text-[#8F1717] font-semibold hover:underline flex items-center gap-1"
              >
                <span>View All POs</span> <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-2.5">
              {purchaseOrders.filter(p => p.status === 'New' || p.status === 'Pending' || p.status === 'Pending Acceptance').slice(0, 5).map(po => (
                <div key={po.id} className="p-3.5 bg-white/70 hover:bg-white rounded-2xl border border-amber-200/60 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                      <Inbox size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm font-mono text-[#8F1717]">{po.po_number}</span>
                        {po.sub_order_no && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-mono font-bold">
                            Sub No: {po.sub_order_no}
                          </span>
                        )}
                        {po.original_order_id && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                            Ref: {po.original_order_id}
                          </span>
                        )}
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase">
                          {po.status === 'Pending Acceptance' ? 'Awaiting Acceptance' : po.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        <strong>{po.ordered_quantity} QTL</strong> • {po.product_name} • Date: <span className="font-mono">{formatDateDMY(po.po_date)}</span> • Consignee: {po.customer_name_text || po.customer_name || 'Designated Buyer'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAcceptPO(po)}
                      className="px-3 py-1.5 bg-[#8F1717] hover:bg-[#771212] text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-2xs"
                    >
                      <Check size={14} />
                      <span>Accept PO</span>
                    </button>
                    <button
                      onClick={() => handleOpenPODetail(po)}
                      className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>
                    <button
                      onClick={() => handleOpenQuery(po)}
                      className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl"
                    >
                      Raise Query
                    </button>
                    <button
                      onClick={() => handleOpenReschedule(po)}
                      className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl"
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              ))}

              {purchaseOrders.filter(p => p.status === 'New' || p.status === 'Pending' || p.status === 'Pending Acceptance').length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                  All incoming Purchase Orders have been reviewed and accepted.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE ORDERS */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white/70 p-3 rounded-2xl border border-white/60">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search size={15} className="text-gray-400" />
              <input
                type="text"
                value={poSearch}
                onChange={e => setPoSearch(e.target.value)}
                placeholder="Search by PO#, Order Ref, Product, Consignee..."
                className="w-full text-xs bg-transparent border-none focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400 font-medium">Status:</span>
                <select
                  value={poStatusFilter}
                  onChange={e => setPoStatusFilter(e.target.value)}
                  className="text-xs bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="New">New / Pending</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Partially Loaded">Partially Loaded</option>
                  <option value="Loaded">Fully Loaded</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400 font-medium">Sort:</span>
                <select
                  value={poSortOrder}
                  onChange={e => setPoSortOrder(e.target.value)}
                  className="text-xs bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 font-semibold text-[#8F1717] focus:outline-none cursor-pointer"
                  title="Choose chronological order"
                >
                  <option value="new-to-old">New to Old (Recent First)</option>
                  <option value="old-to-new">Old to New (Oldest First)</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPoSortOrder(prev => prev === 'new-to-old' ? 'old-to-new' : 'new-to-old')}
                  className="p-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-2xs transition-all"
                  title={`Currently: ${poSortOrder === 'new-to-old' ? 'Newest to Oldest' : 'Oldest to Newest'} (Click to toggle)`}
                >
                  <ArrowUpDown size={14} className="text-[#8F1717]" />
                </button>
              </div>
            </div>
          </div>

          {/* PO Table */}
          <div className="glass-panel rounded-3xl overflow-hidden shadow-2xs border border-white/60">
            {/* Quick Glance Toolbar */}
            <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-gray-50/90 border-b border-gray-200 text-xs gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-700">Orders List:</span>
                <button
                  type="button"
                  onClick={() => setPendingFilter('all')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    pendingFilter === 'all'
                      ? 'bg-[#8F1717] text-white shadow-2xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span>All Orders</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${pendingFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {purchaseOrders.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingFilter('pending-qtl')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    pendingFilter === 'pending-qtl'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                  }`}
                  title="Filter POs that have pending QTL remaining to be loaded"
                >
                  <span>⚠️ Pending QTL Balance</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${pendingFilter === 'pending-qtl' ? 'bg-black/20 text-white' : 'bg-amber-100 text-amber-900'}`}>
                    {pendingCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingFilter('fully-loaded')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    pendingFilter === 'fully-loaded'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                  }`}
                  title="Filter POs that are fully loaded (0 QTL remaining)"
                >
                  <span>✅ Fully Loaded</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${pendingFilter === 'fully-loaded' ? 'bg-black/20 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
                    {fullyLoadedCount}
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#8F1717] bg-white hover:bg-red-50 border border-red-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Glance all constituent sub-orders and buyers across all POs"
              >
                <Layers size={13} />
                <span>
                  {filteredPOs.length > 0 && filteredPOs.every(p => expandedPOs[p.id])
                    ? 'Collapse All Sub-Orders'
                    : 'Glance All Sub-Orders (Expand All)'}
                </span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-gray-200 text-[#5E1010] font-semibold font-['Space_Grotesk']">
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-amber-50/60 transition-colors select-none"
                      onClick={() => setPoSortOrder(prev => prev === 'new-to-old' ? 'old-to-new' : 'new-to-old')}
                      title="Click to toggle New to Old / Old to New sort"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>PO & Sub-Orders</span>
                        <ArrowUpDown size={13} className={poSortOrder === 'new-to-old' ? 'text-[#8F1717]' : 'text-blue-600'} />
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                          {poSortOrder === 'new-to-old' ? 'Newest' : 'Oldest'}
                        </span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">Date</th>
                    <th className="py-3 px-4">Buyer / Consignee</th>
                    <th className="py-3 px-4">Product Variety</th>
                    <th className="py-3 px-4 text-right">Ordered Qty</th>
                    <th className="py-3 px-4 text-right">Loaded Qty</th>
                    <th className="py-3 px-4 text-right">Remaining</th>
                    <th className="py-3 px-4 text-center">Mill Bill No</th>
                    <th className="py-3 px-4 text-right">Rate (₹/QTL)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white/60">
                  {filteredPOs.map(po => {
                    const statusClass = 
                      po.status === 'Completed' || po.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                      po.status === 'Dispatched' ? 'bg-purple-100 text-purple-800' :
                      po.status === 'Loaded' ? 'bg-indigo-100 text-indigo-800' :
                      po.status === 'Partially Loaded' ? 'bg-blue-100 text-blue-800' :
                      po.status === 'Accepted' ? 'bg-teal-100 text-teal-800' :
                      'bg-amber-100 text-amber-800';

                    const subOrdersList = po.sub_orders || [];
                    const hasMultipleSubs = subOrdersList.length > 1;
                    const isExpanded = !!expandedPOs[po.id];

                    // Extract unique buyers
                    const uniqueBuyers = Array.from(
                      new Set(subOrdersList.map(s => s.buyer_name || s.buyerName).filter(Boolean))
                    );
                    if (uniqueBuyers.length === 0 && (po.customer_name_text || po.customer_name)) {
                      uniqueBuyers.push(po.customer_name_text || po.customer_name);
                    }

                    const firstSub = subOrdersList[0]?.sub_order_no || subOrdersList[0]?.subOrderNo;
                    const lastSub = subOrdersList[subOrdersList.length - 1]?.sub_order_no || subOrdersList[subOrdersList.length - 1]?.subOrderNo;

                    return (
                      <React.Fragment key={po.id}>
                        <tr className={`hover:bg-white transition-colors ${isExpanded ? 'bg-amber-50/30' : ''}`}>
                          <td className="py-3 px-4">
                            <div 
                              className="font-mono font-bold text-sm text-[#8F1717] cursor-pointer hover:underline inline-flex items-center gap-1"
                              onClick={() => handleOpenPODetail(po)}
                              title="Click to view full PO details"
                            >
                              {po.po_number}
                            </div>
                            
                            {/* Sub Numbers Easy Glance */}
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
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Sub No: {po.sub_order_no}
                                  </span>
                                </div>
                              )
                            )}
                          </td>

                          {/* PO Date */}
                          <td className="py-3 px-3 font-mono text-center text-xs text-gray-600 whitespace-nowrap">
                            {formatDateDMY(po.po_date)}
                          </td>

                          {/* Buyer / Consignee Glance */}
                          <td className="py-3 px-4">
                            {subOrdersList.length <= 1 ? (
                              <div>
                                <span className="font-semibold text-gray-900 block">{uniqueBuyers[0] || po.customer_name_text || po.customer_name}</span>
                                <span className="text-[10px] text-gray-400 font-mono block">
                                  {po.original_order_id ? `App A: ${po.original_order_id}` : 'Direct Consignee'}
                                </span>
                              </div>
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
                            <span className="text-[11px] text-gray-500 block truncate max-w-[200px] mt-0.5" title={po.delivery_location}>
                              {po.delivery_location}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-800">{po.product_name}</span>
                            <span className="block text-[10px] text-gray-400">{po.product_variety || 'Grade A'}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-gray-800 text-right">
                            <div>{Number(po.ordered_quantity || 0).toFixed(2)}</div>
                            {subOrdersList.length > 1 && (
                              <span className="text-[10px] text-gray-400 font-normal font-sans block">
                                {subOrdersList.length} sub-orders
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700 text-right">
                            {Number(po.loaded_quantity || 0).toFixed(2)}
                          </td>
                          <td className={`py-3 px-4 font-mono font-bold text-right ${
                            Number(po.remaining_quantity ?? (po.ordered_quantity - (po.loaded_quantity || 0))) > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}>
                            {Number(po.remaining_quantity ?? (po.ordered_quantity - (po.loaded_quantity || 0))).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {po.bill_no ? (
                              po.bill_no === 'Pending Loading' ? (
                                <span className="text-[10px] font-mono text-gray-400 italic">Pending</span>
                              ) : (
                                <span className="font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                                  #{po.bill_no}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-700 font-semibold text-right">
                            ₹{Number(po.supplier_rate || po.customer_selling_rate || 0).toLocaleString('en-IN')}
                            <span className="block text-[10px] text-gray-400 font-normal">/ QTL</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusClass}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Glance Toggle */}
                              {hasMultipleSubs && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandPO(po.id)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isExpanded 
                                      ? 'bg-[#8F1717] text-white' 
                                      : 'hover:bg-red-50 text-[#8F1717]'
                                  }`}
                                  title={isExpanded ? 'Collapse Sub-Orders Glance' : 'Quick Glance Sub-Orders & Buyers'}
                                >
                                  <Layers size={14} />
                                </button>
                              )}

                              {(po.status === 'New' || po.status === 'Pending Acceptance') && (
                                <button
                                  onClick={() => handleAcceptPO(po)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold"
                                  title="Accept PO"
                                >
                                  Accept
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenPODetail(po)}
                                className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg cursor-pointer"
                                title="Open Full PO Detail Drawer"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => handleViewLedger(po)}
                                className="p-1.5 hover:bg-gray-100 text-[#8F1717] rounded-lg cursor-pointer"
                                title="Chronological PO Ledger"
                              >
                                <Clock size={15} />
                              </button>
                              <button
                                onClick={() => printPODocument(po)}
                                className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg cursor-pointer"
                                title="Print PO Voucher"
                              >
                                <Printer size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Inline Accordion for Sub-Orders */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b border-gray-200">
                            <td colSpan={11} className="p-0 border-y border-amber-200">
                              <div className="bg-gradient-to-r from-amber-50/70 via-white to-blue-50/40 p-4 pl-8">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#8F1717] text-white text-[11px] font-bold tracking-wide uppercase">
                                      <Layers size={11} />
                                      Sub-Orders & Buyers Quick Glance
                                    </span>
                                    <span className="text-xs font-mono font-bold text-gray-800">
                                      PO #{po.po_number}
                                    </span>
                                    <span className="text-[11px] text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 font-medium">
                                      {subOrdersList.length} Sub-Orders • {uniqueBuyers.length} Buyers
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPODetail(po)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8F1717] hover:text-red-900 bg-white hover:bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
                                    title="Open full PO detail modal"
                                  >
                                    <span>Open Whole PO Detail</span>
                                    <ExternalLink size={12} />
                                  </button>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-2xs">
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
                                        <th className="py-2 px-3 text-right">Rate</th>
                                        <th className="py-2 px-3 text-right">Subtotal</th>
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
                                              {sub.buyer_name || sub.buyerName || po.customer_name_text || po.customer_name}
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
                                              ₹{Number(sub.rate || po.supplier_rate || po.customer_selling_rate || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-800">
                                              ₹{Number(sub.amount || (ordQty * (sub.rate || 0)) || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-1.5 px-3 text-center font-mono">
                                              {sub.bill_url ? (
                                                <div className="flex items-center justify-center gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openSubBillPreviewModal(po, sub); }}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
                                                    title={`Click to view uploaded bill for ${sub.sub_order_no || sub.subOrderNo}`}
                                                  >
                                                    {sub.bill_file_name?.toLowerCase().endsWith('.pdf') ? <FileText size={11} className="text-red-700" /> : <Eye size={11} className="text-emerald-700" />}
                                                    <span>{sub.bill_no ? `#${sub.bill_no}` : 'View Bill'}</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openSubBillUploadModal(po, sub); }}
                                                    className="text-[9px] text-gray-500 hover:text-[#8F1717] underline cursor-pointer"
                                                    title="Upload replacement bill"
                                                  >
                                                    Re-upload
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); openSubBillUploadModal(po, sub); }}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#8F1717] border border-dashed border-gray-300 hover:border-red-300 transition-colors cursor-pointer"
                                                  title={`Upload Mill Bill (PDF/Image) for ${sub.sub_order_no || sub.subOrderNo}`}
                                                >
                                                  <UploadCloud size={11} />
                                                  <span>Upload Bill</span>
                                                </button>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-3 text-center">
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleOpenLoadForSub(po, sub); }}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#8F1717] hover:bg-[#771212] text-white font-semibold text-[10px] shadow-2xs cursor-pointer transition-colors"
                                                title={`Record vehicle loading for ${sub.sub_order_no || sub.subOrderNo} (${remQty.toFixed(2)} QTL pending)`}
                                              >
                                                <Truck size={10} />
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
                  })}
                </tbody>
              </table>

              {filteredPOs.length === 0 && (
                <div className="py-12 text-center text-xs text-gray-400">
                  No purchase orders found matching your search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK LEDGER */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-3xl p-5 shadow-2xs border border-white/60">
            <h2 className="text-sm font-bold text-[#252525] font-['Space_Grotesk'] mb-1">
              Authoritative Mill Stock & Inventory Position
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Real-time physical stock and running balance per product variety.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockSummary.map((item, idx) => (
                <div key={idx} className="p-4 bg-white/80 rounded-2xl border border-gray-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#8F1717]">{item.product_name}</span>
                    <span className="text-[11px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      {item.product_code || 'GRAIN'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">Available Stock:</span>
                    <span className="font-mono font-bold text-lg text-emerald-700">{item.current_physical_stock || 0} QTL</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-[11px] text-gray-400">
                    <span>Inwarded This Month:</span>
                    <span className="font-mono">{item.total_inward || 0} QTL</span>
                  </div>
                </div>
              ))}

              {stockSummary.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-gray-400">
                  No stock records available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOADING MANAGEMENT */}
      {activeTab === 'loading' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#252525] font-['Space_Grotesk']">
                Multi-Vehicle Loading Register
              </h2>
              <p className="text-xs text-gray-500">
                Log partial and complete loading entries with vehicle numbers and overload prevention.
              </p>
            </div>
            <button
              onClick={() => setIsLoadingModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#8F1717] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <Truck size={14} className="text-[#C69A3B]" />
              <span>Record Vehicle Loading</span>
            </button>
          </div>

          <div className="glass-panel rounded-3xl overflow-hidden shadow-2xs border border-white/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-gray-200 text-[#5E1010] font-semibold font-['Space_Grotesk']">
                    <th className="py-3 px-4">Loading ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Linked PO</th>
                    <th className="py-3 px-4 text-center">Sub-PO #</th>
                    <th className="py-3 px-4">Buyer / Consignee</th>
                    <th className="py-3 px-4">Vehicle Number</th>
                    <th className="py-3 px-4">Driver Phone</th>
                    <th className="py-3 px-4">Quantity (QTL)</th>
                    <th className="py-3 px-4">Dispatch Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white/60">
                  {loadings.map(ld => (
                    <tr key={ld.id} className="hover:bg-white transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#8F1717]">{ld.loading_number}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs">{formatDateDMY(ld.loading_date)}</td>
                      <td className="py-3 px-4 font-mono text-gray-700">{ld.po_number}</td>
                      <td className="py-3 px-4 text-center">
                        {ld.sub_order_no ? (
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {ld.sub_order_no}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-[10px]">Entire PO</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {ld.sub_buyer_name || ld.customer_name || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{ld.vehicle_number}</td>
                      <td className="py-3 px-4 text-gray-600">{ld.driver_phone || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">{ld.loading_quantity} QTL</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ld.dispatch_status === 'Dispatched' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ld.dispatch_status || 'Pending Dispatch'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {ld.dispatch_status !== 'Dispatched' && (
                          <button
                            onClick={() => {
                              setDispatchForm(prev => ({
                                ...prev,
                                loadingId: ld.id,
                                dispatchQuantity: ld.available_to_dispatch || ld.loading_quantity,
                                vehicleNumber: ld.vehicle_number,
                                driverPhone: ld.driver_phone || ''
                              }));
                              setIsDispatchModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-[#8F1717] hover:bg-[#771212] text-white rounded-lg text-[11px] font-semibold"
                          >
                            Dispatch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {loadings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        No loading entries recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BILLS & DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#252525] font-['Space_Grotesk']">
                Supplier Documents, Invoices & Weighbridge Slips
              </h2>
              <p className="text-xs text-gray-500">
                Uploaded documents are securely synchronized and immediately viewable in Orders Webapp (App A).
              </p>
            </div>
            <button
              onClick={() => setIsDocUploadModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#C69A3B] text-[#5E1010] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs hover:bg-[#b08730]"
            >
              <UploadCloud size={14} />
              <span>Upload Document</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
              <div key={doc.id} className="p-4 bg-white/80 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8F1717]/10 text-[#8F1717]">
                      {doc.document_type}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">{doc.uploaded_at ? doc.uploaded_at.split('T')[0] : 'Today'}</span>
                  </div>
                  <h3 className="font-bold text-xs text-gray-800 truncate" title={doc.file_name}>{doc.file_name}</h3>
                  <div className="text-[11px] text-gray-500 mt-1">
                    PO Ref: <span className="font-mono font-semibold text-gray-700">{doc.po_number || 'Linked'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">By: {doc.uploaded_by || 'Supplier Staff'}</span>
                  <a
                    href={doc.file_url}
                    download={doc.file_name}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-[#8F1717] font-semibold hover:underline"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))}

            {documents.length === 0 && (
              <div className="col-span-full py-12 text-center text-xs text-gray-400">
                <FileText size={24} className="mx-auto text-gray-300 mb-1" />
                No documents uploaded yet. Upload invoices or weighbridge slips to sync with Orders Portal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: TRANSPORT & DISPATCH */}
      {activeTab === 'dispatch' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-3xl overflow-hidden shadow-2xs border border-white/60">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#252525] font-['Space_Grotesk']">
                  Vehicle Dispatches & Transit Tracking
                </h2>
                <p className="text-xs text-gray-500">
                  Customer and Admin real-time dispatch log.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-gray-200 text-[#5E1010] font-semibold font-['Space_Grotesk']">
                    <th className="py-3 px-4">Dispatch No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">PO Ref</th>
                    <th className="py-3 px-4">Vehicle Number</th>
                    <th className="py-3 px-4">Driver Phone</th>
                    <th className="py-3 px-4">Dispatched Qty</th>
                    <th className="py-3 px-4">Delivery Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white/60">
                  {dispatches.map(dsp => (
                    <tr key={dsp.id} className="hover:bg-white transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#8F1717]">{dsp.dispatch_number}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs">{formatDateDMY(dsp.dispatch_date)}</td>
                      <td className="py-3 px-4 font-mono text-gray-700">{dsp.po_number}</td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{dsp.vehicle_number}</td>
                      <td className="py-3 px-4 text-gray-600">{dsp.driver_phone || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">{dsp.dispatch_quantity} QTL</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          Dispatched
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dispatches.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        No dispatches confirmed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: PO DETAILS */}
      <Modal
        isOpen={isPODetailOpen}
        onClose={() => setIsPODetailOpen(false)}
        title={selectedPO ? `Purchase Order ${selectedPO.po_number}` : 'PO Details'}
        subtitle="Full specification & constituent sub-order breakdown from Orders Webapp"
        maxWidth="max-w-4xl"
      >
        {selectedPO && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">PO NUMBER</span>
                <span className="font-mono font-bold text-sm text-[#8F1717]">{selectedPO.po_number}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">PO DATE</span>
                <span className="font-mono font-bold text-gray-800">{formatDateDMY(selectedPO.po_date)}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">SUB-ORDER NUMBER(S)</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                  {selectedPO.sub_order_no || 'Single Order'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">MILL BILL NO</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                  {selectedPO.bill_no ? (selectedPO.bill_no === 'Pending Loading' ? 'Pending Loading' : `#${selectedPO.bill_no}`) : 'Pending Loading'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">STATUS</span>
                <span className="font-bold uppercase text-[#8F1717]">{selectedPO.status}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">PRODUCT VARIETY</span>
                <span className="font-bold text-gray-800">{selectedPO.product_name}</span>
                <span className="block text-[10px] text-gray-500">{selectedPO.product_variety || 'Grade A'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">TOTAL ORDERED QTY</span>
                <span className="font-mono font-bold text-gray-800">{selectedPO.ordered_quantity} QTL</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">AGREED SOURCING RATE</span>
                <span className="font-mono font-bold text-gray-800">
                  ₹{Number(selectedPO.supplier_rate || selectedPO.customer_selling_rate || 0).toLocaleString('en-IN')} / QTL
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">ESTIMATED ORDER VALUE</span>
                <span className="font-mono font-bold text-[#8F1717]">
                  ₹{(Number(selectedPO.ordered_quantity) * Number(selectedPO.supplier_rate || selectedPO.customer_selling_rate || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
              <span className="font-semibold text-amber-900 block mb-0.5">Customer / Consignee & Delivery Destination</span>
              <p className="text-gray-800 font-medium">
                {selectedPO.customer_name_text || selectedPO.customer_name} • {selectedPO.delivery_location || 'Customer Consignee Location'}
              </p>
              {selectedPO.original_order_id && (
                <p className="text-gray-500 mt-0.5 font-mono text-[11px]">
                  Orders Webapp Reference: {selectedPO.original_order_id}
                </p>
              )}
              {selectedPO.supplier_notes && (
                <p className="text-gray-600 mt-1 italic">Notes: {selectedPO.supplier_notes}</p>
              )}
            </div>

            {/* Constituent Sub-Orders Breakdown Table */}
            {selectedPO.sub_orders && selectedPO.sub_orders.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 text-xs font-['Space_Grotesk'] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#8F1717]"></span>
                    Constituent Sub-Orders & Consignee Allocations ({selectedPO.sub_orders.length})
                  </h3>
                  <span className="text-[11px] text-gray-500 font-mono">
                    Prefix: BRI (Bhagwathi Rice Desk)
                  </span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold text-[11px]">
                          <th className="py-2.5 px-3">Sub Order No</th>
                          <th className="py-2.5 px-3">Consignee (Buyer)</th>
                          <th className="py-2.5 px-3">Product / Variety</th>
                          <th className="py-2.5 px-3 text-right">Ordered</th>
                          <th className="py-2.5 px-3 text-right">Loaded</th>
                          <th className="py-2.5 px-3 text-right">Pending</th>
                          <th className="py-2.5 px-3 text-right">Rate</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Mill Bill (PDF/Image)</th>
                          <th className="py-2.5 px-3 text-center">Load</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedPO.sub_orders.map((sub, idx) => {
                          const ordQty = Number(sub.ordered_quantity || sub.orderedQuantity || 0);
                          const ldQty = Number(sub.loaded_quantity || sub.loadedQuantity || 0);
                          const remQty = Math.max(0, ordQty - ldQty);
                          return (
                            <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-blue-700 bg-blue-50/30 whitespace-nowrap">
                                {sub.sub_order_no || sub.subOrderNo}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-gray-800">
                                {sub.buyer_name || sub.buyerName}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">
                                {sub.product_name || sub.productName || selectedPO.product_name}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-right text-gray-800 whitespace-nowrap">
                                {ordQty.toFixed(2)} QTL
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-right text-indigo-700 whitespace-nowrap">
                                {ldQty.toFixed(2)} QTL
                              </td>
                              <td className={`py-2.5 px-3 font-mono font-bold text-right whitespace-nowrap ${remQty > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {remQty.toFixed(2)} QTL
                              </td>
                              <td className="py-2.5 px-3 font-mono text-right text-gray-600 whitespace-nowrap">
                                ₹{Number(sub.rate || selectedPO.supplier_rate || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-right text-[#8F1717] whitespace-nowrap">
                                ₹{Number(sub.amount || (ordQty * (sub.rate || 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 font-mono whitespace-nowrap text-center">
                                {sub.bill_url ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openSubBillPreviewModal(selectedPO, sub)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
                                      title="View Sub-Order Bill"
                                    >
                                      {sub.bill_file_name?.toLowerCase().endsWith('.pdf') ? <FileText size={11} className="text-red-700" /> : <Eye size={11} className="text-emerald-700" />}
                                      <span>{sub.bill_no ? `#${sub.bill_no}` : 'View Bill'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openSubBillUploadModal(selectedPO, sub)}
                                      className="text-[10px] text-gray-400 hover:text-[#8F1717] underline cursor-pointer"
                                      title="Re-upload bill"
                                    >
                                      Change
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openSubBillUploadModal(selectedPO, sub)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#8F1717] border border-dashed border-gray-300 hover:border-red-300 transition-colors cursor-pointer"
                                    title={`Upload Mill Bill for ${sub.sub_order_no || sub.subOrderNo}`}
                                  >
                                    <UploadCloud size={11} />
                                    <span>Upload Bill</span>
                                  </button>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPODetailOpen(false);
                                    handleOpenLoadForSub(selectedPO, sub);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#8F1717] hover:bg-[#771212] text-white font-semibold text-[11px] shadow-2xs cursor-pointer transition-colors"
                                  title={`Load Vehicle for Sub-Order (${remQty.toFixed(2)} QTL pending)`}
                                >
                                  <Truck size={11} />
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
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => printPODocument(selectedPO)}
                className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 flex items-center gap-1.5 hover:bg-gray-50"
              >
                <Printer size={14} />
                <span>Print Document</span>
              </button>
              {(selectedPO.status === 'New' || selectedPO.status === 'Pending Acceptance') && (
                <button
                  onClick={() => { handleAcceptPO(selectedPO); setIsPODetailOpen(false); }}
                  className="px-4 py-1.5 bg-[#8F1717] hover:bg-[#771212] text-white rounded-xl font-semibold shadow-xs"
                >
                  Accept PO
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: RAISE QUERY */}
      <Modal
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        title="Raise Clarification Query"
        subtitle={selectedPO ? `Submit query to Admin for PO ${selectedPO.po_number}` : ''}
      >
        <form onSubmit={handleSubmitQuery} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Query / Clarification Details *</label>
            <textarea
              required
              rows={4}
              value={queryForm.queryText}
              onChange={e => setQueryForm({ queryText: e.target.value })}
              placeholder="e.g. Please clarify bagging requirements (50kg gunny bags or 25kg PP bags), or specify vehicle unloading dock."
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsQueryModalOpen(false)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#8F1717] text-white font-semibold rounded-xl shadow-xs"
            >
              Send Query to Admin
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: REQUEST RESCHEDULE */}
      <Modal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        title="Request Rescheduled Date"
        subtitle={selectedPO ? `Propose revised loading date for PO ${selectedPO.po_number}` : ''}
      >
        <form onSubmit={handleSubmitReschedule} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Proposed Revised Loading Date *</label>
            <input
              type="date"
              required
              value={rescheduleForm.revisedDate}
              onChange={e => setRescheduleForm(prev => ({ ...prev, revisedDate: e.target.value }))}
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Reason for Reschedule</label>
            <textarea
              rows={3}
              value={rescheduleForm.reason}
              onChange={e => setRescheduleForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Mill processing maintenance in progress; grain polishing complete by Tuesday morning."
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsRescheduleModalOpen(false)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#8F1717] text-white font-semibold rounded-xl shadow-xs"
            >
              Submit Proposal
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: CHRONOLOGICAL PO LEDGER */}
      <Modal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        title={selectedPO ? `PO Chronological Ledger — ${selectedPO.po_number}` : 'PO Ledger'}
        subtitle="Complete audit history of activities, loadings, documents, and status transitions"
        maxWidth="max-w-xl"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
          {loadingLedger ? (
            <div className="py-8 text-center text-gray-400">Loading ledger timeline...</div>
          ) : poLedgerEvents.length > 0 ? (
            poLedgerEvents.map(evt => (
              <div key={evt.id} className="p-3 bg-gray-50 border-l-4 border-[#8F1717] rounded-r-xl">
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span className="font-mono">{evt.timestamp || evt.created_at}</span>
                  <span className="font-semibold text-gray-600">{evt.performed_by || evt.actor || 'System'}</span>
                </div>
                <div className="font-bold text-gray-800">{evt.event_type || evt.title}</div>
                <p className="text-gray-600 mt-0.5">{evt.description}</p>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400">No ledger entries recorded yet.</div>
          )}
        </div>
      </Modal>

      {/* MODAL 5: RECORD LOADING */}
      <Modal
        isOpen={isLoadingModalOpen}
        onClose={() => setIsLoadingModalOpen(false)}
        title="Record Vehicle Loading Entry"
        subtitle="Log grain loading for a purchase order (overload prevention enforced)"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateLoading} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Target Purchase Order *</label>
            <select
              required
              value={loadingForm.poId}
              onChange={e => {
                const poId = e.target.value;
                const po = purchaseOrders.find(p => String(p.id) === String(poId));
                setLoadingForm(prev => ({
                  ...prev,
                  poId,
                  subOrderNo: '',
                  loadingQuantity: po ? (po.remaining_quantity || po.ordered_quantity || '') : '',
                  loadingLocation: po?.delivery_location || 'Mill Facility'
                }));
              }}
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none bg-white font-mono"
            >
              <option value="">Select PO...</option>
              {purchaseOrders.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled').map(p => (
                <option key={p.id} value={p.id}>
                  {p.po_number} — {p.product_name} ({p.ordered_quantity} QTL)
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Order Selector */}
          {(() => {
            const currentPo = purchaseOrders.find(p => String(p.id) === String(loadingForm.poId));
            const subList = currentPo?.sub_orders || [];
            if (subList.length === 0) return null;
            return (
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-blue-900">
                    Select Sub-Order to Load (Supplier Choice)
                  </label>
                  <span className="text-[10px] text-blue-700 font-mono">
                    Partial loading allowed
                  </span>
                </div>
                <select
                  value={loadingForm.subOrderNo}
                  onChange={e => {
                    const subNo = e.target.value;
                    const sub = subList.find(s => (s.sub_order_no || s.subOrderNo) === subNo);
                    const rem = sub ? Math.max(0, Number(sub.ordered_quantity || sub.orderedQuantity || 0) - Number(sub.loaded_quantity || sub.loadedQuantity || 0)) : (currentPo?.remaining_quantity || currentPo?.ordered_quantity || '');
                    setLoadingForm(prev => ({
                      ...prev,
                      subOrderNo: subNo,
                      loadingQuantity: rem ? Number(rem).toFixed(2) : prev.loadingQuantity,
                      loadingLocation: sub?.delivery_location || prev.loadingLocation
                    }));
                  }}
                  className="w-full p-2.5 border border-blue-300 rounded-xl bg-white font-mono text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="">Entire PO (All Consignees / Unspecified)</option>
                  {subList.map((sub, sIdx) => {
                    const subNo = sub.sub_order_no || sub.subOrderNo || `Sub #${sIdx + 1}`;
                    const ordQty = Number(sub.ordered_quantity || sub.orderedQuantity || 0);
                    const ldQty = Number(sub.loaded_quantity || sub.loadedQuantity || 0);
                    const remQty = Math.max(0, ordQty - ldQty);
                    return (
                      <option key={subNo} value={subNo}>
                        {subNo} — {sub.buyer_name || sub.buyerName} | Ordered: {ordQty} QTL | Loaded: {ldQty} QTL | Pending: {remQty.toFixed(2)} QTL
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-blue-700 mt-1.5">
                  💡 Supplier can load partial quantity now (e.g. 10 QTL) and load remaining balance in a later vehicle entry.
                </p>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Loading Date *</label>
              <input
                type="date"
                required
                value={loadingForm.loadingDate}
                onChange={e => setLoadingForm(prev => ({ ...prev, loadingDate: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Quantity Loaded (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 35.5"
                value={loadingForm.loadingQuantity}
                onChange={e => setLoadingForm(prev => ({ ...prev, loadingQuantity: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Vehicle Registration No *</label>
              <input
                type="text"
                required
                placeholder="e.g. MH-31-CB-8821"
                value={loadingForm.vehicleNumber}
                onChange={e => setLoadingForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Driver Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +91 98220 11223"
                value={loadingForm.driverPhone}
                onChange={e => setLoadingForm(prev => ({ ...prev, driverPhone: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Loading Facility / Yard</label>
            <input
              type="text"
              placeholder="e.g. Balaji Modern Mill Yard No. 2"
              value={loadingForm.loadingLocation}
              onChange={e => setLoadingForm(prev => ({ ...prev, loadingLocation: e.target.value }))}
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsLoadingModalOpen(false)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#8F1717] text-white font-semibold rounded-xl shadow-xs"
            >
              Record & Sync Loading
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: UPLOAD BILL / SLIP */}
      <Modal
        isOpen={isDocUploadModalOpen}
        onClose={() => setIsDocUploadModalOpen(false)}
        title="Upload Document / Slip"
        subtitle="Link invoice, weighbridge slip or LR copy to a PO"
      >
        <form onSubmit={handleSaveDocument} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Linked Purchase Order *</label>
            <select
              required
              value={docForm.poId}
              onChange={e => setDocForm(prev => ({ ...prev, poId: e.target.value }))}
              className="w-full p-2.5 border border-gray-200 rounded-xl font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none bg-white"
            >
              <option value="">Select PO...</option>
              {purchaseOrders.map(p => (
                <option key={p.id} value={p.id}>{p.po_number} — {p.product_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Document Category *</label>
            <select
              value={docForm.documentType}
              onChange={e => setDocForm(prev => ({ ...prev, documentType: e.target.value }))}
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none bg-white font-medium"
            >
              <option value="Supplier Invoice">Supplier Invoice</option>
              <option value="Weighbridge Slip">Weighbridge Slip</option>
              <option value="Loading Receipt">Loading Receipt</option>
              <option value="LR Copy">LR Copy (Lorry Receipt)</option>
              <option value="Quality Inspection">Quality Inspection Certificate</option>
              <option value="Other">Other Document</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Select File (PDF or Image) *</label>
            <input
              type="file"
              required
              accept="application/pdf,image/*"
              onChange={handleFileUpload}
              className="w-full p-2 border border-gray-200 rounded-xl focus:outline-none"
            />
            {docForm.fileName && (
              <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
                Selected: {docForm.fileName} ({Math.round(docForm.fileSize / 1024)} KB)
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsDocUploadModalOpen(false)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#8F1717] text-white font-semibold rounded-xl shadow-xs"
            >
              Upload & Sync
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 7: CONFIRM DISPATCH */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Confirm Vehicle Dispatch"
        subtitle="Record transport release and notify customer"
      >
        <form onSubmit={handleCreateDispatch} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Dispatch Date *</label>
              <input
                type="date"
                required
                value={dispatchForm.dispatchDate}
                onChange={e => setDispatchForm(prev => ({ ...prev, dispatchDate: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Quantity Dispatched (QTL) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={dispatchForm.dispatchQuantity}
                onChange={e => setDispatchForm(prev => ({ ...prev, dispatchQuantity: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Vehicle Registration *</label>
              <input
                type="text"
                required
                value={dispatchForm.vehicleNumber}
                onChange={e => setDispatchForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl font-mono uppercase focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Driver Phone</label>
              <input
                type="tel"
                value={dispatchForm.driverPhone}
                onChange={e => setDispatchForm(prev => ({ ...prev, driverPhone: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsDispatchModalOpen(false)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#8F1717] text-white font-semibold rounded-xl shadow-xs"
            >
              Confirm Dispatch
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 8: SUB-ORDER MILL BILL UPLOAD */}
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
                className="w-full p-2 bg-white border border-gray-200 rounded font-mono font-bold text-gray-800 focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                Enter the bill number issued by the rice mill for this specific buyer's sub-order.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">
                Select Bill Document (PDF or Image) *
              </label>
              <div className="border-2 border-dashed border-gray-200 hover:border-[#8F1717] rounded-xl p-4 text-center bg-gray-50/50 transition-colors">
                <input
                  type="file"
                  id="supplierSubOrderBillFile"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleSubBillFileSelect}
                  className="hidden"
                />
                <label htmlFor="supplierSubOrderBillFile" className="cursor-pointer flex flex-col items-center justify-center gap-2">
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

            <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
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

      {/* MODAL 9: SUB-ORDER MILL BILL PREVIEW */}
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
                  <span>Open Full View</span>
                </a>
                <a
                  href={billPreviewModal.billUrl}
                  download={billPreviewModal.fileName || `Bill_${billPreviewModal.subOrderNo}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 rounded transition-colors shadow-2xs"
                >
                  <Download size={12} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteSubOrderBill(billPreviewModal.poId, billPreviewModal.subOrderNo)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 rounded transition-colors shadow-2xs cursor-pointer"
                  title="Remove uploaded bill file"
                >
                  <Trash2 size={12} />
                  <span>Delete Bill</span>
                </button>
              </div>
            </div>

            {/* Document Viewer Frame */}
            <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center min-h-[420px] max-h-[600px]">
              {billPreviewModal.fileName?.toLowerCase().endsWith('.pdf') || billPreviewModal.billUrl?.toLowerCase().includes('.pdf') ? (
                <iframe
                  src={billPreviewModal.billUrl}
                  title={`Bill Document - ${billPreviewModal.subOrderNo}`}
                  className="w-full h-[520px] border-none"
                />
              ) : (
                <img
                  src={billPreviewModal.billUrl}
                  alt={`Bill Document - ${billPreviewModal.subOrderNo}`}
                  className="max-h-[520px] max-w-full object-contain p-2"
                />
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setBillPreviewModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
