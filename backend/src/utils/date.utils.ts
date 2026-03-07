const DATE_PREFIX_REGEX = /^(\d{4}-\d{2}-\d{2})/;

export const toDateOnlyString = (value: string | Date): string => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid date value');
    }
    return value.toISOString().split('T')[0];
  }

  const trimmed = value.trim();
  const match = trimmed.match(DATE_PREFIX_REGEX);
  if (match) {
    return match[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return parsed.toISOString().split('T')[0];
};

export const startOfUtcDay = (value: string | Date): Date => {
  const [year, month, day] = toDateOnlyString(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

export const endOfUtcDay = (value: string | Date): Date => {
  const [year, month, day] = toDateOnlyString(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
};

export const toUtcDateOnlyDate = (value: string | Date): Date => startOfUtcDay(value);
