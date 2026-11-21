import { Injectable, signal } from '@angular/core';

export interface ActivityEntry {
  id: number;
  source: 'User' | 'Agent tool';
  name: string;
  time: string;
  args: string;
  result: string;
  ok: boolean;
}

@Injectable()
export class ActivityStore {
  private readonly entries = signal<readonly ActivityEntry[]>([]);
  private nextId = 1;
  readonly log = this.entries.asReadonly();

  record(entry: Omit<ActivityEntry, 'id'>): void {
    const id = this.nextId++;
    this.entries.update((entries) => [{ id, ...entry }, ...entries]);
  }

  clear(): void {
    this.entries.set([]);
  }
}
