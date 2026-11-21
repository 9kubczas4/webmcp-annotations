import { WebMcpToolDescriptor } from '@angular/core';
import {
  CHART_IDS,
  DemoError,
  FILTERS,
  Period,
  VIEW_FIELDS,
  ToolResult,
} from '@features/booking-dashboard/domain/booking-model';
import {
  daysBetween,
  readArguments,
  readPeriod,
  readSegment,
} from '@features/booking-dashboard/domain/validation';

export interface SiteTool extends WebMcpToolDescriptor {
  inputSchema: {
    type: 'object';
    properties: Record<string, object>;
    required: readonly string[];
    additionalProperties: false;
  };
  annotations: { readOnlyHint: boolean };
  execute(args: unknown): Promise<ToolResult<unknown>>;
}

interface BookingToolHandlers {
  queryMetrics: SiteTool['execute'];
  getDeployments: SiteTool['execute'];
  setView: SiteTool['execute'];
}

const PERIOD_FIELDS = ['startDate', 'endDate'] as const;
const QUERY_FIELDS = ['chartId', ...PERIOD_FIELDS, 'segment'] as const;
const BASELINE_FIELDS = ['baselineStartDate', 'baselineEndDate'] as const;
const date = (description: string) => ({
  type: 'string',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description,
});
const PERIOD_PROPERTIES = {
  startDate: date(
    'First day, inclusive, in YYYY-MM-DD format. Synthetic data starts on 2026-11-01.',
  ),
  endDate: date('Last day, inclusive, in YYYY-MM-DD format. Synthetic data ends on 2026-11-20.'),
};
const SEGMENT_PROPERTY = {
  type: 'string',
  enum: FILTERS,
  description: 'Traffic segment to use. Use all to include all four device and browser segments.',
};

export function bookingSiteTools(handlers: BookingToolHandlers): SiteTool[] {
  return [
    tool(
      'query_booking_metrics',
      'Read synthetic booking conversion, daily counts, traffic segments, and funnel transitions for either chart. Optional equal-length baseline windows show differences. Returns the live view and its version without changing the filters.',
      true,
      QUERY_FIELDS,
      {
        ...PERIOD_PROPERTIES,
        chartId: {
          type: 'string',
          enum: CHART_IDS,
          description: 'Stable ID of the chart referenced by the user.',
        },
        segment: SEGMENT_PROPERTY,
        baselineStartDate: date(
          'Optional first day of the earlier comparison window. Supply with baselineEndDate.',
        ),
        baselineEndDate: date(
          'Optional last day of the earlier, non-overlapping window of the same length.',
        ),
      },
      handlers.queryMetrics,
    ),
    tool(
      'get_deployments',
      'Read fictional deployments in the requested inclusive UTC date range. Daily aggregates cannot establish ordering within a day or prove causation.',
      true,
      PERIOD_FIELDS,
      PERIOD_PROPERTIES,
      handlers.getDeployments,
    ),
    tool(
      'set_dashboard_view',
      'Update the visible dates, segment, and optional deployment highlight together. Read currentView with query_booking_metrics first to respect any user changes. Annotation metadata describes the view when it was selected.',
      false,
      VIEW_FIELDS,
      {
        ...PERIOD_PROPERTIES,
        segment: SEGMENT_PROPERTY,
        highlightedDeploymentId: {
          type: ['string', 'null'],
          description: 'Deployment ID inside the selected range, or null to clear the highlight.',
        },
        expectedStateVersion: {
          type: 'integer',
          minimum: 1,
          description: 'Current dashboard version from a recent query_booking_metrics response.',
        },
      },
      handlers.setView,
    ),
  ];
}

function tool(
  name: string,
  description: string,
  readOnlyHint: boolean,
  required: readonly string[],
  properties: SiteTool['inputSchema']['properties'],
  execute: SiteTool['execute'],
): SiteTool {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations: { readOnlyHint },
    execute,
  };
}

export function readMetricsRequest(input: unknown) {
  const args = readArguments(input, QUERY_FIELDS, BASELINE_FIELDS);
  const chartId = CHART_IDS.find((id) => id === args['chartId']);
  if (!chartId) throw new DemoError('UNKNOWN_ID', 'Unknown chart ID.');

  const segment = readSegment(args['segment']);
  const period = readPeriod(args['startDate'], args['endDate']);
  return { chartId, segment, period, baseline: baselinePeriod(args, period) };
}

export function readDeploymentPeriod(input: unknown): Period {
  const args = readArguments(input, PERIOD_FIELDS);
  return readPeriod(args['startDate'], args['endDate']);
}

function baselinePeriod(args: Record<string, unknown>, period: Period): Period | null {
  const [hasStart, hasEnd] = BASELINE_FIELDS.map((key) => Object.hasOwn(args, key));
  if (!hasStart && !hasEnd) return null;
  if (hasStart !== hasEnd) throw new DemoError('INVALID_ARGUMENT', 'Supply both baseline dates.');

  const baseline = readPeriod(args['baselineStartDate'], args['baselineEndDate']);
  if (
    baseline.endDate >= period.startDate ||
    daysBetween(baseline.startDate, baseline.endDate) !==
      daysBetween(period.startDate, period.endDate)
  ) {
    throw new DemoError(
      'INVALID_ARGUMENT',
      'The baseline must precede the requested period and have the same length.',
    );
  }
  return baseline;
}
