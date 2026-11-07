// src/components/Layout.jsx
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Factory, 
  Warehouse, 
  Truck, 
  Send, 
  MessageSquare, 
  FileSpreadsheet, 
  Users, 
  Layers, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  Menu, 
  X, 
  ShieldCheck, 
  UserCheck, 
  Clock, 
  PlusCircle,
  Inbox,
  PackageCheck,
  Scale
} from 'lucide-react';
import { getRole, setRole } from '../api';

export default function Layout({ activePage, setActivePage, children, onOpenQuickAction }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stockMenuOpen, setStockMenuOpen] = useState(false);
  const [loadingMenuOpen, setLoadingMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [currentRoleState, setCurrentRoleState] = useState(getRole());
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRoleToggle = () => {
    const next = currentRoleState === 'Admin' ? 'Operator' : 'Admin';
    setRole(next);
    setCurrentRoleState(next);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'purchase-orders', label: 'Received POs', icon: Inbox },
    { id: 'industry-sourcing', label: 'Industry Sourcing', icon: Factory },
    { 
      id: 'stock', 
      label: 'Stock Management', 
      icon: Warehouse,
      subItems: [
        { id: 'stock-dashboard', label: 'Stock Dashboard' },
        { id: 'stock-ledger', label: 'Stock Ledger' },
        { id: 'stock-inward', label: 'Stock Inward' },
        { id: 'stock-outward', label: 'Stock Outward' },
        { id: 'stock-transfers', label: 'Stock Transfers' },
        { id: 'stock-adjustments', label: 'Stock Adjustments' },
        { id: 'stock-valuation', label: 'Stock Valuation & Summary' },
      ]
    },
    { 
      id: 'loading', 
      label: 'Loading Management', 
      icon: Truck,
      subItems: [
        { id: 'master-loading-register', label: 'Master Loading Register' },
        { id: 'pending-loadings', label: 'Pending Loadings' }
      ]
    },
    { id: 'dispatch-management', label: 'Dispatch Management', icon: Send },
    { id: 'customer-notifications', label: 'WhatsApp Notifications', icon: MessageSquare },
    { 
      id: 'reports', 
      label: 'Reports Center', 
      icon: FileSpreadsheet,
      subItems: [
        { id: 'reports-loading', label: 'Master Loading Excel' },
        { id: 'reports-industry', label: 'Industry-wise Reports' },
        { id: 'reports-buyer', label: 'Buyer-wise Reports' },
        { id: 'reports-po', label: 'PO Fulfillment Reports' },
        { id: 'reports-stock', label: 'Stock & Valuation Reports' }
      ]
    },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'industries', label: 'Industries (Confidential)', icon: Factory },
    { id: 'products', label: 'Products', icon: Layers },
    { id: 'warehouses', label: 'Warehouses / Godowns', icon: Warehouse },
    { id: 'settings', label: 'Settings & Audit Logs', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#FAF9F6] overflow-hidden text-[#252525]">
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-200 bg-[#5E1010] text-white flex flex-col z-30 shrink-0 border-r border-[#8F1717]/40 shadow-xl`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 bg-[#8F1717] border-b-2 border-[#C69A3B]">
          <div className={`flex items-center gap-2.5 overflow-hidden ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="w-8 h-8 rounded-full bg-[#C69A3B] flex items-center justify-center font-bold text-xs text-[#5E1010] shadow-sm shrink-0 font-['Space_Grotesk']">
              KK
            </div>
            {sidebarOpen && (
              <div className="leading-tight truncate">
                <span className="font-bold text-sm tracking-wider uppercase font-['Space_Grotesk',sans-serif]">Keshar Kali</span>
                <span className="block text-[10px] text-[#C69A3B] font-medium tracking-tight">Precision in Every Grain</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button 
              onClick={() => setSidebarOpen(false)}
              className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10"
              title="Collapse sidebar"
            >
              <Menu size={16} />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasSub = !!item.subItems;
            const isSubActive = hasSub && item.subItems.some(sub => sub.id === activePage);
            const isDirectActive = activePage === item.id;
            const isMenuOpen = item.id === 'stock' ? stockMenuOpen : item.id === 'loading' ? loadingMenuOpen : item.id === 'reports' ? reportsMenuOpen : false;

            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  onClick={() => {
                    if (hasSub) {
                      if (item.id === 'stock') setStockMenuOpen(!stockMenuOpen);
                      if (item.id === 'loading') setLoadingMenuOpen(!loadingMenuOpen);
                      if (item.id === 'reports') setReportsMenuOpen(!reportsMenuOpen);
                      if (!sidebarOpen) setSidebarOpen(true);
                    } else {
                      setActivePage(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isDirectActive || isSubActive 
                      ? 'bg-[#8F1717] text-white shadow-xs font-semibold' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon size={16} className={isDirectActive || isSubActive ? 'text-[#C69A3B]' : 'text-white/70'} />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </div>
                  {sidebarOpen && hasSub && (
                    <span className="text-white/60">
                      {isMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </button>

                {/* Submenu */}
                {sidebarOpen && hasSub && isMenuOpen && (
                  <div className="pl-7 pr-2 py-1 space-y-1 bg-black/15 rounded-md my-0.5">
                    {item.subItems.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setActivePage(sub.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] transition-colors ${
                          activePage === sub.id
                            ? 'bg-[#C69A3B] text-[#5E1010] font-bold shadow-xs'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Operator / Admin Mode Badge */}
        <div className="p-3 bg-black/20 border-t border-white/10">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                {currentRoleState === 'Admin' ? (
                  <ShieldCheck size={16} className="text-[#C69A3B]" />
                ) : (
                  <UserCheck size={16} className="text-emerald-400" />
                )}
                <div className="leading-tight">
                  <div className="text-xs font-semibold">{currentRoleState} Mode</div>
                  <div className="text-[10px] text-white/60">Keshar Kali Operations</div>
                </div>
              </div>
            ) : (
              <button onClick={() => setSidebarOpen(true)} className="mx-auto text-white/70 hover:text-white">
                <Menu size={16} />
              </button>
            )}

            {sidebarOpen && (
              <button
                onClick={handleRoleToggle}
                className="text-[10px] uppercase font-bold bg-[#8F1717] px-2 py-1 rounded border border-[#C69A3B] hover:bg-[#a61c1c] text-white transition-colors"
                title="Toggle between Admin and Operator role"
              >
                Switch
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 bg-white border-b border-[#E8E2DC] flex items-center justify-between px-6 z-20 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="text-[#8F1717] hover:bg-gray-100 p-1.5 rounded"
              >
                <Menu size={18} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-[#8F1717]">Keshar Kali</span>
              <span className="text-gray-300">/</span>
              <span className="text-xs font-semibold text-[#252525] capitalize">
                {activePage.replace(/-/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#777777] font-mono bg-[#FAF9F6] px-2.5 py-1 rounded border border-[#E8E2DC]">
              <Clock size={12} className="text-[#8F1717]" />
              <span>{time} IST</span>
            </div>

            {/* Quick Actions Dropdown / Modal Trigger */}
            <button
              onClick={() => onOpenQuickAction && onOpenQuickAction('po')}
              className="flex items-center gap-1.5 bg-[#8F1717] hover:bg-[#771212] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs transition-colors"
              title="Record incoming customer purchase order received by Keshar Kali"
            >
              <Inbox size={14} />
              <span>Receive PO</span>
            </button>

            <button
              onClick={() => onOpenQuickAction && onOpenQuickAction('loading')}
              className="flex items-center gap-1.5 bg-[#5E1010] hover:bg-[#480c0c] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs transition-colors"
            >
              <Truck size={14} />
              <span className="hidden sm:inline">Add Loading</span>
            </button>

            <button
              onClick={() => onOpenQuickAction && onOpenQuickAction('dispatch')}
              className="flex items-center gap-1.5 bg-[#C69A3B] hover:bg-[#b08730] text-[#5E1010] text-xs font-bold px-3 py-1.5 rounded-md shadow-xs transition-colors"
            >
              <Send size={14} />
              <span className="hidden sm:inline">Dispatch</span>
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#FAF9F6]">
          {children}
        </main>
      </div>
    </div>
  );
}

