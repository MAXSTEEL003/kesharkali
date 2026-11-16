// src/pages/Industries.jsx
// Unified Industry & Mill Godown Master Register (Merged with Warehouse & Godown storage facilities)
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Factory, 
  Warehouse, 
  Plus, 
  Phone, 
  MapPin, 
  Eye, 
  Edit, 
  Star, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Boxes,
  Search,
  RotateCcw,
  Filter
} from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';
import { formatDateDMY } from '../utils/date';
import { useNotification } from '../context/NotificationContext';

export default function Industries() {
  const { showToast, confirm } = useNotification();
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [industryDetails, setIndustryDetails] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [defaultFilter, setDefaultFilter] = useState('all'); // 'all' | 'default-only'

  // Add / Edit Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const initialFormState = {
    name: '',
    location: '',
    facility_type: 'Rice Mill & Attached Godown',
    capacity_qtl: '15000',
    contact_person: '',
    phone: '',
    available_products: '',
    default_purchase_rate: '',
    is_default: false,
    notes: ''
  };

  const [form, setForm] = useState(initialFormState);
  const [editForm, setEditForm] = useState({ id: null, ...initialFormState });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.industries.getAll();
      setIndustries(res.industries || []);
    } catch (err) {
      showToast(`Failed to load industries: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasActiveFilters = Boolean(search.trim() || defaultFilter !== 'all');

  const handleClearFilters = () => {
    setSearch('');
    setDefaultFilter('all');
  };

  const filteredIndustries = useMemo(() => {
    return industries.filter(ind => {
      if (defaultFilter === 'default-only' && Number(ind.is_default) !== 1) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match = (
          ind.name?.toLowerCase().includes(q) ||
          ind.location?.toLowerCase().includes(q) ||
          ind.facility_type?.toLowerCase().includes(q) ||
          ind.contact_person?.toLowerCase().includes(q) ||
          ind.phone?.toLowerCase().includes(q) ||
          ind.available_products?.toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      return true;
    });
  }, [industries, search, defaultFilter]);

  const handleViewIndustry = async (id) => {
    try {
      setSelectedIndustry(id);
      const res = await api.industries.getById(id);
      setIndustryDetails(res);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenEdit = (ind) => {
    setEditForm({
      id: ind.id,
      name: ind.name || '',
      location: ind.location || '',
      facility_type: ind.facility_type || 'Rice Mill & Attached Godown',
      capacity_qtl: ind.capacity_qtl ? String(ind.capacity_qtl) : '15000',
      contact_person: ind.contact_person || '',
      phone: ind.phone || '',
      available_products: ind.available_products || '',
      default_purchase_rate: ind.default_purchase_rate ? String(ind.default_purchase_rate) : '',
      is_default: !!ind.is_default,
      notes: ind.notes || ''
    });
    setIsEditOpen(true);
  };

  const handleCreateIndustry = async (e) => {
    e.preventDefault();
    try {
      await api.industries.create({
        ...form,
        is_default: form.is_default ? 1 : 0,
        capacity_qtl: Number(form.capacity_qtl) || 15000,
        default_purchase_rate: Number(form.default_purchase_rate) || 0
      });
      setIsAddOpen(false);
      setForm(initialFormState);
      loadData();
      showToast('Industry & Mill Godown created successfully!', 'success');
    } catch (err) {
      showToast(`Failed to create industry: ${err.message}`, 'error');
    }
  };

  const handleUpdateIndustry = async (e) => {
    e.preventDefault();
    try {
      await api.industries.update(editForm.id, {
        ...editForm,
        is_default: editForm.is_default ? 1 : 0,
        capacity_qtl: Number(editForm.capacity_qtl) || 15000,
        default_purchase_rate: Number(editForm.default_purchase_rate) || 0
      });
      setIsEditOpen(false);
      loadData();
      if (selectedIndustry === editForm.id) {
        handleViewIndustry(editForm.id);
      }
      showToast('Industry & Mill Godown updated successfully!', 'success');
    } catch (err) {
      showToast(`Failed to update industry: ${err.message}`, 'error');
    }
  };

  const handleSetDefault = async (ind) => {
    const ok = await confirm({
      title: 'Set Default Rice Mill',
      message: `Set "${ind.name}" as the preferred default rice mill / godown? All PO loadings & allocations will prioritize this facility by default.`,
      confirmText: 'Set as Default',
      type: 'warning'
    });
    if (!ok) return;

    try {
      await api.industries.setDefault(ind.id);
      loadData();
      if (selectedIndustry === ind.id) {
        handleViewIndustry(ind.id);
      }
      showToast(`"${ind.name}" is now set as the preferred default industry!`, 'success');
    } catch (err) {
      showToast(`Failed to set default: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
              <Factory size={18} className="text-[#8F1717]" />
              Industry & Mill Godown Master Register
            </h1>
            <span className="bg-red-100 text-[#8F1717] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              Confidential Sourcing Network
            </span>
          </div>
          <p className="text-xs text-[#777777] mt-0.5">
            Unified directory of internal supplier rice mills, attached godowns & warehouses, storage capacities, procurement benchmarks, and default sourcing partner
          </p>
        </div>

        <button
          onClick={() => {
            setForm(initialFormState);
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs cursor-pointer"
        >
          <Plus size={14} />
          <span>Add Rice Mill / Godown</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search Mill Name, Location, Contact Person, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={defaultFilter}
              onChange={(e) => setDefaultFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#E8E2DC] rounded text-xs focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            >
              <option value="all">All Sourcing Facilities ({industries.length})</option>
              <option value="default-only">⭐ Default Sourcing Partner Only</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded text-xs transition-colors cursor-pointer"
                title="Reset filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}

            {hasActiveFilters && (
              <span className="text-[11px] text-[#8F1717] font-semibold">
                Showing {filteredIndustries.length} of {industries.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Industries & Godowns Table */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="excel-grid">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="text-left">Industry / Rice Mill & Godown</th>
                <th className="text-left">Facility Type</th>
                <th className="text-left">Location</th>
                <th className="text-right">Storage Capacity</th>
                <th className="text-left">Contact Person & Phone</th>
                <th className="text-right">Standard Rate (₹)</th>
                <th className="text-right">Loaded QTL</th>
                <th className="text-right bg-[#700f0f]">Pending Loading (QTL)</th>
                <th className="text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndustries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-xs text-gray-400">
                    {hasActiveFilters ? (
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">No mills or facilities match your filter.</p>
                        <button
                          onClick={handleClearFilters}
                          className="text-xs text-[#8F1717] font-semibold hover:underline"
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : (
                      'No industries or mill facilities recorded.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredIndustries.map((ind, idx) => {
                  const isDefault = Number(ind.is_default) === 1;
                  return (
                    <tr key={ind.id} className={`hover:bg-amber-50/40 transition-colors ${isDefault ? 'bg-amber-50/20' : ''}`}>
                      <td className="text-center font-mono text-[11px] text-gray-400">{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span 
                            className="font-bold text-[#8F1717] cursor-pointer hover:underline"
                            onClick={() => handleViewIndustry(ind.id)}
                            title="Click to view full loading history"
                          >
                            {ind.name}
                          </span>
                          {isDefault && (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs"
                              title="Primary preferred default rice mill for all incoming POs and truck loadings"
                            >
                              <Star size={10} className="fill-white" />
                              <span>Default Preferred Mill</span>
                            </span>
                          )}
                        </div>
                        {ind.available_products && (
                          <span className="text-[10px] text-gray-500 block truncate max-w-xs mt-0.5">
                            Varieties: {ind.available_products}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                          <Warehouse size={11} className="text-gray-500" />
                          <span>{ind.facility_type || 'Rice Mill & Godown'}</span>
                        </span>
                      </td>
                      <td className="text-xs text-gray-700">
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-gray-400 shrink-0" />
                          <span>{ind.location}</span>
                        </div>
                      </td>
                      <td className="text-right font-mono text-xs font-semibold text-gray-700">
                        {Number(ind.capacity_qtl || 15000).toLocaleString('en-IN')} QTL
                      </td>
                      <td className="text-xs">
                        <div className="font-semibold text-gray-800">{ind.contact_person || '—'}</div>
                        {ind.phone && (
                          <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            <span>{ind.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="text-right font-mono font-semibold text-gray-900">
                        ₹{Number(ind.default_purchase_rate || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="text-right font-mono font-bold text-indigo-700">
                        {Number(ind.total_loaded_qtl || 0).toFixed(2)}
                      </td>
                      <td className="text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                        {Number(ind.pending_loading_qtl || 0).toFixed(2)}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Set Default Button */}
                          <button
                            type="button"
                            onClick={() => handleSetDefault(ind)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isDefault 
                                ? 'text-amber-500 hover:text-amber-600 bg-amber-50' 
                                : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'
                            }`}
                            title={isDefault ? 'Currently preferred default mill' : 'Set as preferred default mill'}
                          >
                            <Star size={14} className={isDefault ? 'fill-amber-500' : ''} />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ind)}
                            className="p-1.5 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Industry / Godown details"
                          >
                            <Edit size={14} />
                          </button>

                          {/* View Detail Button */}
                          <button
                            type="button"
                            onClick={() => handleViewIndustry(ind.id)}
                            className="p-1.5 rounded text-[#8F1717] hover:bg-red-50 transition-colors cursor-pointer"
                            title="View Mill Loading History"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Industry Detail Modal */}
      {selectedIndustry && industryDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedIndustry(null)}
          title={`Sourcing Partner Profile — ${industryDetails.industry.name}`}
          subtitle={`Location: ${industryDetails.industry.location} | Facility: ${industryDetails.industry.facility_type || 'Rice Mill & Godown'} | Contact: ${industryDetails.industry.contact_person || 'N/A'} (${industryDetails.industry.phone || 'N/A'})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Quick Profile Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">PREFERRED STATUS</span>
                {Number(industryDetails.industry.is_default) === 1 ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                    <Star size={12} className="fill-amber-500 text-amber-500" />
                    <span>Primary Default Mill</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(industryDetails.industry)}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Set as Default
                  </button>
                )}
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">STORAGE CAPACITY</span>
                <span className="font-mono font-bold text-gray-800">
                  {Number(industryDetails.industry.capacity_qtl || 15000).toLocaleString('en-IN')} QTL
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">STANDARD RATE</span>
                <span className="font-mono font-bold text-gray-800">
                  ₹{Number(industryDetails.industry.default_purchase_rate || 0).toLocaleString('en-IN')} / QTL
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">EDIT PROFILE</span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(industryDetails.industry)}
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                >
                  <Edit size={12} />
                  <span>Edit Mill & Godown</span>
                </button>
              </div>
            </div>

            {/* Loading Entries from this Mill */}
            <div className="bg-white p-3.5 rounded-lg border border-[#E8E2DC]">
              <h4 className="font-bold text-[#8F1717] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Truck Loading History</span>
                <span className="font-mono">{industryDetails.loadingEntries.length} Loadings</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="excel-grid">
                  <thead>
                    <tr>
                      <th className="text-left">Loading ID</th>
                      <th className="text-center">Date</th>
                      <th className="text-left">Customer PO</th>
                      <th className="text-left">Buyer</th>
                      <th className="text-left">Product</th>
                      <th className="text-center">Vehicle</th>
                      <th className="text-right">Quantity (QTL)</th>
                      <th className="text-right">Purchase Rate</th>
                      <th className="text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industryDetails.loadingEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-gray-400">
                          No truck loadings recorded from this mill yet.
                        </td>
                      </tr>
                    ) : (
                      industryDetails.loadingEntries.map(l => (
                        <tr key={l.id}>
                          <td className="font-semibold text-[#8F1717]">{l.loading_number}</td>
                          <td className="text-center font-mono text-xs">{formatDateDMY(l.loading_date)}</td>
                          <td className="font-semibold">{l.po_number}</td>
                          <td>{l.customer_name}</td>
                          <td>{l.product_name}</td>
                          <td className="text-center font-mono">{l.vehicle_number}</td>
                          <td className="text-right font-mono font-bold text-indigo-700">{l.loading_quantity}</td>
                          <td className="text-right font-mono">₹{l.purchase_rate}</td>
                          <td className="text-right font-mono font-bold">₹{Number(l.loading_amount).toLocaleString('en-IN')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Industry & Godown Modal */}
      {isAddOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddOpen(false)}
          title="Add Rice Mill & Attached Godown"
          subtitle="Register new processing mill facility, storage godown capacity, and benchmark purchase rate"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateIndustry} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#252525] mb-1">Industry / Mill Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Balaji Modern Rice Mill"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Location / Industrial Zone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bhandara Industrial Area"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Facility Type *</label>
                <select
                  value={form.facility_type}
                  onChange={(e) => setForm({ ...form, facility_type: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none cursor-pointer"
                >
                  <option value="Rice Mill & Attached Godown">Rice Mill & Attached Godown</option>
                  <option value="Processing Mill Unit">Processing Mill Unit</option>
                  <option value="Storage Godown / Silo Hub">Storage Godown / Silo Hub</option>
                  <option value="Warehouse Distribution Depot">Warehouse Distribution Depot</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Storage Capacity (QTL)</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={form.capacity_qtl}
                  onChange={(e) => setForm({ ...form, capacity_qtl: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Rameshji Balaji"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 94231 10001"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Available Rice Products</label>
                <input
                  type="text"
                  placeholder="e.g. Keshar Kali, Madhuram, HMT Sona"
                  value={form.available_products}
                  onChange={(e) => setForm({ ...form, available_products: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Standard Purchase Rate (₹/QTL)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2850.00"
                  value={form.default_purchase_rate}
                  onChange={(e) => setForm({ ...form, default_purchase_rate: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              <input
                type="checkbox"
                id="formIsDefault"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="w-4 h-4 text-[#8F1717] rounded cursor-pointer"
              />
              <label htmlFor="formIsDefault" className="font-semibold text-gray-800 cursor-pointer flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <span>Mark as Preferred Default Rice Mill / Godown for all Operations</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Internal Godown & Mill Notes</label>
              <textarea
                rows={2}
                placeholder="Sortex machine quality, weighbridge specs, loading capacity..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-[#E8E2DC] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs cursor-pointer"
              >
                Save Rice Mill
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Industry & Godown Modal */}
      {isEditOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Mill & Godown — ${editForm.name}`}
          subtitle="Update facility details, storage capacity, standard benchmark rate, and default preference"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleUpdateIndustry} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#252525] mb-1">Industry / Mill Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Location / Industrial Zone *</label>
                <input
                  type="text"
                  required
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Facility Type *</label>
                <select
                  value={editForm.facility_type}
                  onChange={(e) => setEditForm({ ...editForm, facility_type: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none cursor-pointer"
                >
                  <option value="Rice Mill & Attached Godown">Rice Mill & Attached Godown</option>
                  <option value="Processing Mill Unit">Processing Mill Unit</option>
                  <option value="Storage Godown / Silo Hub">Storage Godown / Silo Hub</option>
                  <option value="Warehouse Distribution Depot">Warehouse Distribution Depot</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Storage Capacity (QTL)</label>
                <input
                  type="number"
                  value={editForm.capacity_qtl}
                  onChange={(e) => setEditForm({ ...editForm, capacity_qtl: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Contact Person</label>
                <input
                  type="text"
                  value={editForm.contact_person}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Available Rice Products</label>
                <input
                  type="text"
                  value={editForm.available_products}
                  onChange={(e) => setEditForm({ ...editForm, available_products: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252525] mb-1">Standard Purchase Rate (₹/QTL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.default_purchase_rate}
                  onChange={(e) => setEditForm({ ...editForm, default_purchase_rate: e.target.value })}
                  className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              <input
                type="checkbox"
                id="editFormIsDefault"
                checked={editForm.is_default}
                onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                className="w-4 h-4 text-[#8F1717] rounded cursor-pointer"
              />
              <label htmlFor="editFormIsDefault" className="font-semibold text-gray-800 cursor-pointer flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <span>Mark as Preferred Default Rice Mill / Godown for all Operations</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Internal Godown & Mill Notes</label>
              <textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-[#E8E2DC] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
