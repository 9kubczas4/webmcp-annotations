import { DashboardStore } from './dashboard.store';
import {
  BookingDataset,
  INITIAL_FILTERS,
  resultOf,
} from '@features/booking-dashboard/domain/booking-model';

const initial = { ...INITIAL_FILTERS, expectedStateVersion: 1 };
const change = { ...initial, segment: 'mobile_safari', highlightedDeploymentId: 'rel-2026-11-12' };

const dataset: BookingDataset = {
  dailyRows: [
    {
      date: '2026-11-12',
      segment: 'mobile_safari',
      search: 36_000,
      resultsViewed: 21_600,
      fareSelected: 8_100,
      checkoutStarted: 2_700,
      purchaseCompleted: 900,
    },
  ],
  deployments: [
    {
      id: 'rel-2026-11-12',
      deployedAt: '2026-11-12T08:00:00Z',
      title: 'Fare selector v2',
      components: ['fare-selector'],
    },
  ],
};

describe('DashboardStore', () => {
  const store = () => new DashboardStore(dataset);

  it('updates all filters and the shared report atomically', () => {
    const dashboard = store();
    const old = dashboard.view();
    expect(dashboard.setView(change)).toEqual({
      previousView: old,
      currentView: {
        ...INITIAL_FILTERS,
        segment: 'mobile_safari',
        highlightedDeploymentId: 'rel-2026-11-12',
        stateVersion: 2,
      },
      changed: true,
    });
    expect(dashboard.report().totals).toMatchObject({ search: 36_000, bookingConversion: 0.025 });
  });

  it('rejects an out-of-date writer and preserves the current state', () => {
    const dashboard = store();
    dashboard.setView(change);
    const current = dashboard.view();
    expect(resultOf(() => dashboard.setView(initial))).toMatchObject({
      ok: false,
      error: { code: 'STALE_VIEW' },
    });
    expect(dashboard.view()).toBe(current);
  });

  it.each([
    [{ startDate: '2026-11-31' }, 'INVALID_ARGUMENT'],
    [{ endDate: '2026-11-21' }, 'OUT_OF_RANGE'],
    [{ segment: 'tablet' }, 'INVALID_ARGUMENT'],
    [{ expectedStateVersion: 1.5 }, 'INVALID_ARGUMENT'],
    [{ highlightedDeploymentId: 12 }, 'INVALID_ARGUMENT'],
    [{ highlightedDeploymentId: 'missing' }, 'UNKNOWN_ID'],
    [{ startDate: '2026-11-13', highlightedDeploymentId: 'rel-2026-11-12' }, 'OUT_OF_RANGE'],
    [{ extra: true }, 'INVALID_ARGUMENT'],
  ])('keeps the view unchanged after invalid input %j', (patch, code) => {
    const dashboard = store();
    const old = dashboard.view();
    expect(resultOf(() => dashboard.setView({ ...initial, ...patch }))).toMatchObject({
      ok: false,
      error: { code },
    });
    expect(dashboard.view()).toBe(old);
  });

  it('requires an explicit highlight field and does not bump versions for no-ops', () => {
    const dashboard = store();
    const incomplete = {
      startDate: initial.startDate,
      endDate: initial.endDate,
      segment: initial.segment,
      expectedStateVersion: 1,
    };
    expect(resultOf(() => dashboard.setView(incomplete))).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
    });
    expect(dashboard.setView(initial)).toMatchObject({
      changed: false,
      currentView: { stateVersion: 1 },
    });
    dashboard.setView(change);
    expect(dashboard.setView({ ...initial, expectedStateVersion: 2 })).toMatchObject({
      changed: true,
      currentView: { ...INITIAL_FILTERS, stateVersion: 3 },
    });
  });
});
