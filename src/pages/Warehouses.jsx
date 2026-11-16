// src/pages/Warehouses.jsx
import React, { useState, useEffect } from 'react';
import { Warehouse, Plus, MapPin, Phone, User, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';

export default function Warehouses() {
  const { showToast } = useNotification();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    location: '',
    capacity_qtl: '15000',
    manager_name: '',
    contact_phone: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.warehouses.getAll();
      setWarehouses(res.warehouses || []);
    } catch (err) {
      showToast(`Failed to load warehouses: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    try {
      await api.warehouses.create(form);
      setIsAddOpen(false);
      setForm({
        name: '',
        location: '',
        capacity_qtl: '15000',
        manager_name: '',
        contact_phone: ''
      });
      showToast('Warehouse created successfully!', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#E8E2DC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#252525] font-['Space_Grotesk'] flex items-center gap-2">
            <Warehouse size={18} className="text-[#8F1717]" />
            Supplier Godowns & Warehouse Storage Facilities
          </h1>
          <p className="text-xs text-[#777777]">
            Physical storage hubs, capacities, weighbridges, and live capacity utilization
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#8F1717] hover:bg-[#771212] text-white px-3.5 py-1.5 rounded transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>Add Warehouse Godown</span>
        </button>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <div key={w.id} className="bg-white p-4 rounded-lg border border-[#E8E2DC] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#8F1717] text-sm">{w.name}</span>
                <span className="font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                  {w.occupancy_pct}% Full
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <MapPin size={13} className="shrink-0 text-gray-400" />
                <span>{w.location}</span>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-500">Current Occupied Stock:</span>
                  <span className="font-mono font-bold text-base text-[#252525]">{w.current_stock} QTL</span>
                </div>
                <div className="flex items-baseline justify-between mt-1 text-xs">
                  <span className="text-gray-400">Total Storage Capacity:</span>
                  <span className="font-mono text-gray-600">{w.capacity_qtl} QTL</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${w.occupancy_pct > 80 ? 'bg-amber-600' : 'bg-[#8F1717]'}`}
                    style={{ width: `${Math.min(100, w.occupancy_pct)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
              <span>Mgr: <strong>{w.manager_name || 'Assigned'}</strong></span>
              <span>{w.contact_phone || '—'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Warehouse Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Warehouse / Godown Facility"
        subtitle="Register new grain storage yard and capacity limit"
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#252525] mb-1">Godown Facility Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Central Godown - Yard 2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#252525] mb-1">Full Location Address *</label>
            <input
              type="text"
              required
              placeholder="e.g. Wardha Road, Butibori MIDC, Nagpur"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#252525] mb-1">Max Capacity (QTL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 15000"
                value={form.capacity_qtl}
                onChange={(e) => setForm({ ...form, capacity_qtl: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded font-mono focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#252525] mb-1">Godown Manager Name</label>
              <input
                type="text"
                placeholder="e.g. Prakash Jadhav"
                value={form.manager_name}
                onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#252525] mb-1">Manager Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +91 98223 33111"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full p-2 bg-[#FAF9F6] border border-[#E8E2DC] rounded focus:ring-1 focus:ring-[#8F1717] focus:outline-none"
              />
            </div>
          </div>

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
              className="px-5 py-2 font-semibold bg-[#8F1717] text-white rounded hover:bg-[#771212] shadow-xs"
            >
              Save Warehouse
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

