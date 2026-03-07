export const getDaysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

export const getBiWeeklyPeriodRange = (
  dateStr: string,
  strategy: 'BIWEEKLY' | 'MONTHLY' = 'BIWEEKLY'
): { start: Date; end: Date } => {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  let startDay = 1;
  let endDay = 15;

  if (strategy === 'MONTHLY') {
    startDay = 1;
    endDay = getDaysInMonth(year, month);
  } else if (day > 15) {
    startDay = 16;
    endDay = getDaysInMonth(year, month);
  }

  const start = new Date(Date.UTC(year, month, startDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, endDay, 0, 0, 0, 0));

  return { start, end };
};
