export const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const getBiWeeklyPeriodRange = (dateStr: string, strategy: 'BIWEEKLY' | 'MONTHLY' = 'BIWEEKLY'): { start: Date, end: Date } => {
  // Parse YYYY-MM-DD manually to avoid timezone issues
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // 0-indexed
  const day = parseInt(parts[2]);

  let startDay = 1;
  let endDay = 15;

  if (strategy === 'MONTHLY') {
      startDay = 1;
      endDay = getDaysInMonth(year, month);
  } else {
      // Default: BIWEEKLY
      if (day > 15) {
        startDay = 16;
        endDay = getDaysInMonth(year, month);
      }
  }

  const start = new Date(year, month, startDay);
  const end = new Date(year, month, endDay);

  return { start, end };
};
