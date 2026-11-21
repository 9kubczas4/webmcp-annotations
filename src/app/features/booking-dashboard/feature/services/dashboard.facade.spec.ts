import { TestBed } from '@angular/core/testing';
import { ActivityStore } from '@features/booking-dashboard/state/activity.store';
import { DashboardStore } from '@features/booking-dashboard/state/dashboard.store';
import { SiteTool } from '@features/booking-dashboard/data-access/booking-site-tools';
import { DASHBOARD_PAGE_PROVIDERS, DashboardFacade } from './dashboard.facade';

const period = { startDate: '2026-11-12', endDate: '2026-11-20' };
const query = {
  ...period,
  chartId: 'booking-conversion-chart',
  segment: 'all',
  baselineStartDate: '2026-11-03',
  baselineEndDate: '2026-11-11',
};

function setup() {
  const tools = new Map<string, SiteTool>();
  const registerTool = vi.fn(async (tool: SiteTool, { signal }: { signal: AbortSignal }) => {
    tools.set(tool.name, tool);
    signal.addEventListener('abort', () => tools.delete(tool.name), { once: true });
  });
  Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } });
  TestBed.configureTestingModule({ providers: DASHBOARD_PAGE_PROVIDERS });
  const adapter = TestBed.inject(DashboardFacade);
  const dispose = adapter.mount();
  return { adapter, dispose, tools, registerTool };
}

describe('DashboardFacade with WebMCP (test host)', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'modelContext');
  });

  it('registers three tools once per mount and aborts registrations on cleanup', async () => {
    const { adapter, dispose, tools, registerTool } = setup();
    adapter.mount();
    await vi.waitFor(() => expect(adapter.siteToolsReady()).toBe(true));
    expect(registerTool).toHaveBeenCalledTimes(3);
    expect([...tools.values()].map((tool) => [tool.name, tool.annotations.readOnlyHint])).toEqual([
      ['query_booking_metrics', true],
      ['get_deployments', true],
      ['set_dashboard_view', false],
    ]);
    expect(TestBed.inject(ActivityStore).log()).toHaveLength(0);
    dispose();
    expect(tools.size).toBe(0);
    const disposeAgain = adapter.mount();
    await vi.waitFor(() => expect(registerTool).toHaveBeenCalledTimes(6));
    disposeAgain();
    expect(tools.size).toBe(0);
  });

  it('returns read-only evidence and applies the actual shared view through its write handler', async () => {
    const { adapter, tools, dispose } = setup();
    await vi.waitFor(() => expect(adapter.siteToolsReady()).toBe(true));
    const metrics = tools.get('query_booking_metrics')!;
    const deployments = tools.get('get_deployments')!;
    const setView = tools.get('set_dashboard_view')!;
    const store = TestBed.inject(DashboardStore);
    const original = store.view();

    expect(await metrics.execute(query)).toMatchObject({
      ok: true,
      data: {
        synthetic: true,
        currentView: original,
        requestedFilters: { ...period, segment: 'all' },
        totals: { purchaseCompleted: 3_060 },
        baseline: { totals: { purchaseCompleted: 3_600 } },
        comparison: {
          bookingDifference: -540,
          segments: expect.arrayContaining([
            expect.objectContaining({ segment: 'mobile_safari', bookingDifference: -540 }),
          ]),
        },
      },
    });
    expect(
      await metrics.execute({
        ...query,
        chartId: 'booking-funnel-chart',
        segment: 'mobile_safari',
      }),
    ).toMatchObject({
      ok: true,
      data: {
        comparison: {
          funnel: expect.arrayContaining([
            expect.objectContaining({
              stage: 'fareSelected',
              before: expect.objectContaining({ transitionRate: 0.5 }),
              after: expect.objectContaining({ transitionRate: 0.25 }),
            }),
            expect.objectContaining({
              stage: 'purchaseCompleted',
              before: expect.objectContaining({ transitionRate: 0.4 }),
              after: expect.objectContaining({ transitionRate: 0.2 }),
            }),
          ]),
        },
      },
    });
    expect(
      await deployments.execute({ startDate: '2026-11-10', endDate: '2026-11-14' }),
    ).toMatchObject({ ok: true, data: { deployments: [{ id: 'rel-2026-11-12' }] } });
    expect(store.view()).toBe(original);
    const view = {
      startDate: original.startDate,
      endDate: original.endDate,
      segment: 'mobile_safari',
      highlightedDeploymentId: 'rel-2026-11-12',
      expectedStateVersion: 1,
    };
    expect(await setView.execute(view)).toMatchObject({
      ok: true,
      data: {
        changed: true,
        currentView: { segment: 'mobile_safari', stateVersion: 2 },
      },
    });
    expect(await setView.execute(view)).toMatchObject({ ok: false, error: { code: 'STALE_VIEW' } });
    expect(store.view()).toMatchObject({
      segment: 'mobile_safari',
      highlightedDeploymentId: 'rel-2026-11-12',
      stateVersion: 2,
    });
    expect(
      TestBed.inject(ActivityStore)
        .log()
        .map((entry) => [entry.source, entry.name, entry.ok]),
    ).toEqual([
      ['Agent tool', 'set_dashboard_view', false],
      ['Agent tool', 'set_dashboard_view', true],
      ['Agent tool', 'get_deployments', true],
      ['Agent tool', 'query_booking_metrics', true],
      ['Agent tool', 'query_booking_metrics', true],
    ]);
    dispose();
  });

  it('validates baseline pairs, lengths, overlap, IDs and extra arguments in the handler', async () => {
    const { adapter, tools, dispose } = setup();
    await vi.waitFor(() => expect(adapter.siteToolsReady()).toBe(true));
    const metrics = tools.get('query_booking_metrics')!;
    const partial = {
      ...period,
      chartId: query.chartId,
      segment: query.segment,
      baselineEndDate: query.baselineEndDate,
    };
    for (const invalid of [
      partial,
      { ...query, baselineStartDate: '2026-11-02' },
      { ...query, baselineStartDate: period.startDate, baselineEndDate: period.endDate },
      { ...query, extra: true },
      null,
    ]) {
      expect(await metrics.execute(invalid)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_ARGUMENT' },
      });
    }
    expect(await metrics.execute({ ...query, chartId: 'unknown' })).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_ID' },
    });
    dispose();
  });
});
