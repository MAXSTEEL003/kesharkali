// src/App.jsx
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PurchaseOrders from './pages/PurchaseOrders';
import IndustrySourcing from './pages/IndustrySourcing';
import StockManagement from './pages/StockManagement';
import MasterLoadingRegister from './pages/MasterLoadingRegister';
import CustomerNotifications from './pages/CustomerNotifications';
import ReportsCenter from './pages/ReportsCenter';
import Customers from './pages/Customers';
import Industries from './pages/Industries';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Settings from './pages/Settings';
import SupplierDashboard from './pages/SupplierDashboard';
import { FirebaseAuthProvider } from './firebase/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

const VALID_PAGES = new Set([
  'dashboard',
  'supplier-dashboard',
  'purchase-orders',
  'industry-sourcing',
  'stock-management',
  'stock',
  'master-loading-register',
  'dispatch-management',
  'pending-loadings',
  'customer-notifications',
  'reports-loading',
  'reports-industry',
  'reports-buyer',
  'reports-po',
  'reports-stock',
  'reports',
  'customers',
  'industries',
  'warehouses',
  'products',
  'settings'
]);

function getInitialNavigation() {
  try {
    const rawHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    if (rawHash) {
      if (rawHash.startsWith('stock-')) {
        const tab = rawHash.replace('stock-', '');
        return { page: 'stock-management', stockTab: tab === 'dashboard' ? 'overview' : tab };
      }
      if (VALID_PAGES.has(rawHash) || rawHash.startsWith('reports-')) {
        return { page: rawHash, stockTab: localStorage.getItem('kk_stock_tab') || 'ledger' };
      }
    }
    const savedPage = localStorage.getItem('kk_active_page');
    const savedStockTab = localStorage.getItem('kk_stock_tab') || 'ledger';
    if (savedPage && (VALID_PAGES.has(savedPage) || savedPage.startsWith('stock-') || savedPage.startsWith('reports-'))) {
      if (savedPage.startsWith('stock-')) {
        const tab = savedPage.replace('stock-', '');
        return { page: 'stock-management', stockTab: tab === 'dashboard' ? 'overview' : tab };
      }
      return { page: savedPage, stockTab: savedStockTab };
    }
  } catch (_) {}
  return { page: 'dashboard', stockTab: 'ledger' };
}

export default function App() {
  const [initialNav] = useState(getInitialNavigation);
  const [activePage, setActivePage] = useState(initialNav.page);
  const [stockTab, setStockTab] = useState(initialNav.stockTab);
  const [quickActionTrigger, setQuickActionTrigger] = useState(null);

  // Sync state changes to localStorage and URL hash so page is preserved across reloads
  useEffect(() => {
    try {
      localStorage.setItem('kk_active_page', activePage);
      if (activePage === 'stock-management' && stockTab) {
        localStorage.setItem('kk_stock_tab', stockTab);
        window.location.hash = `#stock-${stockTab}`;
      } else {
        window.location.hash = `#${activePage}`;
      }
    } catch (_) {}
  }, [activePage, stockTab]);

  // Listen to browser navigation (back/forward/hash change)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = (window.location.hash || '').replace(/^#\/?/, '').trim();
      if (!hash) return;
      if (hash.startsWith('stock-')) {
        const tab = hash.replace('stock-', '');
        setStockTab(tab === 'dashboard' ? 'overview' : tab);
        setActivePage('stock-management');
      } else if (VALID_PAGES.has(hash) || hash.startsWith('reports-')) {
        setActivePage(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page) => {
    if (page === 'stock-management' || page === 'stock') {
      setActivePage('stock-management');
    } else if (page.startsWith('stock-')) {
      const tab = page.replace('stock-', '');
      setStockTab(tab === 'dashboard' ? 'overview' : tab);
      setActivePage('stock-management');
    } else if (page === 'dispatch-management' || page === 'pending-loadings') {
      setActivePage('master-loading-register');
    } else {
      setActivePage(page);
    }
  };

  const handleQuickAction = (payload) => {
    const actionName = typeof payload === 'string' ? payload : payload?.action;
    const triggerData = typeof payload === 'string'
      ? { action: payload, timestamp: Date.now() }
      : { ...payload, timestamp: Date.now() };
    setQuickActionTrigger(triggerData);
    if (actionName === 'po') {
      setActivePage('supplier-dashboard');
    } else if (actionName === 'loading' || actionName === 'dispatch') {
      setActivePage('master-loading-register');
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={handleNavigate} onOpenQuickAction={handleQuickAction} />;
      case 'supplier-dashboard':
      case 'purchase-orders':
        return (
          <SupplierDashboard
            onOpenQuickAction={handleQuickAction}
            quickActionTrigger={quickActionTrigger}
            defaultTab={activePage === 'purchase-orders' ? 'pos' : undefined}
          />
        );
      case 'industry-sourcing':
        return <IndustrySourcing />;
      case 'stock':
      case 'stock-management':
      case 'stock-dashboard':
      case 'stock-ledger':
      case 'stock-inward':
      case 'stock-outward':
      case 'stock-transfers':
      case 'stock-adjustments':
      case 'stock-valuation':
        return <StockManagement initialTab={stockTab} />;
      case 'master-loading-register':
      case 'pending-loadings':
      case 'dispatch-management':
        return <MasterLoadingRegister onOpenQuickAction={handleQuickAction} quickActionTrigger={quickActionTrigger} />;
      case 'customer-notifications':
        return <CustomerNotifications />;
      case 'reports-loading':
      case 'reports-industry':
      case 'reports-buyer':
      case 'reports-po':
      case 'reports-stock':
      case 'reports':
        return <ReportsCenter />;
      case 'customers':
        return <Customers />;
      case 'industries':
      case 'warehouses':
        return <Industries />;
      case 'products':
        return <Products />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard setActivePage={handleNavigate} onOpenQuickAction={handleQuickAction} />;
    }
  };

  return (
    <FirebaseAuthProvider>
      <NotificationProvider>
        <Layout
          activePage={activePage}
          setActivePage={handleNavigate}
          onOpenQuickAction={handleQuickAction}
        >
          {renderPage()}
        </Layout>
      </NotificationProvider>
    </FirebaseAuthProvider>
  );
}

