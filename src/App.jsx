// src/App.jsx
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PurchaseOrders from './pages/PurchaseOrders';
import IndustrySourcing from './pages/IndustrySourcing';
import StockManagement from './pages/StockManagement';
import MasterLoadingRegister from './pages/MasterLoadingRegister';
import DispatchManagement from './pages/DispatchManagement';
import CustomerNotifications from './pages/CustomerNotifications';
import ReportsCenter from './pages/ReportsCenter';
import Customers from './pages/Customers';
import Industries from './pages/Industries';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Settings from './pages/Settings';
import SupplierDashboard from './pages/SupplierDashboard';
import { FirebaseAuthProvider } from './firebase/AuthContext';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [stockTab, setStockTab] = useState('ledger');
  const [quickActionTrigger, setQuickActionTrigger] = useState(null);

  const handleNavigate = (page) => {
    if (page === 'stock-management' || page === 'stock') {
      setActivePage('stock-management');
    } else if (page.startsWith('stock-')) {
      const tab = page.replace('stock-', '');
      setStockTab(tab === 'dashboard' ? 'overview' : tab);
      setActivePage('stock-management');
    } else {
      setActivePage(page);
    }
  };

  const handleQuickAction = (action) => {
    setQuickActionTrigger({ action, timestamp: Date.now() });
    if (action === 'po') {
      setActivePage('purchase-orders');
    } else if (action === 'loading') {
      setActivePage('master-loading-register');
    } else if (action === 'dispatch') {
      setActivePage('dispatch-management');
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={handleNavigate} onOpenQuickAction={handleQuickAction} />;
      case 'supplier-dashboard':
        return <SupplierDashboard />;
      case 'purchase-orders':
        return <PurchaseOrders onOpenQuickAction={handleQuickAction} quickActionTrigger={quickActionTrigger} />;
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
        return <MasterLoadingRegister onOpenQuickAction={handleQuickAction} quickActionTrigger={quickActionTrigger} />;
      case 'pending-loadings':
      case 'dispatch-management':
        return <DispatchManagement />;
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
        return <Dashboard setActivePage={setActivePage} onOpenQuickAction={handleQuickAction} />;
    }
  };

  return (
    <FirebaseAuthProvider>
      <Layout
        activePage={activePage}
        setActivePage={handleNavigate}
        onOpenQuickAction={handleQuickAction}
      >
        {renderPage()}
      </Layout>
    </FirebaseAuthProvider>
  );
}

