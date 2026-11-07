// src/api.js
// Centralized API client for Keshar Kali Operations Portal

let currentRole = localStorage.getItem('kk_role') || 'Admin';
let authToken = localStorage.getItem('kk_token') || '';

export function setRole(role) {
  currentRole = role;
  localStorage.setItem('kk_role', role);
  window.dispatchEvent(new Event('roleChange'));
}

export function getRole() {
  return currentRole;
}

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('kk_token', token);
  } else {
    localStorage.removeItem('kk_token');
  }
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': currentRole,
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...options.headers
  };

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errMessage = 'Network request failed';
    try {
      const errData = await response.json();
      errMessage = errData.error || errMessage;
    } catch {
      errMessage = await response.text() || errMessage;
    }
    throw new Error(errMessage);
  }

  // Handle binary excel blob download vs json
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) {
    return response.blob();
  }

  return response.json();
}

export const api = {
  // Auth
  auth: {
    login: (credentials) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getMe: () => request('/api/auth/me'),
    getUsers: () => request('/api/auth/users')
  },

  // Dashboard
  dashboard: {
    getData: () => request('/api/dashboard')
  },

  // Customers
  customers: {
    getAll: () => request('/api/customers'),
    getById: (id) => request(`/api/customers/${id}`),
    create: (data) => request('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/customers/${id}`, { method: 'DELETE' })
  },

  // Industries (Confidential)
  industries: {
    getAll: () => request('/api/industries'),
    getById: (id) => request(`/api/industries/${id}`),
    create: (data) => request('/api/industries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/industries/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  // Products
  products: {
    getAll: () => request('/api/products'),
    getById: (id) => request(`/api/products/${id}`),
    create: (data) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  // Warehouses
  warehouses: {
    getAll: () => request('/api/warehouses'),
    create: (data) => request('/api/warehouses', { method: 'POST', body: JSON.stringify(data) })
  },

  // Purchase Orders
  purchaseOrders: {
    getAll: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/purchase-orders${q ? '?' + q : ''}`);
    },
    getById: (id) => request(`/api/purchase-orders/${id}`),
    create: (data) => request('/api/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    cancel: (id) => request(`/api/purchase-orders/${id}/cancel`, { method: 'POST' })
  },

  // Industry Allocations
  allocations: {
    getByPo: (poId) => request(`/api/allocations?poId=${poId}`),
    create: (data) => request('/api/allocations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/allocations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/allocations/${id}`, { method: 'DELETE' })
  },

  // Master Loading Register
  loadingRegister: {
    getAll: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/loading-register${q ? '?' + q : ''}`);
    },
    getSummary: () => request('/api/loading-register/summary'),
    create: (data) => request('/api/loading-register', { method: 'POST', body: JSON.stringify(data) }),
    updateCell: (id, data) => request(`/api/loading-register/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    bulkSave: (rows) => request('/api/loading-register/bulk-save', { method: 'POST', body: JSON.stringify({ rows }) }),
    delete: (id) => request(`/api/loading-register/${id}`, { method: 'DELETE' })
  },

  // Dispatches
  dispatches: {
    getAll: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/dispatches${q ? '?' + q : ''}`);
    },
    getPendingLoadings: () => request('/api/dispatches/pending-loadings'),
    confirm: (data) => request('/api/dispatches', { method: 'POST', body: JSON.stringify(data) })
  },

  // Stock Management
  stock: {
    getDashboard: () => request('/api/stock/dashboard'),
    getSummary: () => request('/api/stock/summary'),
    getLedger: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/stock/ledger${q ? '?' + q : ''}`);
    },
    inward: (data) => request('/api/stock/inward', { method: 'POST', body: JSON.stringify(data) }),
    outward: (data) => request('/api/stock/outward', { method: 'POST', body: JSON.stringify(data) }),
    reserve: (data) => request('/api/stock/reserve', { method: 'POST', body: JSON.stringify(data) }),
    releaseReservation: (data) => request('/api/stock/release-reservation', { method: 'POST', body: JSON.stringify(data) }),
    transfer: (data) => request('/api/stock/transfer', { method: 'POST', body: JSON.stringify(data) }),
    adjust: (data) => request('/api/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),
    getValuation: () => request('/api/stock/valuation')
  },

  // WhatsApp
  whatsapp: {
    getLogs: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/whatsapp/logs${q ? '?' + q : ''}`);
    },
    retry: (id) => request(`/api/whatsapp/retry/${id}`, { method: 'POST' }),
    getConfig: () => request('/api/whatsapp/config')
  },

  // Reports & Exports
  reports: {
    getMasterLoading: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/master-loading${q ? '?' + q : ''}`);
    },
    getIndustryWise: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/industry-wise${q ? '?' + q : ''}`);
    },
    getBuyerWise: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/buyer-wise${q ? '?' + q : ''}`);
    },
    getPOFulfillment: () => request('/api/reports/po-fulfillment'),

    // Export Excel binary blobs
    exportMasterLoading: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/export/master-loading${q ? '?' + q : ''}`);
    },
    exportIndustryWise: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/export/industry-wise${q ? '?' + q : ''}`);
    },
    exportBuyerWise: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/export/buyer-wise${q ? '?' + q : ''}`);
    },
    exportPOFulfillment: async () => {
      return request('/api/reports/export/po-fulfillment');
    },
    exportStockLedger: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/reports/export/stock-ledger${q ? '?' + q : ''}`);
    }
  },

  // Audit Logs
  auditLogs: {
    getLogs: (limit = 50) => request(`/api/audit-logs?limit=${limit}`)
  }
};

// Utility to trigger browser download of Excel blob
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

