import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('Routed dashboard without a host', () => {
  it('updates rendered metrics and annotation metadata from controls and resets without rolling back the version', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const metadata = (chart: string) =>
      JSON.parse(page.querySelector(chart)!.getAttribute('oai-annotation-metadata')!);
    expect(page.querySelector('h1')?.textContent).toBe('Airline Booking Doctor');
    expect(page.textContent).toContain('180,000');
    expect(page.textContent).toContain('Not enough baseline data');
    expect(page.textContent).not.toContain('Ask about this chart');
    expect(metadata('#booking-conversion-chart')).toEqual({
      chartId: 'booking-conversion-chart',
      metricId: 'booking_conversion',
      startDate: '2026-11-03',
      endDate: '2026-11-20',
      segment: 'all',
      stateVersion: 1,
    });
    const segment = page.querySelector<HTMLSelectElement>('#segment')!;
    segment.value = 'mobile_safari';
    segment.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(page.querySelector('.kpi-grid')?.textContent).toContain('2.5%');
    expect(page.querySelector('.segment-table .selected')?.textContent).toContain(
      'Mobile · Safari',
    );
    expect(metadata('#booking-funnel-chart')).toMatchObject({
      metricId: 'booking_funnel',
      segment: 'mobile_safari',
      stateVersion: 2,
    });
    page.querySelector<HTMLButtonElement>('.reset')!.click();
    await fixture.whenStable();
    expect(segment.value).toBe('all');
    expect(metadata('#booking-conversion-chart')).toMatchObject({
      segment: 'all',
      stateVersion: 3,
    });
    expect(page.querySelector('.entry-count')?.textContent).toBe('0');
  });
});
