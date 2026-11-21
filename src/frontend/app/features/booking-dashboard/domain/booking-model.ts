export const SEGMENT_LABELS = {
  desktop_chrome: 'Desktop · Chrome',
  desktop_safari: 'Desktop · Safari',
  mobile_chrome: 'Mobile · Chrome',
  mobile_safari: 'Mobile · Safari',
} as const;

export type SegmentId = keyof typeof SEGMENT_LABELS;
export type SegmentFilter = SegmentId | 'all';
export const SEGMENTS = Object.keys(SEGMENT_LABELS) as SegmentId[];
export const FILTERS = ['all', ...SEGMENTS] as const;
export const FILTER_LABELS = { all: 'All traffic', ...SEGMENT_LABELS };

export const CHART_IDS = ['booking-conversion-chart', 'booking-funnel-chart'] as const;
export type ChartId = (typeof CHART_IDS)[number];

export const STAGES = [
  { id: 'search', label: 'Search' },
  { id: 'resultsViewed', label: 'Results viewed' },
  { id: 'fareSelected', label: 'Fare selected' },
  { id: 'checkoutStarted', label: 'Checkout started' },
  { id: 'purchaseCompleted', label: 'Purchase completed' },
] as const;

export interface Period {
  startDate: string;
  endDate: string;
}

export interface ViewState extends Period {
  segment: SegmentFilter;
  highlightedDeploymentId: string | null;
  stateVersion: number;
}

export interface FunnelCounts {
  search: number;
  resultsViewed: number;
  fareSelected: number;
  checkoutStarted: number;
  purchaseCompleted: number;
}

export interface DailyRow extends FunnelCounts {
  date: string;
  segment: SegmentId;
}

export interface Deployment {
  id: string;
  deployedAt: string;
  title: string;
  components: string[];
}

export interface BookingDataset {
  dailyRows: readonly DailyRow[];
  deployments: readonly Deployment[];
}

export const VIEW_FIELDS = [
  'startDate',
  'endDate',
  'segment',
  'highlightedDeploymentId',
  'expectedStateVersion',
] as const;

export const DATASET_PERIOD: Period = { startDate: '2026-11-01', endDate: '2026-11-20' };
export const INITIAL_FILTERS: Omit<ViewState, 'stateVersion'> = {
  startDate: '2026-11-03',
  endDate: '2026-11-20',
  segment: 'all',
  highlightedDeploymentId: null,
};

export type ErrorCode =
  'INVALID_ARGUMENT' | 'OUT_OF_RANGE' | 'UNKNOWN_ID' | 'STALE_VIEW' | 'DATA_UNAVAILABLE';

export type ToolResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

export class DemoError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function resultOf<T>(operation: () => T): ToolResult<T> {
  try {
    return { ok: true, data: operation() };
  } catch (error) {
    if (error instanceof DemoError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    return {
      ok: false,
      error: { code: 'DATA_UNAVAILABLE', message: 'The demo could not complete this operation.' },
    };
  }
}
