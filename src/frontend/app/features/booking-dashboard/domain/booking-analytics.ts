import {
  DailyRow,
  DATASET_PERIOD,
  Deployment,
  FunnelCounts,
  Period,
  SEGMENTS,
  SegmentFilter,
  STAGES,
} from './booking-model';
import { containsDay, daysBetween, shiftDate } from './validation';

export const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? null : numerator / denominator;

const difference = (after: number | null, before: number | null) =>
  after === null || before === null ? null : after - before;

export function summarize(rows: readonly FunnelCounts[]) {
  const counts: FunnelCounts = {
    search: 0,
    resultsViewed: 0,
    fareSelected: 0,
    checkoutStarted: 0,
    purchaseCompleted: 0,
  };
  for (const row of rows) {
    for (const { id } of STAGES) counts[id] += row[id];
  }
  return { ...counts, bookingConversion: ratio(counts.purchaseCompleted, counts.search) };
}

export function funnelFor(counts: FunnelCounts) {
  return STAGES.map(({ id, label }, index) => ({
    id,
    label,
    count: counts[id],
    rateFromSearch: ratio(counts[id], counts.search),
    transitionRate: index === 0 ? null : ratio(counts[id], counts[STAGES[index - 1].id]),
  }));
}

export function precedingPeriod(period: Period): Period | null {
  const endDate = shiftDate(period.startDate, -1);
  const startDate = shiftDate(endDate, -daysBetween(period.startDate, period.endDate));
  return containsDay(DATASET_PERIOD, startDate) ? { startDate, endDate } : null;
}

type Totals = ReturnType<typeof summarize>;

export function compareTotals(after: Totals, before: Totals) {
  const conversionDifference = difference(after.bookingConversion, before.bookingConversion);
  const expectedBookings =
    before.bookingConversion === null ? null : after.search * before.bookingConversion;
  return {
    searchDifference: after.search - before.search,
    bookingDifference: after.purchaseCompleted - before.purchaseCompleted,
    conversionChangePp: conversionDifference === null ? null : conversionDifference * 100,
    relativeConversionChange:
      conversionDifference === null || before.bookingConversion === null
        ? null
        : ratio(conversionDifference, before.bookingConversion),
    expectedBookingsAtBaselineRate: expectedBookings,
    bookingDifferenceVsExpected:
      expectedBookings === null ? null : after.purchaseCompleted - expectedBookings,
  };
}

export function bookingTotals(
  dailyRows: readonly DailyRow[],
  period: Period,
  segment: SegmentFilter,
) {
  return summarize(
    dailyRows.filter(
      (row) => containsDay(period, row.date) && (segment === 'all' || row.segment === segment),
    ),
  );
}

export function bookingReport(
  dailyRows: readonly DailyRow[],
  period: Period,
  segment: SegmentFilter,
) {
  const rows = dailyRows.filter((row) => containsDay(period, row.date));
  const selected = segment === 'all' ? rows : rows.filter((row) => row.segment === segment);
  const totals = summarize(selected);
  const traffic = summarize(rows).search;
  const dates = [...new Set(selected.map((row) => row.date))].sort();

  return {
    totals,
    dailySeries: dates.map((date) => ({
      date,
      ...summarize(selected.filter((row) => row.date === date)),
    })),
    funnel: funnelFor(totals),
    segments: SEGMENTS.map((id) => {
      const counts = summarize(rows.filter((row) => row.segment === id));
      return { segment: id, ...counts, trafficShare: ratio(counts.search, traffic) };
    }),
  };
}

export function deploymentsIn(deployments: readonly Deployment[], period: Period): Deployment[] {
  return deployments.filter(({ deployedAt }) => containsDay(period, deployedAt.slice(0, 10)));
}
