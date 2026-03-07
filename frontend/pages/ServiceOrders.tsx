import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  AlertCircle,
  Download,
  Filter,
  X,
  CheckCircle,
  DollarSign,
  CheckSquare,
  Square,
  Copy,
  History,
  CreditCard,
  Clock,
  FileText
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import {
  addBrand,
  bulkDeleteOrders,
  bulkUpdateOrderStatus,
  createOrder,
  deleteOrder,
  duplicateOrder,
  getAuditLogsByOrder,
  getBrands,
  getOrders,
  getOrdersForExport,
  getSettings,
  notifyOrdersUpdated,
  updateOrder,
  updateOrderStatus
} from '../services/dataService';
import {
  AppSettings,
  AuditLogEntry,
  Brand,
  CreateOrUpdateOrderInput,
  OrdersSummary,
  PaginationMeta,
  PaymentMethod,
  ServiceOrder
} from '../types';
import { useTranslation } from '../services/i18n';
import { toLocalDateInputValue } from '../services/date';

const PAGE_SIZE = 25;
const emptyPagination: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  pages: 1,
  hasNext: false,
  hasPrev: false
};
const emptySummary: OrdersSummary = {
  totalOrders: 0,
  totalServiceValue: 0,
  totalCommission: 0,
  statusBreakdown: {
    pending: 0,
    paid: 0
  }
};

export const ServiceOrders: React.FC = () => {
  const { t, language } = useTranslation();
  const safeLanguage = language || 'pt-BR';
  const isPt = safeLanguage.startsWith('pt');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('PENDING');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [brandsList, setBrandsList] = useState<Brand[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<AuditLogEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; isBulk: boolean }>({
    isOpen: false,
    id: null,
    isBulk: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [summary, setSummary] = useState<OrdersSummary>(emptySummary);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    osNumber: '',
    entryDate: toLocalDateInputValue(),
    customerName: 'Consumidor Padrão',
    brand: '',
    serviceValue: '',
    paymentMethod: '' as PaymentMethod,
    description: ''
  });
  const [newBrandName, setNewBrandName] = useState('');
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ fixedCommissionPercentage: 10 });

  const summaryLabels = isPt
    ? {
        filtered: 'Resultado filtrado',
        totalValue: 'Valor total',
        commission: 'Comissão',
        pending: 'Pendentes',
        paid: 'Pagas',
        loading: 'Carregando ordens...'
      }
    : {
        filtered: 'Filtered result',
        totalValue: 'Total value',
        commission: 'Commission',
        pending: 'Pending',
        paid: 'Paid',
        loading: 'Loading orders...'
      };

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(safeLanguage, { style: 'currency', currency: 'BRL' }),
    [safeLanguage]
  );
  const formatCurrency = useCallback((value: number) => currencyFormatter.format(value), [currencyFormatter]);

  const estimatedCommission = formData.serviceValue ? (parseFloat(formData.serviceValue) * settings.fixedCommissionPercentage) / 100 : 0;

  const loadBrands = useCallback(async () => {
    try {
      const brands = await getBrands();
      setBrandsList(brands);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadOrders = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        const response = await getOrders({
          page,
          limit: PAGE_SIZE,
          q: debouncedSearchTerm,
          status: statusFilter,
          brand: brandFilter
        });

        setOrders(response.data);
        setPagination(response.pagination);
        setSummary(response.summary || emptySummary);
        setSelectedIds(new Set());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [brandFilter, debouncedSearchTerm, statusFilter]
  );

  useEffect(() => {
    loadBrands();
    loadSettings();
  }, [loadBrands, loadSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, brandFilter]);

  useEffect(() => {
    loadOrders(currentPage);
  }, [currentPage, loadOrders]);

  useEffect(() => {
    if (!formData.brand && brandsList.length > 0) {
      setFormData((prev) => ({ ...prev, brand: brandsList[0].name }));
    }
  }, [brandsList, formData.brand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          setIsFormOpen(false);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          openNewForm();
          break;
        case 'f':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'p':
          if (selectedIds.size > 0) {
            e.preventDefault();
            handleBulkPay();
          }
          break;
        case 'escape':
          setSelectedIds(new Set());
          setIsFormOpen(false);
          setIsHistoryOpen(false);
          setDeleteConfirm({ isOpen: false, id: null, isBulk: false });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const exportOrders = await getOrdersForExport({
        q: debouncedSearchTerm,
        status: statusFilter,
        brand: brandFilter,
        limit: 5000
      });

      const headers = [
        t('orders.date'),
        'Time',
        t('orders.osNumber'),
        t('orders.customer'),
        t('orders.brand'),
        t('orders.value'),
        'Commission Value',
        'Status',
        'Paid At',
        t('orders.paymentMethod'),
        'Period'
      ];

      const rows = exportOrders.map((order) => {
        const formatBRL = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;
        return [
          order.entryDate.split('T')[0],
          '00:00',
          order.osNumber,
          escape(order.customerName),
          escape(order.brand),
          escape(formatBRL(order.serviceValue)),
          escape(formatBRL(order.commissionValue)),
          t(`status.${order.status}`),
          order.paidAt ? order.paidAt.split('T')[0] : '-',
          order.paymentMethod || '-',
          order.periodId ? 'Period Set' : '-'
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `service_orders_${toLocalDateInputValue()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Error exporting CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const reloadCurrentPage = async (page = currentPage) => {
    if (page !== currentPage) {
      setCurrentPage(page);
      return;
    }

    await loadOrders(page);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!formData.osNumber || !formData.serviceValue || !formData.brand) {
        throw new Error(t('orders.errorRequired'));
      }

      const today = toLocalDateInputValue();
      if (formData.entryDate > today) {
        throw new Error(t('orders.errorFuture'));
      }

      const serviceValue = parseFloat(formData.serviceValue);
      if (serviceValue <= 0) {
        throw new Error(t('orders.errorPositive'));
      }

      const payload: CreateOrUpdateOrderInput = {
        osNumber: parseInt(formData.osNumber, 10),
        entryDate: formData.entryDate,
        customerName: formData.customerName,
        brand: formData.brand,
        serviceValue,
        paymentMethod: formData.paymentMethod,
        description: formData.description
      };

      if (editingId) {
        await updateOrder(editingId, payload);
        await reloadCurrentPage();
      } else {
        await createOrder(payload);
        await reloadCurrentPage(1);
      }

      notifyOrdersUpdated();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Error saving order');
    }
  };

  const handleEdit = (order: ServiceOrder) => {
    if (order.status === 'PAID') {
      alert(isPt ? 'Esta ordem já foi paga e não pode ser editada.' : 'This order is PAID and cannot be edited.');
      return;
    }

    setEditingId(order.id);
    setFormData({
      osNumber: order.osNumber.toString(),
      entryDate: order.entryDate.split('T')[0],
      customerName: order.customerName,
      brand: order.brand,
      serviceValue: order.serviceValue.toString(),
      paymentMethod: (order.paymentMethod || '') as PaymentMethod,
      description: order.description || ''
    });
    setIsFormOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateOrder(id);
      await reloadCurrentPage(1);
      notifyOrdersUpdated();
    } catch (e: any) {
      alert(e.message || 'Error duplicating order');
    }
  };

  const handleShowHistory = async (order: ServiceOrder) => {
    try {
      const logs = await getAuditLogsByOrder(order.id);
      setSelectedHistory(logs);
      setIsHistoryOpen(true);
    } catch (e) {
      alert(isPt ? 'Erro ao carregar histórico' : 'Failed to load history');
    }
  };

  const handleTogglePaid = async (order: ServiceOrder) => {
    if (order.status === 'PAID') return;

    const confirmed = window.confirm(isPt ? `Marcar a ordem #${order.osNumber} como PAGA?` : `Mark Order #${order.osNumber} as PAID?`);
    if (!confirmed) return;

    try {
      await updateOrderStatus(order.id, 'PAID');
      await reloadCurrentPage();
      notifyOrdersUpdated();
    } catch (e: any) {
      alert(e.message || 'Error updating status');
    }
  };

  const confirmDelete = async () => {
    try {
      const pageAfterDelete = orders.length <= (deleteConfirm.isBulk ? selectedIds.size : 1) && currentPage > 1 ? currentPage - 1 : currentPage;

      if (deleteConfirm.isBulk) {
        await bulkDeleteOrders(Array.from(selectedIds));
      } else if (deleteConfirm.id) {
        await deleteOrder(deleteConfirm.id);
      }

      setDeleteConfirm({ isOpen: false, id: null, isBulk: false });
      await reloadCurrentPage(pageAfterDelete);
      notifyOrdersUpdated();
    } catch (e: any) {
      alert(e.message || 'Error deleting');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(orders.map((order) => order.id)));
  };

  const handleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkPay = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      isPt ? `Marcar ${selectedIds.size} ordens selecionadas como PAGAS?` : `Mark ${selectedIds.size} selected orders as PAID?`
    );
    if (!confirmed) return;

    try {
      await bulkUpdateOrderStatus(Array.from(selectedIds), 'PAID');
      await reloadCurrentPage();
      notifyOrdersUpdated();
    } catch (e: any) {
      alert(e.message || 'Error bulk updating');
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ isOpen: true, id: null, isBulk: true });
  };

  const resetForm = () => {
    const defaultBrand = brandsList[0]?.name || '';
    setEditingId(null);
    setFormData({
      osNumber: '',
      entryDate: toLocalDateInputValue(),
      customerName: 'Consumidor Padrão',
      brand: defaultBrand,
      serviceValue: '',
      paymentMethod: '',
      description: ''
    });
    setIsFormOpen(false);
    setError(null);
  };

  const openNewForm = () => {
    setEditingId(null);
    setError(null);
    setFormData({
      osNumber: '',
      entryDate: toLocalDateInputValue(),
      customerName: 'Consumidor Padrão',
      brand: brandsList[0]?.name || '',
      serviceValue: '',
      paymentMethod: '',
      description: ''
    });
    setIsFormOpen(true);
  };

  const handleQuickAddBrand = async () => {
    if (!newBrandName.trim()) return;

    try {
      const brand = await addBrand(newBrandName.trim());
      setBrandsList((prev) => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, brand: brand.name }));
      setNewBrandName('');
      setIsBrandModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Error adding brand');
    }
  };

  const getHistoryColor = (action: string) => {
    if (action.includes('CREATED')) return 'bg-emerald-500';
    if (action.includes('STATUS')) return 'bg-amber-500';
    if (action.includes('DUPLICATED')) return 'bg-violet-500';
    return 'bg-blue-500';
  };

  return (
    <div className="relative space-y-6">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{t('orders.title')}</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{t('orders.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportCSV} icon={<Download size={18} />} disabled={isExporting || isLoading}>
            {t('orders.exportCsv')}
          </Button>
          <Button onClick={openNewForm} icon={<Plus size={18} />}>
            {t('orders.newOrder')}
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-6 rounded-2xl border border-white/10 bg-slate-900 px-6 py-3 text-white shadow-2xl animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium">{selectedIds.size} {t('orders.bulkSelected')}</span>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex gap-2">
            <button onClick={handleBulkPay} className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-emerald-400">
              <CheckCircle size={16} /> {t('orders.markPaid')}
            </button>
            <button onClick={handleBulkDelete} className="ml-2 flex items-center gap-2 text-sm font-medium transition-colors hover:text-red-400">
              <Trash2 size={16} /> {t('common.delete')}
            </button>
          </div>
        </div>
      )}

      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-col items-center space-y-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-500/10 dark:text-red-400">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {deleteConfirm.isBulk ? t('orders.deleteBulkTitle', { count: selectedIds.size }) : t('orders.deleteTitle')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('orders.deleteMsg')}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDeleteConfirm({ isOpen: false, id: null, isBulk: false })} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={confirmDelete} className="flex-1">
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-white/5 dark:bg-white/5">
              <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                <History size={18} /> {t('orders.auditLog')}
              </h3>
              <button onClick={() => setIsHistoryOpen(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto p-6">
              {selectedHistory.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">{t('orders.noHistory')}</p>
              ) : (
                [...selectedHistory].reverse().map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="relative flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`mt-1.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${getHistoryColor(entry.action)}`} />
                      {index < selectedHistory.length - 1 && <div className="my-1 h-full w-px bg-slate-200 dark:bg-white/10" />}
                    </div>
                    <div className="pb-6">
                      <p className="mb-1 font-mono text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString()}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{entry.action}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{entry.details}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-white/5">{entry.user || 'System'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg animate-in zoom-in-95 duration-200" title={editingId ? t('orders.editTitle') : t('orders.newTitle')}>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500 dark:text-red-400">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('orders.osNumber')}
                  type="number"
                  required
                  value={formData.osNumber}
                  onChange={(e) => setFormData({ ...formData, osNumber: e.target.value })}
                  placeholder="e.g. 1001"
                />
                <Input
                  label={t('orders.date')}
                  type="date"
                  required
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                />
              </div>

              <Input
                label={t('orders.customer')}
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Consumidor Padrão"
              />

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">Descrição (Opcional)</label>
                <textarea
                  className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-950/50 dark:text-slate-100"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes do serviço..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('orders.brand')}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-950/50 dark:text-slate-100"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                      >
                        <option value="" disabled>
                          {t('orders.selectBrand')}
                        </option>
                        {brandsList.map((brand) => (
                          <option key={brand.id} value={brand.name}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                      <Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBrandModalOpen(true)}
                      className="rounded-xl bg-slate-100 p-2.5 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Add Brand"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                <Input
                  label={t('orders.value')}
                  type="number"
                  step="0.01"
                  required
                  value={formData.serviceValue}
                  onChange={(e) => setFormData({ ...formData, serviceValue: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('orders.paymentMethod')} ({t('common.optional')})
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-950/50 dark:text-slate-100"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                  >
                    <option value="">{t('orders.none')}</option>
                    <option value="PIX">PIX</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="TRANSFER">Bank Transfer</option>
                  </select>
                  <CreditCard className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                <span className="text-sm text-indigo-600 dark:text-indigo-300">
                  {t('orders.calcCommission')} ({settings.fixedCommissionPercentage}%)
                </span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(estimatedCommission)}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1">
                  Salvar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {isBrandModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-indigo-500/20 shadow-2xl" title="Nova Marca">
            <div className="space-y-4">
              <Input
                label="Nome da Marca"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Ex: Samsung"
                autoFocus
              />
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setIsBrandModalOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleQuickAddBrand} className="flex-1">
                  Salvar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-white/5 md:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('orders.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500/50 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="relative">
              <select
                className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-indigo-500/50 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'PAID')}
              >
                <option value="ALL">{t('status.ALL')}</option>
                <option value="PENDING">{t('status.PENDING')}</option>
                <option value="PAID">{t('status.PAID')}</option>
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>

            <div className="relative">
              <select
                className="max-w-[150px] cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-indigo-500/50 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <option value="ALL">{t('orders.allBrands')}</option>
                {brandsList.map((brand) => (
                  <option key={brand.id} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>

            {(statusFilter !== 'PENDING' || brandFilter !== 'ALL' || searchInput) && (
              <button
                onClick={() => {
                  setStatusFilter('PENDING');
                  setBrandFilter('ALL');
                  setSearchInput('');
                }}
                className="p-2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                title={t('orders.resetFilters')}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-3 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
          <span>
            {summaryLabels.filtered}: <strong className="text-slate-700 dark:text-slate-200">{summary.totalOrders}</strong>
          </span>
          <span>
            {summaryLabels.totalValue}: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(summary.totalServiceValue)}</strong>
          </span>
          <span>
            {summaryLabels.commission}: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(summary.totalCommission)}</strong>
          </span>
          <span>
            {summaryLabels.pending}: <strong className="text-slate-700 dark:text-slate-200">{summary.statusBreakdown.pending}</strong>
          </span>
          <span>
            {summaryLabels.paid}: <strong className="text-slate-700 dark:text-slate-200">{summary.statusBreakdown.paid}</strong>
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 dark:border-white/5 dark:text-slate-400">
                <th className="w-12 whitespace-nowrap px-4 py-4 text-center">
                  <button onClick={handleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-indigo-500" disabled={orders.length === 0}>
                    {orders.length > 0 && selectedIds.size === orders.length ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">{t('orders.date')}</th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">{t('orders.osNumber')}</th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">{t('orders.customer')}</th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">{t('orders.brand')}</th>
                <th className="whitespace-nowrap px-4 py-4 text-right font-semibold">{t('common.value')}</th>
                <th className="whitespace-nowrap px-4 py-4 text-right font-semibold">{t('dashboard.commission')}</th>
                <th className="whitespace-nowrap px-4 py-4 text-center font-semibold">Status</th>
                <th className="whitespace-nowrap px-4 py-4 text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
                      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
                      <p className="text-sm font-medium">{summaryLabels.loading}</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                        <FileText size={24} />
                      </div>
                      <p className="font-medium text-slate-600 dark:text-slate-300">{t('orders.noOrdersFound')}</p>
                      <p className="text-sm">{t('orders.noOrdersMsg')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className={`group transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${selectedIds.has(order.id) ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-4 text-center">
                      <button onClick={() => handleSelectRow(order.id)} className={`flex items-center justify-center ${selectedIds.has(order.id) ? 'text-indigo-500' : 'text-slate-300 hover:text-slate-500'}`}>
                        {selectedIds.has(order.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600 dark:text-slate-300">
                      {order.entryDate.split('T')[0]}
                      {order.paidAt && <span className="block text-[10px] text-emerald-500">{t('orders.paidOn')}: {order.paidAt.split('T')[0]}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-900 dark:text-white">#{order.osNumber}</td>
                    <td className="min-w-[150px] max-w-[300px] px-4 py-4 text-slate-600 dark:text-slate-300">
                      <div className="break-words whitespace-normal leading-tight">{order.customerName}</div>
                      {order.paymentMethod && <span className="mt-1 block text-[10px] text-slate-400">{order.paymentMethod}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:border-white/5 dark:bg-slate-700/50 dark:text-slate-300">
                        {order.brand}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-slate-600 dark:text-slate-300">{formatCurrency(order.serviceValue)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(order.commissionValue)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-sm ${order.status === 'PAID' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}
                      >
                        {order.status === 'PAID' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {t(`status.${order.status}`)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => handleTogglePaid(order)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                            title={t('orders.markPaid')}
                          >
                            <DollarSign size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(order.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-indigo-400 dark:hover:bg-white/10"
                          title={t('common.duplicate')}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white"
                          disabled={order.status === 'PAID'}
                          title={t('common.edit')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleShowHistory(order)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-blue-400 dark:hover:bg-white/10"
                          title={t('orders.auditLog')}
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: order.id, isBulk: false })}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-red-400"
                          disabled={order.status === 'PAID'}
                          title={t('common.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={setCurrentPage} isLoading={isLoading} language={safeLanguage} />
      </Card>
    </div>
  );
};
