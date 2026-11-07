// src/App.jsx
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PurchaseOrders from './pages/PurchaseOrders';
import IndustrySourcing from './pages/IndustrySourcing';
import StockDashboard from './pages/StockDashboard';
import StockLedger from './pages/StockLedger';
import StockInward from './pages/StockInward';
import StockOutward from './pages/StockOutward';
import StockTransfers from './pages/StockTransfers';
import StockAdjustments from './pages/StockAdjustments';
import StockValuation from './pages/StockValuation';
import MasterLoadingRegister from './pages/MasterLoadingRegister';
import DispatchManagement from './pages/DispatchManagement';
import CustomerNotifications from './pages/CustomerNotifications';
import ReportsCenter from './pages/ReportsCenter';
import Customers from './pages/Customers';
import Industries from './pages/Industries';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Settings from './pages/Settings';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const handleQuickAction = (action) => {
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
        return <Dashboard setActivePage={setActivePage} onOpenQuickAction={handleQuickAction} />;
      case 'purchase-orders':
        return <PurchaseOrders onOpenQuickAction={handleQuickAction} />;
      case 'industry-sourcing':
        return <IndustrySourcing />;
      case 'stock-dashboard':
        return <StockDashboard setActivePage={setActivePage} />;
      case 'stock-ledger':
        return <StockLedger />;
      case 'stock-inward':
        return <StockInward setActivePage={setActivePage} />;
      case 'stock-outward':
        return <StockOutward setActivePage={setActivePage} />;
      case 'stock-transfers':
        return <StockTransfers />;
      case 'stock-adjustments':
        return <StockAdjustments />;
      case 'stock-valuation':
        return <StockValuation />;
      case 'master-loading-register':
        return <MasterLoadingRegister onOpenQuickAction={handleQuickAction} />;
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
        return <Industries />;
      case 'products':
        return <Products />;
      case 'warehouses':
        return <Warehouses />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard setActivePage={setActivePage} onOpenQuickAction={handleQuickAction} />;
    }
  };

  return (
    <Layout
      activePage={activePage}
      setActivePage={setActivePage}
      onOpenQuickAction={handleQuickAction}
    >
      {renderPage()}
    </Layout>
  );
}
