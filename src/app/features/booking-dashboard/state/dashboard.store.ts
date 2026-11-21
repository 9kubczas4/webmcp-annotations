import { computed, signal } from '@angular/core';
import {
  bookingReport,
  bookingTotals,
  compareTotals,
  deploymentsIn,
  precedingPeriod,
} from '@features/booking-dashboard/domain/booking-analytics';
import {
  BookingDataset,
  DemoError,
  INITIAL_FILTERS,
  VIEW_FIELDS,
  ViewState,
} from '@features/booking-dashboard/domain/booking-model';
import {
  containsDay,
  readArguments,
  readPeriod,
  readSegment,
} from '@features/booking-dashboard/domain/validation';

export class DashboardStore {
  constructor(private readonly dataset: BookingDataset) {}

  private readonly state = signal<Readonly<ViewState>>(
    Object.freeze({ ...INITIAL_FILTERS, stateVersion: 1 }),
  );

  readonly view = this.state.asReadonly();
  readonly report = computed(() =>
    bookingReport(this.dataset.dailyRows, this.view(), this.view().segment),
  );
  readonly deployments = computed(() => deploymentsIn(this.dataset.deployments, this.view()));
  readonly baseline = computed(() => {
    const view = this.view();
    const period = precedingPeriod(view);
    if (!period) return null;
    const totals = bookingTotals(this.dataset.dailyRows, period, view.segment);
    return { period, ...compareTotals(this.report().totals, totals) };
  });

  setView(input: unknown) {
    const previousView = this.view();
    const args = readArguments(input, VIEW_FIELDS);
    const period = readPeriod(args['startDate'], args['endDate']);
    const segment = readSegment(args['segment']);
    const highlightedDeploymentId = args['highlightedDeploymentId'];
    const expectedVersion = args['expectedStateVersion'];

    if (
      typeof expectedVersion !== 'number' ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      throw new DemoError('INVALID_ARGUMENT', 'expectedStateVersion must be a positive integer.');
    }
    if (expectedVersion !== previousView.stateVersion) {
      throw new DemoError(
        'STALE_VIEW',
        'The dashboard changed. Read currentView again before applying filters.',
      );
    }
    if (highlightedDeploymentId !== null) {
      if (typeof highlightedDeploymentId !== 'string') {
        throw new DemoError(
          'INVALID_ARGUMENT',
          'highlightedDeploymentId must be a deployment ID or null.',
        );
      }
      const deployment = this.dataset.deployments.find(({ id }) => id === highlightedDeploymentId);
      if (!deployment) throw new DemoError('UNKNOWN_ID', 'Unknown deployment ID.');
      if (!containsDay(period, deployment.deployedAt.slice(0, 10))) {
        throw new DemoError(
          'OUT_OF_RANGE',
          'The highlighted deployment must be in the requested period.',
        );
      }
    }

    const changed =
      previousView.startDate !== period.startDate ||
      previousView.endDate !== period.endDate ||
      previousView.segment !== segment ||
      previousView.highlightedDeploymentId !== highlightedDeploymentId;
    if (changed) {
      this.state.set(
        Object.freeze({
          ...period,
          segment,
          highlightedDeploymentId,
          stateVersion: previousView.stateVersion + 1,
        }),
      );
    }
    return { previousView, currentView: this.view(), changed };
  }
}
