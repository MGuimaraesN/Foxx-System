import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { DollarSign, TrendingUp, Calendar, Trophy, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { getDashboardData } from '../services/dataService';
import { DashboardData } from '../types';
import { useTheme } from '../services/theme';
import { useTranslation } from '../services/i18n';

interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: any;
  color: string;
  trend?: number;
  variant?: 'default' | 'primary' | 'highlight';
}

const emptyDashboardData: DashboardData = {
  monthlyStats: {
    currentMonth: { total: 0, paid: 0, pending: 0 },
    prevMonth: { total: 0 },
    growth: 0
  },
  cards: {
    totalServiceValue: 0,
    totalOrders: 0,
    todayService: 0,
    todayOrdersCount: 0,
    pulseGrowth: 0,
    bestDayValue: 0,
    bestDayDate: ''
  },
  rankings: {
    topBrands: [],
    topCustomers: []
  },
  charts: {
    last7Days: [],
    orderStatus: {
      pending: 0,
      paid: 0
    }
  }
};

const StatCard = ({ title, value, subValue, icon: Icon, color, trend, variant = 'default' }: StatCardProps) => (
  <div
    className={`
    relative overflow-hidden group transition-all duration-300 ease-out hover:-translate-y-1
    bg-white dark:bg-slate-800/40 dark:backdrop-blur-xl rounded-2xl p-6
    ${variant === 'primary'
      ? 'ring-2 ring-indigo-500/20 dark:ring-indigo-500/30 shadow-lg dark:shadow-[0_0_30px_-10px_rgba(99,102,241,0.2)]'
      : variant === 'highlight'
        ? 'ring-1 ring-amber-500/20 dark:ring-amber-500/30 shadow-md'
        : 'border border-slate-200 dark:border-white/5 shadow-sm'}
  `}
  >
    <div className={`absolute right-0 top-0 p-3 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 ${color} dark:text-white`}>
      <Icon size={120} />
    </div>

    <div className="relative z-10 flex flex-col h-full justify-between">
      <div className="mb-4 flex items-start justify-between">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} bg-opacity-10 dark:bg-opacity-20 text-white shadow-inner`}>
          <Icon
            size={24}
            className={
              variant === 'highlight'
                ? 'text-amber-600 dark:text-amber-400'
                : variant === 'primary'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-300'
            }
          />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}
          >
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className={`mt-1 text-2xl font-bold tracking-tight ${variant === 'primary' ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{value}</h3>
        <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">{subValue}</p>
      </div>
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboardData);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const safeLanguage = language || 'pt-BR';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await getDashboardData();
        if (isMounted) {
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    window.addEventListener('orders-updated', loadData);

    return () => {
      isMounted = false;
      window.removeEventListener('orders-updated', loadData);
    };
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat(safeLanguage, { style: 'currency', currency: 'BRL' }).format(value);

  const lineData = useMemo(
    () =>
      dashboardData.charts.last7Days.map((item) => ({
        ...item,
        label: new Date(`${item.dateStr}T00:00:00`).toLocaleDateString(safeLanguage, {
          weekday: 'short',
          day: 'numeric'
        }).replace('.', '')
      })),
    [dashboardData.charts.last7Days, safeLanguage]
  );

  const pieData = useMemo(
    () => [
      { name: t('status.PENDING'), value: dashboardData.charts.orderStatus.pending },
      { name: t('status.PAID'), value: dashboardData.charts.orderStatus.paid }
    ],
    [dashboardData.charts.orderStatus, t]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  const isDark = theme === 'dark';
  const stats = dashboardData.cards;
  const monthlyStats = dashboardData.monthlyStats;
  const rankings = dashboardData.rankings;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{t('dashboard.title')}</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{t('dashboard.subtitle')}</p>
        </div>

        <div className="flex items-center gap-6 rounded-2xl border border-slate-200 bg-white pl-4 pr-6 py-2.5 shadow-sm dark:border-white/5 dark:bg-slate-800/60 dark:backdrop-blur-md">
          <div className="flex flex-col">
            <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('dashboard.orders')}</span>
            <span className="text-lg font-bold leading-none text-slate-800 dark:text-white">{stats.todayOrdersCount}</span>
          </div>
          <div className="h-8 w-px bg-slate-100 dark:bg-white/10" />
          <div className="flex flex-col">
            <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">VALOR HOJE</span>
            <span className="text-lg font-bold leading-none text-indigo-600 dark:text-indigo-400">{formatCurrency(stats.todayService)}</span>
          </div>
          <div className="h-8 w-px bg-slate-100 dark:bg-white/10" />
          <div className={`flex items-center gap-1 text-xs font-bold ${stats.pulseGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {stats.pulseGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {Math.abs(stats.pulseGrowth).toFixed(0)}% <span className="ml-1 font-medium text-slate-400 dark:text-slate-600">{t('dashboard.vsYesterday')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Faturamento Mês"
          value={formatCurrency(monthlyStats.currentMonth.total || 0)}
          subValue="Total em serviços este mês"
          icon={TrendingUp}
          color="text-emerald-500"
          trend={monthlyStats.growth}
          variant="primary"
        />

        <StatCard
          title="Recorde Diário"
          value={formatCurrency(stats.bestDayValue)}
          subValue={stats.bestDayDate ? new Date(`${stats.bestDayDate}T00:00:00`).toLocaleDateString(safeLanguage) : t('dashboard.noDataYet')}
          icon={Trophy}
          color="text-amber-500"
          variant="highlight"
        />

        <StatCard
          title="Faturamento Hoje"
          value={formatCurrency(stats.todayService)}
          subValue="Total de O.S. abertas hoje"
          icon={Calendar}
          color="text-violet-500"
        />

        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats.totalServiceValue)}
          subValue="Todo o período histórico"
          icon={DollarSign}
          color="text-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 min-h-[400px]" title="Evolução Diária de Valor (O.S.)">
          <div className="mt-4 h-[320px] w-full">
            <ResponsiveContainer width="100%" height={320} debounce={50} minWidth={0}>
              <AreaChart data={lineData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="strokeVal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="label" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis
                  stroke={isDark ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                />
                <Tooltip
                  cursor={{ stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ fontWeight: 600 }}
                  formatter={(value: number) => [formatCurrency(value), 'Valor Total']}
                />
                <Area
                  type="monotone"
                  dataKey="serviceValue"
                  stroke="url(#strokeVal)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVal)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Status das O.S">
          <div className="relative flex h-[320px] w-full items-center justify-center">
            <ResponsiveContainer width="100%" height={320} debounce={50} minWidth={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cornerRadius={10}
                  innerRadius={82}
                  outerRadius={100}
                  paddingAngle={0}
                  cx="50%"
                  cy="50%"
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981'][index % 2]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ fontWeight: 600, color: isDark ? '#f8fafc' : '#0f172a' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
              <span className="text-4xl font-bold tracking-tighter text-slate-800 dark:text-white">{stats.totalOrders}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">TOTAL O.S.</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title={t('dashboard.topBrands')} subtitle="Por volume de faturamento">
          <div className="mt-4 space-y-5">
            {rankings.topBrands.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.noBrandData')}</p>
            ) : (
              rankings.topBrands.map((brand, index) => {
                const maxValue = rankings.topBrands[0]?.value || 1;
                const percent = (brand.value / maxValue) * 100;
                return (
                  <div key={`${brand.name}-${index}`} className="group relative p-3">
                    <div className="absolute inset-y-0 left-0 -z-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10" style={{ width: `${percent}%` }} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{brand.name}</span>
                      <span className="font-mono text-sm font-bold">{formatCurrency(brand.value)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card title={t('dashboard.topCustomers')} subtitle="Maiores investidores">
          <div className="mt-4 space-y-5">
            {rankings.topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.noCustomerData')}</p>
            ) : (
              rankings.topCustomers.map((customer, index) => {
                const maxValue = rankings.topCustomers[0]?.value || 1;
                const percent = (customer.value / maxValue) * 100;
                return (
                  <div key={`${customer.name}-${index}`} className="group relative p-3">
                    <div className="absolute inset-y-0 left-0 -z-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10" style={{ width: `${percent}%` }} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{customer.name}</span>
                      <span className="font-mono text-sm font-bold">{formatCurrency(customer.value)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
