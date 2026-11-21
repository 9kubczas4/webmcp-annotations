import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { ChartId, ViewState } from '@features/booking-dashboard/domain/booking-model';
import { AnnotationMetadata, HostDocument } from './browser-host';

@Injectable({ providedIn: 'root' })
export class AnnotationAdapter {
  private readonly document = inject(DOCUMENT) as HostDocument;
  private readonly detected = signal(false);
  readonly available = this.detected.asReadonly();

  detect(): void {
    this.detected.set(typeof this.document.oai?.annotation?.request === 'function');
  }

  metadata(chartId: ChartId, view: ViewState): AnnotationMetadata {
    const { startDate, endDate, segment, stateVersion } = view;
    return {
      chartId,
      metricId: chartId === 'booking-conversion-chart' ? 'booking_conversion' : 'booking_funnel',
      startDate,
      endDate,
      segment,
      stateVersion,
    };
  }

  request(target: HTMLElement, chartId: ChartId, view: ViewState): boolean {
    const annotation = this.document.oai?.annotation;
    if (typeof annotation?.request !== 'function') return false;

    try {
      return annotation.request(target, { metadata: this.metadata(chartId, view) }).accepted;
    } catch {
      return false;
    }
  }
}
