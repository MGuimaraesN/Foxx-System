import { ServiceOrder, Period, AppSettings, Brand } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const headers = {
  'Content-Type': 'application/json'
};

// Event emitter for cross-component communication
export const notifyOrdersUpdated = () => window.dispatchEvent(new Event('orders-updated'));

// --- Settings ---

export const getSettings = async (): Promise<AppSettings> => {
  const res = await fetch(`${API_URL}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const saveSettings = async (settings: Partial<AppSettings>) => {
  const res = await fetch(`${API_URL}/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
};

// --- Backup ---
export const getBackupData = async () => {
  const response = await fetch(`${API_URL}/backup/export`);
  return await response.json();
};

export const restoreBackup = async (content: string) => {
  const response = await fetch(`${API_URL}/backup/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: content
  });
  return response.ok;
};

// --- Periods ---

export const getPeriods = async (): Promise<Period[]> => {
  const res = await fetch(`${API_URL}/periods`);
  if (!res.ok) throw new Error('Failed to fetch periods');
  return res.json();
};

export const markPeriodAsPaid = async (periodId: string) => {
  const res = await fetch(`${API_URL}/periods/${periodId}/pay`, {
    method: 'POST'
  });
  if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to pay period');
  }
};

export const createPeriod = async (start: string, end: string) => {
    const res = await fetch(`${API_URL}/periods`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startDate: start, endDate: end })
    });
    if (!res.ok) throw new Error('Failed to create period');
    return res.json();
};

export const updatePeriod = async (id: string, updates: { startDate?: string, endDate?: string }) => {
    const res = await fetch(`${API_URL}/periods/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update period');
    return res.json();
};

export const deletePeriod = async (id: string) => {
    const res = await fetch(`${API_URL}/periods/${id}`, { 
        method: 'DELETE' 
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete period');
    }
};

// --- Orders ---

export const getOrders = async (): Promise<ServiceOrder[]> => {
  const res = await fetch(`${API_URL}/orders`);
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
};

export const getPendingOrderCount = async (): Promise<number> => {
  const res = await fetch(`${API_URL}/orders/pending-count`);
  if (!res.ok) throw new Error('Failed to fetch pending count');
  const data = await res.json();
  return data.count;
};

export const createOrder = async (order: Omit<ServiceOrder, 'id' | 'createdAt' | 'commissionValue' | 'status' | 'periodId'>) => {
  const payload = {
      ...order,
      brandId: order.brand
  };

  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create order');
  }
  return res.json();
};

export const updateOrder = async (id: string, updates: Partial<ServiceOrder>) => {
  const payload: any = { ...updates };
  if (updates.brand) payload.brandId = updates.brand;

  const res = await fetch(`${API_URL}/orders/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update order');
  }
  return res.json();
};

export const deleteOrder = async (id: string) => {
    const res = await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete order');
    }
};

export const duplicateOrder = async (originalId: string) => {
    const res = await fetch(`${API_URL}/orders/${originalId}/duplicate`, {
        method: 'POST'
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to duplicate order');
    }
    return res.json();
};

export const updateOrderStatus = async (id: string, status: 'PENDING' | 'PAID') => {
    return updateOrder(id, { status });
};

export const bulkUpdateOrderStatus = async (ids: string[], status: 'PENDING' | 'PAID') => {
    const res = await fetch(`${API_URL}/orders/bulk-update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids, status })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to bulk update orders');
    }
    return res.json();
};

export const bulkDeleteOrders = async (ids: string[]) => {
    const res = await fetch(`${API_URL}/orders/bulk-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to bulk delete orders');
    }
    return res.json();
};

// --- Brands ---

export const getBrands = async (): Promise<Brand[]> => {
  const res = await fetch(`${API_URL}/brands`);
  if (!res.ok) throw new Error('Failed to fetch brands');
  return res.json();
};

export const addBrand = async (name: string) => {
  const res = await fetch(`${API_URL}/brands`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to add brand');
  return res.json();
};

export const updateBrand = async (id: string, name: string) => {
    throw new Error("Update brand not implemented in backend");
};

export const deleteBrand = async (id: string) => {
  const res = await fetch(`${API_URL}/brands/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete brand');
};

// --- Dashboard / Analytics ---

export const getDashboardData = async () => {
    const res = await fetch(`${API_URL}/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
}

export const getMonthlyStats = async () => {
    const data = await getDashboardData();
    return data.monthlyStats;
};

export const getRankings = async () => {
    const data = await getDashboardData();
    return data.rankings;
};

export const initializeData = async () => {
    // No-op, backend handles seeding
};

export const getAuditLogs = async (page = 1, limit = 20) => {
    const res = await fetch(`${API_URL}/audit?page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
};

export const getAuditLogsByOrder = async (orderId: string) => {
    const res = await fetch(`${API_URL}/audit/order/${orderId}`);
    if (!res.ok) throw new Error('Failed to fetch order audit logs');
    return res.json();
};
