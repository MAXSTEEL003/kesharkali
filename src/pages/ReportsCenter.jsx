// src/pages/ReportsCenter.jsx
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Filter, 
  Factory, 
  Users, 
  ShoppingCart, 
  Warehouse, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { api, downloadBlob } from '../api';

export default function ReportsCenter() {
  const [activeTab, setActiveTab] = useState('loading'); // 'loading', 'industry', 'buyer', 'po', 'stock'
  const [reportData, setReportData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [industryId, setIndustryId] = useState('');

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [custRes, indRes] = await Promise.all([
          api.customers.getAll(),
          api.industries.getAll()
        ]);
        setCustomers(custRes.customers || []);
        setIndustries(indRes.industries || []);
      } catch (err) {
        console.error('Failed to load catalogs:', err);
      }
    }
    loadCatalogs();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      let res;
      if (activeTab === 'loading') {
        res = await api.reports.getMasterLoading({ startDate, endDate, buyerId, industryId });
      } else if (activeTab === 'industry') {
        res = await api.reports.getIndustryWise({ startDate, endDate, industryId });
      } else if (activeTab === 'buyer') {
        res = await api.reports.getBuyerWise({ startDate, endDate, buyerId });
      } else if (activeTab === 'po') {
        res = await api.reports.getPOFulfillment();
      } else if (activeTab === 'stock') {
        res = await api.stock.getSummary();
      }
      setReportData(res.report || res.summary || []);
    } catch (err) {
      alert(`Report query failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, startDate, endDate, buyerId, industryId]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const dateStr = new Date().toISOString().split('T')[0];
      let blob;
      let filename;

      if (activeTab === 'loading') {
        blob = await api.reports.exportMasterLoading({ startDate, endDate, buyerId, industryId });
        filename = `Keshar_Kali_Master_Loading_${dateStr}.xlsx`;
      } else if (activeTab === 'industry') {
        blob = await api.reports.exportIndustryWise({ startDate, endDate, industryId });
        filename = `Keshar_Kali_Industry_Wise_${dateStr}.xlsx`;
      } else if (activeTab === 'buyer') {
        blob = await api.reports.exportBuyerWise({ startDate, endDate, buyerId });
        filename = `Keshar_Kali_Buyer_Wise_${dateStr}.xlsx`;
      } else if (activeTab === 'po') {
        blob = await api.reports.exportPOFulfillment();
        filename = `Keshar_Kali_PO_Fulfillment_${dateStr}.xlsx`;
      } else if (activeTab === 'stock') {
        blob = await api.reports.exportStockLedger({});
        filename = `Keshar_Kali_Stock_Report_${dateStr}.xlsx`;
      }

      if (blob) {
        downloadBlob(blob, filename);
      }
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'loading', label: 'Master Loading Register', icon: FileSpreadsheet },
    { id: 'industry', label: 'Industry-wise Sourcing', icon: Factory },
    { id: 'buyer', label: 'Buyer-wise Performance', icon: Users },
    { id: 'po', label: 'PO Fulfillment Pipeline', icon: ShoppingCart },
    { id: 'stock', label: 'Stock & Inventory Ledger', icon: Warehouse },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#8F1717]" />
            Business Reports & Automatic Genuine Excel Exports
          </h1>
          <p className="text-xs text-[#777777]">
            Realized transactional reports with authentic formatting, frozen headers, and grand totals
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md transition-colors shadow-xs"
        >
          <Download size={15} />
          <span>{exporting ? 'Generating XLSX...' : 'Download Genuine Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8E2DC] bg-white rounded-t-lg px-2 pt-2 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-md transition-colors whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#8F1717] text-[#8F1717] bg-[#FAF9F6]'
                  : 'border-transparent text-gray-500 hover:text-[#252525]'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[#8F1717]' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white rounded-b-lg border-x border-b border-[#E8E2DC] p-3 -mt-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="From Date"
          className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="To Date"
          className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
        />

        {(activeTab === 'loading' || activeTab === 'buyer') && (
          <select
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Buyers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {(activeTab === 'loading' || activeTab === 'industry') && (
          <select
            value={industryId}
            onChange={(e) => setIndustryId(e.target.value)}
            className="p-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
          >
            <option value="">All Rice Mills</option>
            {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
      </div>

      {/* Live Preview Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-500">Querying database records...</div>
          ) : reportData.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">No report records found for selected filters.</div>
          ) : (
            <table className="excel-grid">
              {activeTab === 'loading' && (
                <>
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="text-center">Date</th>
                      <th className="text-left">Loading ID</th>
                      <th className="text-left">PO #</th>
                      <th className="text-left">Buyer</th>
                      <th className="text-left">Product</th>
                      <th className="text-left">Industry Mill</th>
                      <th className="text-center">Fulfillment</th>
                      <th className="text-center">Vehicle</th>
                      <th className="text-right">Quantity (QTL)</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount (₹)</th>
                      <th className="text-center">Dispatch Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                        <td className="text-center text-xs">{r.loading_date}</td>
                        <td className="font-semibold text-[#8F1717]">{r.loading_number}</td>
                        <td className="font-semibold">{r.po_number}</td>
                        <td>{r.customer_name}</td>
                        <td>{r.product_name}</td>
                        <td>{r.industry_name}</td>
                        <td className="text-center">{r.fulfillment_type}</td>
                        <td className="text-center font-mono">{r.vehicle_number}</td>
                        <td className="text-right font-mono font-bold">{r.loading_quantity}</td>
                        <td className="text-right font-mono">₹{r.purchase_rate}</td>
                        <td className="text-right font-mono font-semibold">₹{Number(r.loading_amount).toLocaleString('en-IN')}</td>
                        <td className="text-center">{r.dispatch_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === 'industry' && (
                <>
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="text-left">Industry (Rice Mill)</th>
                      <th className="text-center">Date</th>
                      <th className="text-left">Loading ID</th>
                      <th className="text-left">Customer PO</th>
                      <th className="text-left">Buyer</th>
                      <th className="text-left">Product</th>
                      <th className="text-center">Vehicle</th>
                      <th className="text-right">Loaded QTL</th>
                      <th className="text-right">Purchase Rate</th>
                      <th className="text-right">Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                        <td className="font-semibold text-[#8F1717]">{r.industry_name}</td>
                        <td className="text-center text-xs">{r.loading_date}</td>
                        <td className="font-mono">{r.loading_number}</td>
                        <td className="font-semibold">{r.po_number}</td>
                        <td>{r.customer_name}</td>
                        <td>{r.product_name}</td>
                        <td className="text-center font-mono">{r.vehicle_number}</td>
                        <td className="text-right font-mono font-bold text-indigo-700">{r.loading_quantity}</td>
                        <td className="text-right font-mono">₹{r.purchase_rate}</td>
                        <td className="text-right font-mono font-bold">₹{Number(r.loading_amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === 'buyer' && (
                <>
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="text-left">Buyer / Customer</th>
                      <th className="text-left">PO Number</th>
                      <th className="text-center">PO Date</th>
                      <th className="text-left">Product</th>
                      <th className="text-right">Ordered QTL</th>
                      <th className="text-right">Loaded QTL</th>
                      <th className="text-right">Dispatched QTL</th>
                      <th className="text-right">Remaining QTL</th>
                      <th className="text-right">Selling Rate</th>
                      <th className="text-right">Order Value</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                        <td className="font-semibold text-[#8F1717]">{r.customer_name}</td>
                        <td className="font-semibold">{r.po_number}</td>
                        <td className="text-center text-xs">{r.po_date}</td>
                        <td>{r.product_name}</td>
                        <td className="text-right font-mono font-bold">{r.ordered_quantity}</td>
                        <td className="text-right font-mono text-purple-700">{r.loaded_quantity}</td>
                        <td className="text-right font-mono text-emerald-700 font-bold">{r.dispatched_quantity}</td>
                        <td className="text-right font-mono text-amber-700 font-bold">{r.remaining_quantity}</td>
                        <td className="text-right font-mono">₹{r.customer_selling_rate}</td>
                        <td className="text-right font-mono font-bold">₹{Number(r.order_value).toLocaleString('en-IN')}</td>
                        <td className="text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === 'po' && (
                <>
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="text-left">PO Number</th>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Product</th>
                      <th className="text-right">Ordered QTL</th>
                      <th className="text-right">Allocated QTL</th>
                      <th className="text-right">Loaded QTL</th>
                      <th className="text-right">Dispatched QTL</th>
                      <th className="text-right">Pending Loading</th>
                      <th className="text-right">Pending Dispatch</th>
                      <th className="text-right">Fulfillment %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, idx) => {
                      const pct = ((Number(r.dispatched_quantity) / Number(r.ordered_quantity)) * 100).toFixed(1);
                      return (
                        <tr key={r.po_number || idx}>
                          <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                          <td className="font-semibold text-[#8F1717]">{r.po_number}</td>
                          <td className="font-medium">{r.customer_name}</td>
                          <td>{r.product_name}</td>
                          <td className="text-right font-mono font-bold">{r.ordered_quantity}</td>
                          <td className="text-right font-mono text-purple-700">{r.allocated_quantity}</td>
                          <td className="text-right font-mono text-indigo-700">{r.loaded_quantity}</td>
                          <td className="text-right font-mono text-emerald-700 font-bold">{r.dispatched_quantity}</td>
                          <td className="text-right font-mono text-amber-700">{r.pending_loading}</td>
                          <td className="text-right font-mono text-orange-700">{r.pending_dispatch}</td>
                          <td className="text-right font-mono font-bold text-emerald-800">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}

              {activeTab === 'stock' && (
                <>
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="text-left">Product Code</th>
                      <th className="text-left">Product Name</th>
                      <th className="text-left">Brand</th>
                      <th className="text-right">Opening Stock</th>
                      <th className="text-right">Total Inward</th>
                      <th className="text-right">Total Outward</th>
                      <th className="text-right">Physical Balance</th>
                      <th className="text-right">Reserved Stock</th>
                      <th className="text-right">Available Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, idx) => (
                      <tr key={r.productId || idx}>
                        <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                        <td className="font-mono text-xs">{r.productCode}</td>
                        <td className="font-semibold text-[#252525]">{r.productName}</td>
                        <td>{r.brand}</td>
                        <td className="text-right font-mono">{r.openingStock}</td>
                        <td className="text-right font-mono text-emerald-700">+{r.totalInward}</td>
                        <td className="text-right font-mono text-red-700">-{r.totalOutward}</td>
                        <td className="text-right font-mono font-bold text-[#8F1717]">{r.physicalBalance}</td>
                        <td className="text-right font-mono text-amber-700">{r.reservedQuantity}</td>
                        <td className="text-right font-mono font-bold text-emerald-700">{r.availableQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

