const integer = new Intl.NumberFormat('en-US');
const percentage = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const count = (value: number) => integer.format(value);
export const percent = (value: number | null) => (value === null ? '—' : percentage.format(value));
export const dayLabel = (date: string) => shortDate.format(Date.parse(date));
