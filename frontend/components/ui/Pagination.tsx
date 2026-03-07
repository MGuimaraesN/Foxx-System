import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationMeta } from '../../types';

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  language?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange, isLoading = false, language = 'pt-BR' }) => {
  const isPt = language.startsWith('pt');
  const previousLabel = isPt ? 'Anterior' : 'Previous';
  const nextLabel = isPt ? 'Próxima' : 'Next';
  const pageLabel = isPt ? 'Página' : 'Page';
  const showingLabel = isPt ? 'Mostrando' : 'Showing';
  const ofLabel = isPt ? 'de' : 'of';

  const total = pagination.total || 0;
  const currentPage = pagination.page || 1;
  const pageSize = pagination.limit || 1;
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
      <span>
        {showingLabel} <strong className="text-slate-700 dark:text-slate-200">{from}-{to}</strong> {ofLabel}{' '}
        <strong className="text-slate-700 dark:text-slate-200">{total}</strong>
      </span>

      <div className="flex items-center gap-2 self-end md:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isLoading || !pagination.hasPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <ChevronLeft size={16} />
          {previousLabel}
        </button>

        <span className="min-w-[110px] text-center font-medium text-slate-700 dark:text-slate-200">
          {pageLabel} {currentPage} / {pagination.pages || 1}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLoading || !pagination.hasNext}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          {nextLabel}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
