import {
  bookingReport,
  bookingTotals,
  deploymentsIn,
  compareTotals,
  funnelFor,
  precedingPeriod,
  ratio,
  summarize,
} from '@features/booking-dashboard/domain/booking-analytics';
import { DATASET_PERIOD, INITIAL_FILTERS } from '@features/booking-dashboard/domain/booking-model';
import { DemoDataRepository, validateDailyFixture } from './demo-data.repository';
import { isCalendarDay, readPeriod } from '@features/booking-dashboard/domain/validation';

const before = { startDate: '2026-11-03', endDate: '2026-11-11' };
const after = { startDate: '2026-11-12', endDate: '2026-11-20' };

describe('Demo fixtures and booking analytics', () => {
  const { dailyRows, deployments } = new DemoDataRepository().dataset;

  it('loads all 80 unique cohorts with valid descending stage counts', () => {
    const rows = dailyRows;
    expect(rows).toHaveLength(80);
    expect(new Set(rows.map(({ date, segment }) => `${date}/${segment}`)).size).toBe(80);
    expect(validateDailyFixture(rows)).toEqual(rows);
    expect(() => validateDailyFixture([...rows.slice(1), rows[1]])).toThrow('Invalid demo fixture');
    for (const fareSelected of [-1, 0.5, 999_999]) {
      expect(() => validateDailyFixture([{ ...rows[0], fareSelected }, ...rows.slice(1)])).toThrow(
        'Invalid demo fixture',
      );
    }
  });

  it('returns the initial dashboard totals with no partial baseline', () => {
    expect(bookingTotals(dailyRows, INITIAL_FILTERS, 'all')).toMatchObject({
      search: 180_000,
      purchaseCompleted: 6_660,
      bookingConversion: 0.037,
    });
    expect(precedingPeriod(INITIAL_FILTERS)).toBeNull();
  });

  it('compares two full periods and aggregates counts before computing rates', () => {
    const earlier = bookingReport(dailyRows, before, 'all');
    const later = bookingReport(dailyRows, after, 'all');
    expect(earlier.totals).toMatchObject({
      search: 90_000,
      purchaseCompleted: 3_600,
      bookingConversion: 0.04,
    });
    expect(later.totals).toMatchObject({
      search: 90_000,
      purchaseCompleted: 3_060,
      bookingConversion: 0.034,
    });
    expect(later.dailySeries).toHaveLength(9);
    expect(later.dailySeries[0]).toMatchObject({
      date: after.startDate,
      search: 10_000,
      purchaseCompleted: 340,
    });
    expect(
      later.segments.reduce((sum, item) => sum + (item.bookingConversion ?? 0), 0) / 4,
    ).toBeCloseTo(0.0325);
    const comparison = compareTotals(later.totals, earlier.totals);
    expect(comparison).toMatchObject({
      bookingDifference: -540,
      expectedBookingsAtBaselineRate: 3_600,
      bookingDifferenceVsExpected: -540,
    });
    expect(comparison.conversionChangePp).toBeCloseTo(-0.6);
    expect(comparison.relativeConversionChange).toBeCloseTo(-0.15);
    expect(precedingPeriod(after)).toEqual(before);
  });

  it('isolates the booking loss and both worsened Mobile Safari transitions', () => {
    const earlier = bookingReport(dailyRows, before, 'mobile_safari');
    const later = bookingReport(dailyRows, after, 'mobile_safari');
    expect(earlier.totals).toMatchObject({ purchaseCompleted: 720, bookingConversion: 0.04 });
    expect(later.totals).toMatchObject({ purchaseCompleted: 180, bookingConversion: 0.01 });
    expect(later.segments).toEqual(bookingReport(dailyRows, after, 'all').segments);
    expect(later.segments.slice(0, 3)).toEqual(earlier.segments.slice(0, 3));
    expect(earlier.funnel[2].transitionRate).toBe(0.5);
    expect(later.funnel[2].transitionRate).toBe(0.25);
    expect(earlier.funnel[4].transitionRate).toBe(0.4);
    expect(later.funnel[4].transitionRate).toBe(0.2);
    expect(compareTotals(later.totals, earlier.totals).conversionChangePp).toBeCloseTo(-3);
    expect(compareTotals(later.totals, earlier.totals).relativeConversionChange).toBeCloseTo(-0.75);
  });

  it('represents undefined ratios and comparisons as null', () => {
    const empty = summarize([]);
    expect(ratio(0, 0)).toBeNull();
    expect(empty.bookingConversion).toBeNull();
    expect(
      funnelFor(empty).every(
        (stage) => stage.transitionRate === null && stage.rateFromSearch === null,
      ),
    ).toBe(true);
    expect(compareTotals(empty, empty).conversionChangePp).toBeNull();
  });

  it('validates calendar dates and includes both boundaries', () => {
    expect(isCalendarDay('2024-02-29')).toBe(true);
    expect(isCalendarDay('2026-02-29')).toBe(false);
    expect(isCalendarDay('2026-04-31')).toBe(false);
    expect(isCalendarDay('2026-11-01T00:00:00Z')).toBe(false);
    expect(readPeriod(DATASET_PERIOD.startDate, DATASET_PERIOD.endDate)).toEqual(DATASET_PERIOD);
    expect(() => readPeriod(after.endDate, before.startDate)).toThrow('before end date');
    expect(() => readPeriod('2026-10-31', after.endDate)).toThrow('November 1–20');
    expect(precedingPeriod({ startDate: '2026-11-02', endDate: '2026-11-02' })).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-01',
    });
  });

  it('returns deployments on inclusive UTC days in chronological order', () => {
    expect(
      deploymentsIn(deployments, DATASET_PERIOD).map(({ deployedAt }) => deployedAt.slice(0, 10)),
    ).toEqual(['2026-11-05', '2026-11-12', '2026-11-17']);
    expect(
      deploymentsIn(deployments, { startDate: '2026-11-12', endDate: '2026-11-12' }),
    ).toMatchObject([{ id: 'rel-2026-11-12', title: 'Fare selector v2' }]);
    expect(deploymentsIn(deployments, { startDate: '2026-11-01', endDate: '2026-11-01' })).toEqual(
      [],
    );
  });
});
