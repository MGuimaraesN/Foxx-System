const DATE_PREFIX_REGEX = /^(\d{4}-\d{2}-\d{2})/;

export const toLocalDateInputValue = (date: Date = new Date()) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().split('T')[0];
};

export const normalizeDateOnly = (value?: string | Date | null) => {
  if (!value) return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().split('T')[0];
  }

  const trimmed = value.trim();
  const match = trimmed.match(DATE_PREFIX_REGEX);
  if (match) {
    return match[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

export const formatDateOnly = (
  value?: string | Date | null,
  locale = 'pt-BR',
  options?: Intl.DateTimeFormatOptions
) => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return '';

  const [year, month, day] = normalized.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    ...(options || {})
  }).format(new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)));
};
