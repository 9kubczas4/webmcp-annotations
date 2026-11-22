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
  format: 'date',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description,
});
const PERIOD_PROPERTIES = {
  startDate: date(
    'First day of the selected reporting window, inclusive. Demo data covers 2026-11-01 through 2026-11-20.',
  ),
  endDate: date(
    'Last day of the selected reporting window, inclusive. Demo data covers 2026-11-01 through 2026-11-20.',
  ),
};
const SEGMENT_PROPERTY = {
  type: 'string',
  enum: FILTERS,
  description:
    'Traffic segment to analyze. The all option includes every device and browser segment.',
};

export function bookingSiteTools(handlers: BookingToolHandlers): SiteTool[] {
  return [
    tool(
      'query_booking_metrics',
      'Analyze booking performance',
      'Analyze booking performance for a reporting window and traffic segment, with an optional earlier-period comparison. Use when investigating conversion trends or funnel changes; the result also includes the current dashboard view.',
      true,
      QUERY_FIELDS,
      {
        ...PERIOD_PROPERTIES,
        chartId: {
          type: 'string',
          enum: CHART_IDS,
          description:
            'Chart to analyze: booking conversion for daily rates and counts, or booking funnel for stage transitions.',
        },
        segment: SEGMENT_PROPERTY,
        baselineStartDate: date(
          'First day of the earlier comparison window. Provide both baseline dates; the windows must have equal length and not overlap.',
        ),
        baselineEndDate: date(
          'Last day of the earlier comparison window. Provide both baseline dates; the windows must have equal length and not overlap.',
        ),
      },
      handlers.queryMetrics,
    ),
    tool(
      'get_deployments',
      'Review deployments',
      'List demo release deployments in a reporting window to compare release timing with booking trends.',
      true,
      PERIOD_FIELDS,
      PERIOD_PROPERTIES,
      handlers.getDeployments,
    ),
    tool(
      'set_dashboard_view',
      'Update dashboard view',
      'Apply a complete set of dates, traffic segment, and deployment highlight to the visible dashboard. The versioned update preserves newer user selections when the supplied view is stale.',
      false,
      VIEW_FIELDS,
      {
        ...PERIOD_PROPERTIES,
        segment: SEGMENT_PROPERTY,
        highlightedDeploymentId: {
          type: ['string', 'null'],
          description:
            'Deployment ID from the deployment history that falls within the selected window, or null to clear the highlight.',
        },
        expectedStateVersion: {
          type: 'integer',
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Version of currentView that this update is based on. Stale versions are rejected to protect newer selections.',
        },
      },
      handlers.setView,
    ),
  ];
}

function tool(
  name: string,
  title: string,
  description: string,
  readOnlyHint: boolean,
  required: readonly string[],
  properties: SiteTool['inputSchema']['properties'],
  execute: SiteTool['execute'],
): SiteTool {
  return {
    name,
    title,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    execute,
    annotations: { readOnlyHint },
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
