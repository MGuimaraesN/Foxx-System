import {
  AppSettings,
  Brand,
  CreateOrUpdateOrderInput,
  DashboardData,
  OrderQueryParams,
  PaginatedResponse,
  Period,
  ServiceOrder,
  OrderStatus
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

export const notifyOrdersUpdated = () => window.dispatchEvent(new Event('orders-updated'));

const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const normalizeApiError = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const messages = value.map((item) => normalizeApiError(item)).filter(Boolean);
    return messages.length ? messages.join(' | ') : null;
  }
  if (typeof value === 'object') {
    const candidate = value as {
      message?: unknown;
      formErrors?: unknown;
      fieldErrors?: Record<string, unknown>;
    };

    if (candidate.message && typeof candidate.message === 'string') {
      return candidate.message;
    }

    const fieldMessages = Object.entries(candidate.fieldErrors || {}).flatMap(([field, details]) => {
      if (!Array.isArray(details)) return [];
      return details
        .filter((detail): detail is string => typeof detail === 'string' && detail.length > 0)
        .map((detail) => `${field}: ${detail}`);
    });

    const formMessages = Array.isArray(candidate.formErrors)
      ? candidate.formErrors.filter((detail): detail is string => typeof detail === 'string' && detail.length > 0)
      : [];

    const combined = [...formMessages, ...fieldMessages];
    return combined.length ? combined.join(' | ') : null;
  }
  return null;
};

const parseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    return normalizeApiError(data.error) || normalizeApiError(data.message) || fallback;
  } catch {
    return fallback;
  }
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Request failed'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
};

export const getSettings = async (): Promise<AppSettings> => {
  return requestJson<AppSettings>('/settings');
};

export const saveSettings = async (settings: Partial<AppSettings>) => {
  return requestJson<AppSettings>('/settings', {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings)
  });
};

export const getBackupData = async () => {
  return requestJson('/backup/export');
};

export const restoreBackup = async (content: string) => {
  const response = await fetch(`${API_URL}/backup/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: content
  });
  return response.ok;
};

export const getPeriods = async (): Promise<Period[]> => {
  return requestJson<Period[]>('/periods');
};

export const markPeriodAsPaid = async (periodId: string) => {
  await requestJson(`/periods/${periodId}/pay`, {
    method: 'POST'
  });
};

export const createPeriod = async (start: string, end: string) => {
  return requestJson('/periods', {
    method: 'POST',
    headers,
    body: JSON.stringify({ startDate: start, endDate: end })
  });
};

export const updatePeriod = async (id: string, updates: { startDate?: string; endDate?: string }) => {
  return requestJson(`/periods/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });
};

export const deletePeriod = async (id: string) => {
  await requestJson(`/periods/${id}`, {
    method: 'DELETE'
  });
};

export const getOrders = async (
  params: OrderQueryParams = {}
): Promise<PaginatedResponse<ServiceOrder>> => {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    q: params.q?.trim(),
    status: params.status,
    brand: params.brand,
    startDate: params.startDate,
    endDate: params.endDate,
    all: params.all
  });

  return requestJson<PaginatedResponse<ServiceOrder>>(`/orders${queryString}`);
};

export const getOrdersForExport = async (params: Omit<OrderQueryParams, 'page'> = {}): Promise<ServiceOrder[]> => {
  const response = await getOrders({
    ...params,
    all: true,
    limit: params.limit || 5000
  });

  return response.data;
};

export const getPendingOrderCount = async (): Promise<number> => {
  const data = await requestJson<{ count: number }>('/orders/pending-count');
  return data.count;
};

export const createOrder = async (order: CreateOrUpdateOrderInput) => {
  const payload = {
    ...order,
    brandId: order.brand
  };

  return requestJson<ServiceOrder>('/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
};

export const updateOrder = async (id: string, updates: Partial<CreateOrUpdateOrderInput> & { status?: OrderStatus }) => {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.brand) {
    payload.brandId = updates.brand;
  }

  return requestJson<ServiceOrder>(`/orders/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });
};

export const deleteOrder = async (id: string) => {
  await requestJson(`/orders/${id}`, { method: 'DELETE' });
};

export const duplicateOrder = async (originalId: string) => {
  return requestJson<ServiceOrder>(`/orders/${originalId}/duplicate`, {
    method: 'POST'
  });
};

export const updateOrderStatus = async (id: string, status: OrderStatus) => {
  return updateOrder(id, { status });
};

export const bulkUpdateOrderStatus = async (ids: string[], status: OrderStatus) => {
  return requestJson(`/orders/bulk-update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids, status })
  });
};

export const bulkDeleteOrders = async (ids: string[]) => {
  return requestJson(`/orders/bulk-delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids })
  });
};

export const getBrands = async (): Promise<Brand[]> => {
  return requestJson<Brand[]>('/brands');
};

export const addBrand = async (name: string) => {
  return requestJson<Brand>('/brands', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name })
  });
};

export const updateBrand = async (id: string, name: string) => {
  throw new Error('Update brand not implemented in backend');
};

export const deleteBrand = async (id: string) => {
  await requestJson(`/brands/${id}`, { method: 'DELETE' });
};

export const getDashboardData = async () => {
  return requestJson<DashboardData>('/dashboard');
};

export const getMonthlyStats = async () => {
  const data = await getDashboardData();
  return data.monthlyStats;
};

export const getRankings = async () => {
  const data = await getDashboardData();
  return data.rankings;
};

export const initializeData = async () => {
  return undefined;
};

export const getAuditLogs = async (page = 1, limit = 20) => {
  return requestJson(`/audit?page=${page}&limit=${limit}`);
};

export const getAuditLogsByOrder = async (orderId: string) => {
  return requestJson(`/audit/order/${orderId}`);
};
