export const toLocalDateInputValue = (date: Date = new Date()) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().split('T')[0];
};
