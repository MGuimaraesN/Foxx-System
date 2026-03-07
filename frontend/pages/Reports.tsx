import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, FileSpreadsheet, Filter, Download, DollarSign } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { getBrands, getOrders, getOrdersForExport, getSettings } from '../services/dataService';
import { Brand, PaginationMeta, ServiceOrder } from '../types';
import { useTranslation } from '../services/i18n';
import { toLocalDateInputValue } from '../services/date';

const PREVIEW_PAGE_SIZE = 50;
const emptyPagination: PaginationMeta = {
  page: 1,
  limit: PREVIEW_PAGE_SIZE,
  total: 0,
  pages: 1,
  hasNext: false,
  hasPrev: false
};

const getCurrentMonthRange = () => {
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: toLocalDateInputValue(firstDay),
    endDate: toLocalDateInputValue(lastDay)
  };
};

const getLastMonthRange = () => {
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth(), 0);
  return {
    startDate: toLocalDateInputValue(firstDay),
    endDate: toLocalDateInputValue(lastDay)
  };
};

export const Reports: React.FC = () => {
  const { t, language } = useTranslation();
  const safeLanguage = language || 'pt-BR';
  const isPt = safeLanguage.startsWith('pt');
  const initialRange = useMemo(() => getCurrentMonthRange(), []);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [isSummaryOnly, setIsSummaryOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<'NONE' | 'BRAND'>('NONE');
  const [reportData, setReportData] = useState<ServiceOrder[]>([]);
  const [totals, setTotals] = useState({ service: 0, commission: 0, count: 0 });
  const [previewPage, setPreviewPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const formatCurrency = useCallback(
    (value: number) => new Intl.NumberFormat(safeLanguage, { style: 'currency', currency: 'BRL' }).format(value),
    [safeLanguage]
  );

  const sortReportRows = useCallback(
    (rows: ServiceOrder[]) => {
      const sorted = [...rows];
      sorted.sort((a, b) => {
        if (groupBy === 'BRAND') {
          const brandCompare = a.brand.localeCompare(b.brand);
          if (brandCompare !== 0) return brandCompare;
        }

        const dateCompare = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.osNumber - b.osNumber;
      });
      return sorted;
    },
    [groupBy]
  );

  const buildFilterParams = useCallback(
    () => ({
      startDate,
      endDate,
      brand: brandFilter,
      status: statusFilter
    }),
    [brandFilter, endDate, startDate, statusFilter]
  );

  const loadBrands = useCallback(async () => {
    try {
      const data = await getBrands();
      setBrands(data);
    } catch (error) {
      console.error('Erro ao carregar marcas', error);
    }
  }, []);

  const loadPreview = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        const response = await getOrders({
          ...buildFilterParams(),
          page,
          limit: PREVIEW_PAGE_SIZE
        });

        setReportData(sortReportRows(response.data));
        setPagination(response.pagination);
        setTotals({
          service: response.summary?.totalServiceValue || 0,
          commission: response.summary?.totalCommission || 0,
          count: response.summary?.totalOrders || 0
        });
      } catch (error) {
        console.error('Erro ao carregar relatórios', error);
      } finally {
        setIsLoading(false);
      }
    },
    [buildFilterParams, sortReportRows]
  );

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    setPreviewPage(1);
  }, [startDate, endDate, brandFilter, statusFilter]);

  useEffect(() => {
    loadPreview(previewPage);
  }, [loadPreview, previewPage]);

  useEffect(() => {
    const refresh = () => loadPreview(previewPage);
    window.addEventListener('orders-updated', refresh);
    return () => window.removeEventListener('orders-updated', refresh);
  }, [loadPreview, previewPage]);

  useEffect(() => {
    setReportData((current) => sortReportRows(current));
  }, [groupBy, sortReportRows]);

  const setThisMonth = () => {
    const range = getCurrentMonthRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const setLastMonth = () => {
    const range = getLastMonthRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const getExportData = useCallback(async () => {
    const exportRows = await getOrdersForExport({
      ...buildFilterParams(),
      limit: 5000
    });
    return sortReportRows(exportRows);
  }, [buildFilterParams, sortReportRows]);

  const generateExcel = async () => {
    try {
      setIsExporting(true);
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');
      const exportData = await getExportData();
      const exportTotals = exportData.reduce(
        (acc, item) => {
          acc.service += Number(item.serviceValue || 0);
          acc.commission += Number(item.commissionValue || 0);
          return acc;
        },
        { service: 0, commission: 0 }
      );

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Relatorio_Comissao');
      const settings = await getSettings().catch(() => ({}) as any);

      worksheet.columns = [
        { header: 'Data', key: 'date', width: 15, style: { alignment: { horizontal: 'center' } } },
        { header: 'O.S', key: 'osNumber', width: 15, style: { alignment: { horizontal: 'center' } } },
        { header: 'Cliente', key: 'customer', width: 35, style: { alignment: { horizontal: 'center' } } },
        { header: 'Marca', key: 'brand', width: 20, style: { alignment: { horizontal: 'center' } } },
        {
          header: 'Valor (R$)',
          key: 'service',
          width: 18,
          style: { numFmt: '_-R$ * #,##0.00_-;-R$ * #,##0.00_-;_-R$ * "-"??_-;_-@_-', alignment: { horizontal: 'center' } }
        },
        {
          header: 'Comissão (R$)',
          key: 'commission',
          width: 18,
          style: { numFmt: '_-R$ * #,##0.00_-;-R$ * #,##0.00_-;_-R$ * "-"??_-;_-@_-', alignment: { horizontal: 'center' } }
        },
        { header: 'Status', key: 'status', width: 15, style: { alignment: { horizontal: 'center' } } }
      ];

      const primaryColorHex = settings.primaryColor || '#6366f1';
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      worksheet.columns.forEach((_, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: primaryColorHex.replace('#', '') }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      exportData.forEach((order) => {
        worksheet.addRow({
          date: new Date(order.entryDate).toLocaleDateString('pt-BR'),
          osNumber: order.osNumber,
          customer: order.customerName,
          brand: order.brand,
          service: Number(order.serviceValue),
          commission: Number(order.commissionValue),
          status: t(`status.${order.status}`).toUpperCase()
        });
      });

      const totalRow = worksheet.addRow({
        date: 'TOTAL DE COMISSÃO NO PERÍODO',
        commission: exportTotals.commission
      });

      const currentRow = totalRow.number;
      worksheet.mergeCells(currentRow, 1, currentRow, 5);
      const mergedCell = totalRow.getCell(1);
      mergedCell.alignment = { horizontal: 'center', vertical: 'middle' };
      totalRow.font = { bold: true };
      totalRow.getCell('commission').numFmt = '_-R$ * #,##0.00_-;-R$ * #,##0.00_-;_-R$ * "-"??_-;_-@_-';
      totalRow.getCell('date').alignment = { horizontal: 'center' };

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          if (rowNumber === 1) return;
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `comissao_${startDate}_a_${endDate}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const generatePDF = async () => {
    try {
      setIsExporting(true);
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      const settings = await getSettings().catch(() => ({}) as any);
      const exportData = await getExportData();
      const exportTotals = exportData.reduce(
        (acc, item) => {
          acc.service += Number(item.serviceValue || 0);
          acc.commission += Number(item.commissionValue || 0);
          return acc;
        },
        { service: 0, commission: 0 }
      );

      const marginLeft = 15;
      const marginRight = 15;
      const pageWidth = doc.internal.pageSize.width;
      let cursorY = 20;
      const primaryColorHex = settings.primaryColor || '#6366f1';

      doc.setDrawColor(primaryColorHex);
      doc.setLineWidth(1.5);
      doc.line(marginLeft, cursorY - 8, pageWidth - marginRight, cursorY - 8);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      const systemName = (settings.companyName || import.meta.env.VITE_APP_NAME).toUpperCase();
      doc.text(systemName, marginLeft, cursorY);

      if (settings.companyCnpj) {
        cursorY += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`CNPJ: ${settings.companyCnpj}`, marginLeft, cursorY);
      }

      if (settings.companyAddress) {
        cursorY += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(settings.companyAddress, marginLeft, cursorY);
      }

      if (settings.companyContact) {
        cursorY += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`Contato: ${settings.companyContact}`, marginLeft, cursorY);
      }

      const titleY = 20;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('RELATÓRIO DE COMISSÃO', pageWidth - marginRight, titleY, { align: 'right' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const periodText = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;
      doc.text(`Período: ${periodText}`, pageWidth - marginRight, titleY + 6, { align: 'right' });

      const genDate = new Date().toLocaleString(safeLanguage);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${genDate}`, pageWidth - marginRight, titleY + 11, { align: 'right' });

      cursorY = Math.max(cursorY, titleY + 11) + 8;
      doc.setDrawColor(primaryColorHex);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, cursorY, pageWidth - marginRight, cursorY);
      cursorY += 10;

      const drawStat = (label: string, value: string, x: number) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(label.toUpperCase(), x, cursorY);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(value, x, cursorY + 6);
      };

      drawStat('TOTAL DE ORDENS', exportData.length.toString(), marginLeft);
      drawStat('COMISSÃO TOTAL', formatCurrency(exportTotals.commission), marginLeft + 50);
      cursorY += 15;

      if (isSummaryOnly) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('*** Fim do Resumo Executivo ***', pageWidth / 2, cursorY + 20, { align: 'center' });
      } else {
        const tableBody = exportData.map((order) => [
          new Date(order.entryDate).toLocaleDateString(safeLanguage),
          order.osNumber.toString(),
          order.customerName,
          order.brand,
          formatCurrency(order.serviceValue),
          formatCurrency(order.commissionValue),
          t(`status.${order.status}`).toUpperCase()
        ]);

        const tableFoot = [
          {
            content: 'TOTAL DE COMISSÃO NO PERÍODO',
            colSpan: 5,
            styles: { halign: 'right' as const, fontStyle: 'bold' as const, textColor: [60, 60, 60] }
          },
          {
            content: formatCurrency(exportTotals.commission),
            styles: { halign: 'right' as const, fontStyle: 'bold' as const, textColor: [0, 0, 0], fontSize: 10 }
          },
          { content: '' }
        ];

        autoTable(doc, {
          startY: cursorY,
          head: [['Data', 'O.S', 'Cliente', 'Marca', 'Valor (R$)', 'Comissão (R$)', 'Status']],
          body: tableBody,
          foot: [tableFoot],
          theme: 'plain',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 3,
            textColor: [60, 60, 60],
            lineWidth: 0,
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: primaryColorHex,
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 3
          },
          footStyles: {
            fillColor: [248, 248, 248],
            cellPadding: 3,
            lineColor: [220, 220, 220],
            lineWidth: { top: 0.1 }
          },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 'auto', halign: 'center' },
            3: { cellWidth: 28, halign: 'center' },
            4: { cellWidth: 28, halign: 'center' },
            5: { cellWidth: 28, halign: 'center' },
            6: { cellWidth: 22, halign: 'center' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index % 2 === 1) {
              data.cell.styles.fillColor = [250, 250, 250];
            }

            if (data.section === 'body' && data.column.index === 6) {
              const status = data.cell.raw as string;
              if (status === 'PAGO' || status === 'PAID') {
                data.cell.styles.textColor = [20, 120, 60];
              } else {
                data.cell.styles.textColor = [180, 100, 0];
              }
              data.cell.styles.fontStyle = 'bold';
            }
          },
          margin: { left: marginLeft, right: marginRight },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) {
              doc.setFontSize(8);
              doc.setTextColor(150, 150, 150);
              doc.text(`Relatório de Comissão - ${systemName}`, marginLeft, 10);
            }

            const pageCount = doc.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            const sysName = import.meta.env.VITE_APP_NAME;
            doc.text(sysName, marginLeft, doc.internal.pageSize.height - 10);
            doc.text(`${t('reports.page')} ${data.pageNumber} ${t('reports.of')} ${pageCount}`, pageWidth - marginRight, doc.internal.pageSize.height - 10, { align: 'right' });
          }
        });
      }

      const fileName = isSummaryOnly ? `Resumo_Executivo_${startDate}.pdf` : `Relatorio_Comissao_${startDate}.pdf`;
      doc.save(fileName);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('reports.title')}</h2>
        <p className="text-slate-500 dark:text-slate-400">{t('reports.subtitle')}</p>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={setThisMonth} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400">
            {t('reports.thisMonth')}
          </button>
          <button onClick={setLastMonth} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">
            {t('reports.lastMonth')}
          </button>
        </div>

        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Input label={t('reports.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label={t('reports.endDate')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('common.brands')}</label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-950/50 dark:text-slate-100"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <option value="ALL">{t('orders.allBrands')}</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-950/50 dark:text-slate-100"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'PAID')}
              >
                <option value="ALL">{t('status.ALL')}</option>
                <option value="PENDING">{t('status.PENDING')}</option>
                <option value="PAID">{t('status.PAID')}</option>
              </select>
              <Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('reports.sortBy')}</label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-950/50 dark:text-slate-100"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'NONE' | 'BRAND')}
              >
                <option value="NONE">{t('reports.defaultSort')}</option>
                <option value="BRAND">{t('reports.brandSort')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="summaryOnly"
            checked={isSummaryOnly}
            onChange={(e) => setIsSummaryOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="summaryOnly" className="text-sm text-slate-600 dark:text-slate-300">
            {t('reports.summaryOnly')}
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/5 dark:bg-slate-800/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.totalOrders')}</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{totals.count}</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/5 dark:bg-slate-800/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Download size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.totalVolume')}</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totals.service)}</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/5 dark:bg-slate-800/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.totalCommission')}</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totals.commission)}</h4>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={generatePDF} icon={<FileText size={18} />} disabled={isExporting || isLoading}>
          {t('reports.genPdf')}
        </Button>
        <Button onClick={generateExcel} variant="secondary" icon={<FileSpreadsheet size={18} />} disabled={isExporting || isLoading}>
          {t('reports.exportExcel')}
        </Button>
      </div>

      {!isSummaryOnly && (
        <Card title={t('reports.preview')} className="overflow-hidden">
          <div className="max-h-[500px] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-100 text-slate-500 dark:border-white/5 dark:text-slate-400">
                  <th className="px-6 py-4 font-medium">{t('orders.date')}</th>
                  <th className="px-6 py-4 font-medium">{t('orders.osNumber')}</th>
                  <th className="px-6 py-4 font-medium">{t('orders.customer')}</th>
                  <th className="px-6 py-4 font-medium">{t('orders.brand')}</th>
                  <th className="px-6 py-4 text-right font-medium">{t('common.value')}</th>
                  <th className="px-6 py-4 text-right font-medium">{t('dashboard.commission')}</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
                        <span>{isPt ? 'Carregando prévia...' : 'Loading preview...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                      {t('reports.noData')}
                    </td>
                  </tr>
                ) : (
                  reportData.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600 dark:text-slate-300">{new Date(order.entryDate).toLocaleDateString(safeLanguage)}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">#{order.osNumber}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{order.customerName}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{order.brand}</td>
                      <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">{formatCurrency(order.serviceValue)}</td>
                      <td className="px-6 py-4 text-right font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(order.commissionValue)}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${order.status === 'PAID' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}
                        >
                          {t(`status.${order.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={setPreviewPage} isLoading={isLoading} language={safeLanguage} />
        </Card>
      )}
    </div>
  );
};
