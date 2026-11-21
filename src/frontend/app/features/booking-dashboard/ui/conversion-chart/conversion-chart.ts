import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Deployment } from '@features/booking-dashboard/domain/booking-model';
import { count, dayLabel, percent } from '../booking-format';

interface DailyConversion {
  date: string;
  search: number;
  purchaseCompleted: number;
  bookingConversion: number | null;
}

@Component({
  selector: 'app-conversion-chart',
  host: { class: 'block min-w-0' },
  templateUrl: './conversion-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversionChart {
  readonly series = input.required<readonly DailyConversion[]>();
  readonly deployments = input.required<readonly Deployment[]>();
  readonly highlightedId = input.required<string | null>();
  private readonly plot = viewChild.required<ElementRef<HTMLElement>>('plot');
  private readonly width = signal(980);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly count = count;
  protected readonly percent = percent;
  protected readonly date = dayLabel;
  protected readonly height = 238;
  protected readonly top = 18;
  protected readonly bottom = 198;
  protected readonly left = 41;
  protected readonly right = computed(() => this.width() - 17);
  protected readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height}`);
  protected readonly hovered = signal<string | null>(null);
  protected readonly focused = signal<string | null>(null);
  protected readonly active = computed(() =>
    this.points().find(({ date }) => date === (this.hovered() ?? this.focused())),
  );
  protected readonly tooltipLeft = computed(() =>
    Math.max(4, Math.min((this.active()?.x ?? 0) + 14, this.width() - 176)),
  );

  protected readonly points = computed(() => {
    const series = this.series();
    return series.map((entry, index) => ({
      ...entry,
      x:
        series.length === 1
          ? (this.left + this.right()) / 2
          : this.left + (index * (this.right() - this.left)) / (series.length - 1),
      y: this.y(entry.bookingConversion),
    }));
  });
  private readonly yMax = computed(() => {
    const max = Math.max(
      0,
      ...this.series().map(({ bookingConversion }) => bookingConversion ?? 0),
    );
    return Math.max(5, Math.ceil((max * 100) / 5) * 5);
  });
  protected readonly ticks = computed(() =>
    [1, 0.8, 0.6, 0.4, 0.2, 0].map((fraction) => ({
      label: `${Math.round(this.yMax() * fraction)}%`,
      y: this.top + (1 - fraction) * (this.bottom - this.top),
    })),
  );
  protected readonly labels = computed(() => {
    const points = this.points();
    const last = points.length - 1;
    const intervals = Math.min(last, Math.max(2, Math.floor((this.right() - this.left) / 105)));
    if (intervals < 1) return points;
    return Array.from(
      { length: intervals + 1 },
      (_, i) => points[Math.round((i * last) / intervals)],
    );
  });
  protected readonly markers = computed(() =>
    this.deployments().flatMap((deployment) => {
      const point = this.points().find(({ date }) => date === deployment.deployedAt.slice(0, 10));
      return point ? [{ ...deployment, x: point.x }] : [];
    }),
  );
  protected readonly paths = computed(() => {
    const sections: { x: number; y: number }[][] = [];
    let section: { x: number; y: number }[] = [];
    for (const { x, y } of this.points()) {
      if (y === null) {
        section = [];
      } else {
        if (!section.length) sections.push(section);
        section.push({ x, y });
      }
    }
    return sections.map((points) => {
      const line = points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
      return {
        line,
        fill: `${line} L${points.at(-1)!.x},${this.bottom} L${points[0].x},${this.bottom} Z`,
      };
    });
  });

  constructor() {
    afterNextRender(() => {
      const element = this.plot().nativeElement;
      this.width.set(Math.max(200, element.clientWidth));
      if (typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(([entry]) =>
        this.width.set(Math.max(200, entry.contentRect.width)),
      );
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private y(rate: number | null): number | null {
    return rate === null
      ? null
      : this.bottom - ((rate * 100) / this.yMax()) * (this.bottom - this.top);
  }
}
