import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { ConversionChart } from '@features/booking-dashboard/ui/conversion-chart/conversion-chart';
import { ActivityStore } from '@features/booking-dashboard/state/activity.store';
import {
  ChartId,
  DATASET_PERIOD,
  FILTER_LABELS,
  FILTERS,
  INITIAL_FILTERS,
  Period,
  ToolResult,
} from '@features/booking-dashboard/domain/booking-model';
import { DashboardStore } from '@features/booking-dashboard/state/dashboard.store';
import { count, dayLabel, percent } from '@features/booking-dashboard/ui/booking-format';
import { DashboardFacade } from '@features/booking-dashboard/feature/services/dashboard.facade';

@Component({
  selector: 'app-booking-dashboard',
  imports: [ConversionChart],
  templateUrl: './booking-dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDashboardPage {
  private readonly dashboard = inject(DashboardStore);
  protected readonly activity = inject(ActivityStore);
  protected readonly facade = inject(DashboardFacade);

  protected readonly limits = DATASET_PERIOD;
  protected readonly filters = FILTERS;
  protected readonly labels = FILTER_LABELS;
  protected readonly view = this.dashboard.view;
  protected readonly report = this.dashboard.report;
  protected readonly deployments = this.dashboard.deployments;
  protected readonly baseline = this.dashboard.baseline;
  protected readonly count = count;
  protected readonly percent = percent;
  protected readonly date = dayLabel;
  protected readonly draftStart = linkedSignal(() => this.view().startDate);
  protected readonly draftEnd = linkedSignal(() => this.view().endDate);
  protected readonly dateError = signal('');
  protected readonly announcement = computed(() => {
    const view = this.view();
    const title = this.deployments().find(({ id }) => id === view.highlightedDeploymentId)?.title;
    const highlight = title ? ` Highlighted deployment: ${title}.` : '';
    return `${this.labels[view.segment]}, ${dayLabel(view.startDate)} to ${dayLabel(view.endDate)}.${highlight}`;
  });
  protected readonly annotationFeedback = signal<ChartId | null>(null);
  protected readonly conversionMetadata = computed(() =>
    this.facade.annotationMetadata('booking-conversion-chart'),
  );
  protected readonly funnelMetadata = computed(() =>
    this.facade.annotationMetadata('booking-funnel-chart'),
  );

  protected setDraft(field: keyof Period, value: string): void {
    this.dateError.set('');
    (field === 'startDate' ? this.draftStart : this.draftEnd).set(value);
  }

  protected applyDates(event: SubmitEvent): void {
    event.preventDefault();
    this.showFilterResult(
      this.facade.applyDates({
        startDate: this.draftStart(),
        endDate: this.draftEnd(),
      }),
    );
  }

  protected selectSegment(segment: string): void {
    this.showFilterResult(this.facade.selectSegment(segment));
  }

  protected toggleDeployment(id: string): void {
    this.showFilterResult(this.facade.toggleDeployment(id));
  }

  protected reset(): void {
    this.facade.reset();
    this.draftStart.set(INITIAL_FILTERS.startDate);
    this.draftEnd.set(INITIAL_FILTERS.endDate);
    this.dateError.set('');
    this.annotationFeedback.set(null);
  }

  protected ask(target: HTMLElement, chartId: ChartId): void {
    this.annotationFeedback.set(this.facade.requestAnnotation(target, chartId) ? null : chartId);
  }

  private showFilterResult(result: ToolResult<unknown>): void {
    this.dateError.set(result.ok ? '' : result.error.message);
  }
}
