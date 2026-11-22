import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { AnnotationAdapter } from '@features/booking-dashboard/data-access/annotation.adapter';
import {
  readDeploymentPeriod,
  readMetricsRequest,
} from '@features/booking-dashboard/data-access/booking-site-tools';
import { DemoDataRepository } from '@features/booking-dashboard/data-access/demo-data.repository';
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
  ToolResult,
  ViewState,
} from '@features/booking-dashboard/domain/booking-model';
import { containsDay } from '@features/booking-dashboard/domain/validation';
import { ActivityEntry, ActivityStore } from '@features/booking-dashboard/state/activity.store';
import { DashboardStore } from '@features/booking-dashboard/state/dashboard.store';

const MAX_ACTIVITY_TEXT_LENGTH = 4_000;

@Injectable()
export class DashboardFacade {
  private readonly dashboard = inject(DashboardStore);
  private readonly activity = inject(ActivityStore);
  private readonly dataset = inject(DemoDataRepository).dataset;
  private readonly annotations = inject(AnnotationAdapter);
  private readonly document = inject(DOCUMENT);
  private readonly detectedSiteTools = signal(false);

  readonly annotationsAvailable = this.annotations.available;
  readonly siteToolsAvailable = this.detectedSiteTools.asReadonly();

  constructor() {
    this.annotations.detect();
    const navigator = this.document.defaultView?.navigator as
      (Navigator & Pick<Document, 'modelContext'>) | undefined;
    const context = this.document.modelContext ?? navigator?.modelContext;
    this.detectedSiteTools.set(typeof context?.registerTool === 'function');
  }

  queryMetricsForAgent(input: unknown): ToolResult<unknown> {
    return this.record('Agent tool', 'query_booking_metrics', input, () =>
      this.queryMetrics(input),
    );
  }

  getDeploymentsForAgent(input: unknown): ToolResult<unknown> {
    return this.record('Agent tool', 'get_deployments', input, () => {
      const requestedPeriod = readDeploymentPeriod(input);
      return {
        synthetic: true,
        requestedPeriod,
        deployments: deploymentsIn(this.dataset.deployments, requestedPeriod),
      };
    });
  }

  setDashboardViewForAgent(input: unknown): ToolResult<unknown> {
    return this.record('Agent tool', 'set_dashboard_view', input, () =>
      this.dashboard.setView(input),
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
    const rows = this.dataset.dailyRows;
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

function display(value: unknown): string {
  try {
    const serialized =
      JSON.stringify(
        value,
        (_key, nestedValue) =>
          typeof nestedValue === 'string' ? truncateActivityText(nestedValue) : nestedValue,
        2,
      ) ?? String(value);
    return truncateActivityText(serialized);
  } catch {
    return 'Value could not be serialized.';
  }
}

function truncateActivityText(value: string): string {
  return value.length > MAX_ACTIVITY_TEXT_LENGTH
    ? `${value.slice(0, MAX_ACTIVITY_TEXT_LENGTH - 1)}…`
    : value;
}
