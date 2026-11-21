import { DATASET_PERIOD, DemoError, FILTERS, Period, SegmentFilter } from './booking-model';

const DAY_MS = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / DAY_MS;
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

export function containsDay(period: Period, date: string): boolean {
  return period.startDate <= date && date <= period.endDate;
}

export function readPeriod(startDate: unknown, endDate: unknown): Period {
  if (!isCalendarDay(startDate) || !isCalendarDay(endDate)) {
    throw new DemoError(
      'INVALID_ARGUMENT',
      'Dates must be valid calendar days in YYYY-MM-DD format.',
    );
  }
  if (startDate > endDate) {
    throw new DemoError('INVALID_ARGUMENT', 'Start date must be on or before end date.');
  }
  if (!containsDay(DATASET_PERIOD, startDate) || !containsDay(DATASET_PERIOD, endDate)) {
    throw new DemoError('OUT_OF_RANGE', 'The dataset covers November 1–20, 2026.');
  }
  return { startDate, endDate };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readArguments(
  input: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (!isRecord(input)) {
    throw new DemoError('INVALID_ARGUMENT', 'Arguments must be a JSON object.');
  }
  if (required.some((key) => !Object.hasOwn(input, key))) {
    throw new DemoError('INVALID_ARGUMENT', `Required fields: ${required.join(', ')}.`);
  }
  if (Object.keys(input).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new DemoError('INVALID_ARGUMENT', 'Unexpected argument fields.');
  }
  return input;
}

export function readSegment(value: unknown): SegmentFilter {
  const segment = FILTERS.find((id) => id === value);
  if (!segment) throw new DemoError('INVALID_ARGUMENT', 'Select a supported traffic segment.');
  return segment;
}
