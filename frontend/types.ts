export type OrderStatus = 'PENDING' | 'PAID';
export type PaymentMethod = 'PIX' | 'CASH' | 'CARD' | 'TRANSFER' | '';

export interface AuditLogEntry {
  timestamp: string;
  user: string;
  action: string;
  details?: string;
}

export interface ServiceOrderPeriod {
  id: string;
  startDate: string;
  endDate: string;
  paid: boolean;
}

export interface ServiceOrder {
  id: string;
  osNumber: number;
  entryDate: string;
  customerName: string;
  brand: string;
  brandId?: string;
  serviceValue: number;
  commissionValue: number;
  status: OrderStatus;
  periodId?: string | null;
  period?: ServiceOrderPeriod | null;
  createdAt?: string;
  paidAt?: string | null;
  paymentMethod?: PaymentMethod;
  description?: string | null;
  history?: AuditLogEntry[];
}

export interface CreateOrUpdateOrderInput {
  osNumber: number;
  entryDate: string;
  customerName: string;
  brand: string;
  serviceValue: number;
  paymentMethod?: PaymentMethod;
  description?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface OrderStatusBreakdown {
  pending: number;
  paid: number;
}

export interface OrdersSummary {
  totalOrders: number;
  totalServiceValue: number;
  totalCommission: number;
  statusBreakdown: OrderStatusBreakdown;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  summary?: OrdersSummary;
}

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'ALL' | OrderStatus;
  brand?: string;
  startDate?: string;
  endDate?: string;
  all?: boolean;
}

export interface DashboardData {
  monthlyStats: {
    currentMonth: {
      total: number;
      paid: number;
      pending: number;
    };
    prevMonth: {
      total: number;
    };
    growth: number;
  };
  cards: {
    totalServiceValue: number;
    totalOrders: number;
    todayService: number;
    todayOrdersCount: number;
    pulseGrowth: number;
    bestDayValue: number;
    bestDayDate: string;
  };
  rankings: {
    topBrands: Array<{ name: string; value: number }>;
    topCustomers: Array<{ name: string; value: number }>;
  };
  charts: {
    last7Days: Array<{ dateStr: string; serviceValue: number }>;
    orderStatus: OrderStatusBreakdown;
  };
}

export interface Period {
  id: string;
  startDate: string;
  endDate: string;
  paid: boolean;
  paidAt?: string;
  totalOrders: number;
  totalServiceValue: number;
  totalCommission: number;
}

export interface AppSettings {
  fixedCommissionPercentage: number;
  companyName?: string;
  companyCnpj?: string;
  companyAddress?: string;
  companyContact?: string;
  companyLogoUrl?: string;
  primaryColor?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Brand {
  id: string;
  name: string;
  createdAt: string;
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID'
}
