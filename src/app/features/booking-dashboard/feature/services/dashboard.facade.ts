import { inject, Injectable, Provider } from '@angular/core';
import { AnnotationAdapter } from '@features/booking-dashboard/data-access/annotation.adapter';
import {
  bookingSiteTools,
  readDeploymentPeriod,
  readMetricsRequest,
} from '@features/booking-dashboard/data-access/booking-site-tools';
import { DemoDataRepository } from '@features/booking-dashboard/data-access/demo-data.repository';
import { WebMcpAdapter } from '@features/booking-dashboard/data-access/web-mcp.adapter';
import {
  bookingReport,
  compareTotals,
  deploymentsIn,
} from '@features/booking-dashboard/domain/booking-analytics';
import {
  ChartId,
  INITIAL_FILTERS,
  Period,
  resultOf,
  ViewState,
} from '@features/booking-dashboard/domain/booking-model';
import { containsDay } from '@features/booking-dashboard/domain/validation';
import { ActivityEntry, ActivityStore } from '@features/booking-dashboard/state/activity.store';
import { DashboardStore } from '@features/booking-dashboard/state/dashboard.store';

@Injectable()
export class DashboardFacade {
  private readonly dashboard = inject(DashboardStore);
  private readonly activity = inject(ActivityStore);
  private readonly data = inject(DemoDataRepository).dataset;
  private readonly annotations = inject(AnnotationAdapter);
  private readonly webMcp = inject(WebMcpAdapter);

  readonly annotationsAvailable = this.annotations.available;
  readonly siteToolsAvailable = this.webMcp.available;
  readonly siteToolsReady = this.webMcp.ready;

  mount(): () => void {
    this.annotations.detect();
    return this.webMcp.mount(
      bookingSiteTools({
        queryMetrics: async (args) =>
          this.record('Agent tool', 'query_booking_metrics', args, () => this.queryMetrics(args)),
        getDeployments: async (args) =>
          this.record('Agent tool', 'get_deployments', args, () => {
            const requestedPeriod = readDeploymentPeriod(args);
            return {
              synthetic: true,
              requestedPeriod,
              deployments: deploymentsIn(this.data.deployments, requestedPeriod),
            };
          }),
        setView: async (args) =>
          this.record('Agent tool', 'set_dashboard_view', args, () => this.dashboard.setView(args)),
      }),
    );
  }

  applyDates(period: Period) {
    const currentHighlight = this.dashboard
      .deployments()
      .find(({ id }) => id === this.dashboard.view().highlightedDeploymentId);
    const keepHighlight =
      currentHighlight && containsDay(period, currentHighlight.deployedAt.slice(0, 10));
    return this.updateView({
      ...period,
      highlightedDeploymentId: keepHighlight ? currentHighlight.id : null,
    });
  }

  selectSegment(segment: string) {
    return this.updateView({ segment });
  }

  toggleDeployment(id: string) {
    return this.updateView({
      highlightedDeploymentId: id === this.dashboard.view().highlightedDeploymentId ? null : id,
    });
  }

  reset(): void {
    this.updateView(INITIAL_FILTERS);
    this.activity.clear();
  }

  annotationMetadata(chartId: ChartId): string {
    return JSON.stringify(this.annotations.metadata(chartId, this.dashboard.view()));
  }

  requestAnnotation(target: HTMLElement, chartId: ChartId): boolean {
    return this.annotations.request(target, chartId, this.dashboard.view());
  }

  private updateView(
    patch: Partial<Omit<ViewState, 'stateVersion' | 'segment'>> & { segment?: string },
  ) {
    const { stateVersion, ...filters } = this.dashboard.view();
    const args = { ...filters, ...patch, expectedStateVersion: stateVersion };
    return this.record('User', 'set_dashboard_view', args, () => this.dashboard.setView(args));
  }

  private queryMetrics(input: unknown) {
    const { chartId, segment, period, baseline: baselinePeriod } = readMetricsRequest(input);
    const rows = this.data.dailyRows;
    const report = bookingReport(rows, period, segment);
    const common = {
      datasetId: 'airline-demo-v1',
      synthetic: true,
      units: {
        counts: 'sessions',
        rates: 'proportions from 0 to 1',
        conversionChangePp: 'percentage points',
      },
      conversionDefinition:
        'Sessions that completed a purchase divided by search sessions in the same cohort.',
      requestedFilters: { chartId, ...period, segment },
      currentView: this.dashboard.view(),
      ...report,
    };
    if (!baselinePeriod) return common;

    const baseline = bookingReport(rows, baselinePeriod, segment);
    return {
      ...common,
      baseline: { period: baselinePeriod, ...baseline },
      comparison: {
        ...compareTotals(report.totals, baseline.totals),
        funnel: report.funnel.map((after, index) => ({
          stage: after.id,
          before: baseline.funnel[index],
          after,
        })),
        segments: report.segments.map((after, index) => {
          const before = baseline.segments[index];
          return { segment: after.segment, before, after, ...compareTotals(after, before) };
        }),
      },
    };
  }

  private record<T>(
    source: ActivityEntry['source'],
    name: string,
    args: unknown,
    operation: () => T,
  ) {
    const result = resultOf(operation);
    this.activity.record({
      source,
      name,
      time: new Date().toLocaleTimeString(),
      args: display(args),
      result: display(result),
      ok: result.ok,
    });
    return result;
  }
}

export const DASHBOARD_PAGE_PROVIDERS: Provider[] = [
  DashboardFacade,
  ActivityStore,
  {
    provide: DashboardStore,
    useFactory: () => new DashboardStore(inject(DemoDataRepository).dataset),
  },
];

function display(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return 'Arguments could not be serialized.';
  }
}
