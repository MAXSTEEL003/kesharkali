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
  ChevronLeft, 
  X, 
  ShieldCheck, 
  UserCheck, 
  Clock, 
  PlusCircle,
  Inbox,
  PackageCheck,
  Scale,
  RefreshCw
} from 'lucide-react';
import { getRole, setRole } from '../api';

export default function Layout({ activePage, setActivePage, children, onOpenQuickAction }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stockMenuOpen, setStockMenuOpen] = useState(false);
  const [loadingMenuOpen, setLoadingMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [currentRoleState, setCurrentRoleState] = useState(getRole());
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      return localStorage.getItem('keshar_kali_logo') || '/logo.svg';
    } catch {
      return '/logo.svg';
    }
  });
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGlobalRefresh = () => {
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent('portal-refresh-data'));
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  };

  useEffect(() => {
    const handleLogoUpdate = (e) => {
      const url = e.detail?.logoUrl || localStorage.getItem('keshar_kali_logo') || '/logo.svg';
      setLogoUrl(url);
    };
    window.addEventListener('company-logo-updated', handleLogoUpdate);
    return () => window.removeEventListener('company-logo-updated', handleLogoUpdate);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRoleToggle = () => {
    const next = currentRoleState === 'Admin' ? 'Operator' : currentRoleState === 'Operator' ? 'Supplier' : 'Admin';
    setRole(next);
    setCurrentRoleState(next);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'supplier-dashboard', label: 'Supplier Workspace', icon: Factory },
    { id: 'purchase-orders', label: 'Received POs', icon: Inbox },
    { id: 'industry-sourcing', label: 'Industry Sourcing', icon: Factory },
    { id: 'stock-management', label: 'Stock Management', icon: Warehouse },
    { id: 'master-loading-register', label: 'Master Loading Register', icon: Truck },
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
    { id: 'industries', label: 'Rice Mills & Industries', icon: Factory },
    { id: 'products', label: 'Products', icon: Layers },
    { id: 'settings', label: 'Settings & Audit Logs', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F8F4EE] overflow-hidden text-[#252525] relative">
      {/* Background luminous ambient lights for glass refraction */}
      <div className="fixed -top-20 right-10 w-[550px] h-[350px] bg-gradient-to-br from-[#C69A3B]/30 via-amber-500/20 to-transparent rounded-full blur-[80px] pointer-events-none -z-0" />
      <div className="fixed -top-10 left-60 w-[500px] h-[350px] bg-gradient-to-br from-[#8F1717]/25 via-rose-500/15 to-transparent rounded-full blur-[85px] pointer-events-none -z-0" />
      <div className="fixed bottom-10 right-20 w-[550px] h-[450px] bg-gradient-to-tr from-emerald-500/20 via-[#C69A3B]/15 to-transparent rounded-full blur-[100px] pointer-events-none -z-0" />
      <div className="fixed top-1/2 left-1/3 -translate-y-1/2 w-[450px] h-[450px] bg-gradient-to-br from-[#5E1010]/15 to-[#C69A3B]/10 rounded-full blur-[110px] pointer-events-none -z-0" />

      {/* Floating Translucent Glass Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-20'} my-3 ml-3 h-[calc(100vh-1.5rem)] rounded-3xl transition-all duration-300 glass-sidebar text-white flex flex-col z-30 shrink-0 overflow-hidden`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 bg-[#8F1717]/85 backdrop-blur-md border-b border-[#C69A3B]/40">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C69A3B] to-[#b08730] flex items-center justify-center font-bold text-xs text-[#5E1010] shadow-[0_0_12px_rgba(198,154,59,0.5)] shrink-0 font-['Space_Grotesk']">
                  KK
                </div>
                <div className="leading-tight truncate">
                  <span className="font-bold text-sm tracking-wider uppercase font-['Space_Grotesk',sans-serif]">Keshar Kali</span>
                  <span className="block text-[10px] text-[#C69A3B] font-medium tracking-tight">Precision in Every Grain</span>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all shadow-xs group"
                title="Expand sidebar"
              >
                <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasSub = !!item.subItems;
            const isSubActive = hasSub && item.subItems.some(sub => sub.id === activePage);
            const isDirectActive = activePage === item.id || (item.id === 'stock-management' && (activePage === 'stock' || activePage === 'stock-management' || activePage.startsWith('stock-')));
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
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="mx-auto text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight size={16} />
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

      {/* Main Content Area: Content smoothly glides under the floating glass navbar */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-10">
        {/* Floating Top Navbar Island */}
        <header className="sticky top-3 z-30 mx-3 md:mx-6 my-2 h-16 glass-nav rounded-2xl flex items-center justify-between px-6 shrink-0 transition-all">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="text-[#8F1717] hover:bg-white/60 p-2 rounded-xl transition-colors border border-white/40 shadow-xs"
                title="Expand sidebar"
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div 
                onClick={() => setActivePage('dashboard')} 
                className="cursor-pointer flex items-center transition-transform hover:scale-[1.02] active:scale-95"
                title="Keshar Kali — Dashboard"
              >
                <img 
                  src={logoUrl || "/logo.svg"} 
                  alt="Keshar Kali" 
                  className="h-7 md:h-8 w-auto max-w-[170px] object-contain drop-shadow-xs"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'inline-flex';
                    }
                  }}
                />
                <span className="hidden text-xs uppercase tracking-wider font-bold text-[#8F1717]">
                  Keshar Kali
                </span>
              </div>
              <span className="text-gray-300 text-sm font-light">/</span>
              <span className="text-xs font-semibold text-[#252525] capitalize bg-black/5 px-2.5 py-1 rounded-lg">
                {activePage.replace(/-/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Clock */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#555555] font-mono bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/60 shadow-xs">
              <Clock size={12} className="text-[#8F1717]" />
              <span>{time} IST</span>
            </div>

            {/* Quick Refresh Page Trigger */}
            <button
              onClick={handleGlobalRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs text-[#555555] hover:text-[#8F1717] bg-white/50 hover:bg-white/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/60 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh Application Data"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#8F1717]' : ''} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            {/* Quick Actions Dropdown / Modal Trigger */}
            <button
              onClick={() => onOpenQuickAction && onOpenQuickAction('po')}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#8F1717] to-[#771212] hover:from-[#771212] hover:to-[#5E1010] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl border border-[#C69A3B]/50 shadow-[0_0_14px_rgba(143,23,23,0.35)] hover:shadow-[0_0_20px_rgba(143,23,23,0.55)] transition-all"
              title="Record incoming customer purchase order received by Keshar Kali"
            >
              <Inbox size={14} className="text-[#C69A3B]" />
              <span>Receive PO</span>
            </button>

            <button
              onClick={() => onOpenQuickAction && onOpenQuickAction('loading')}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#5E1010] to-[#480c0c] hover:from-[#480c0c] hover:to-[#380909] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl border border-white/30 shadow-[0_0_14px_rgba(94,16,16,0.35)] hover:shadow-[0_0_20px_rgba(94,16,16,0.55)] transition-all"
            >
              <Truck size={14} />
              <span className="hidden sm:inline">Add Loading</span>
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="p-3 md:p-6 pt-1 flex-1 bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}

