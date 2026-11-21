import { Injectable } from '@angular/core';
import dailyFixture from './fixtures/daily-funnel.json';
import deploymentFixture from './fixtures/deployments.json';
import {
  DATASET_PERIOD,
  DailyRow,
  DemoError,
  Deployment,
  BookingDataset,
  SEGMENTS,
  STAGES,
} from '@features/booking-dashboard/domain/booking-model';
import {
  containsDay,
  daysBetween,
  isCalendarDay,
  isRecord,
} from '@features/booking-dashboard/domain/validation';

function invalidFixture(name: string): never {
  throw new DemoError('DATA_UNAVAILABLE', `Invalid demo fixture: ${name}.`);
}

function isDailyRow(value: unknown): value is DailyRow {
  if (!isRecord(value)) return false;

  const { date, segment } = value;
  if (!isCalendarDay(date) || !containsDay(DATASET_PERIOD, date)) return false;
  if (!SEGMENTS.some((id) => id === segment)) return false;

  let previous = Infinity;
  for (const { id } of STAGES) {
    const count = value[id];
    if (
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > previous
    ) {
      return false;
    }
    previous = count;
  }
  return true;
}

export function validateDailyFixture(value: readonly unknown[]): readonly DailyRow[] {
  const expectedRows =
    (daysBetween(DATASET_PERIOD.startDate, DATASET_PERIOD.endDate) + 1) * SEGMENTS.length;
  const rows = value.filter(isDailyRow);
  const keys = new Set(rows.map(({ date, segment }) => `${date}/${segment}`));
  if (value.length !== expectedRows || rows.length !== expectedRows || keys.size !== expectedRows) {
    invalidFixture('daily-funnel.json');
  }
  return rows;
}

function isDeployment(value: unknown): value is Deployment {
  if (!isRecord(value)) return false;
  const { id, deployedAt, title, components } = value;
  if (
    typeof id !== 'string' ||
    !id ||
    typeof title !== 'string' ||
    !title ||
    typeof deployedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(deployedAt) ||
    !Array.isArray(components) ||
    !components.every((part: unknown) => typeof part === 'string')
  )
    return false;

  const date = deployedAt.slice(0, 10);
  const timestamp = Date.parse(deployedAt);
  return (
    containsDay(DATASET_PERIOD, date) &&
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === deployedAt.replace('Z', '.000Z')
  );
}

@Injectable({ providedIn: 'root' })
export class DemoDataRepository {
  readonly dataset: BookingDataset = {
    dailyRows: validateDailyFixture(dailyFixture),
    deployments: this.loadDeployments(),
  };

  private loadDeployments(): Deployment[] {
    const records: unknown[] = deploymentFixture;
    const deployments = records.filter(isDeployment);
    const keys = new Set(deployments.map(({ id }) => id));
    if (deployments.length !== records.length || keys.size !== records.length) {
      invalidFixture('deployments.json');
    }
    return deployments.sort((first, second) => first.deployedAt.localeCompare(second.deployedAt));
  }
}
