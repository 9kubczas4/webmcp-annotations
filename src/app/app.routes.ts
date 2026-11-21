import { Routes } from '@angular/router';
import { APP_ROUTE_SEGMENTS } from '@core/routing/route-paths';
import { BookingDashboardPage } from '@features/booking-dashboard';

export const routes: Routes = [
  { path: APP_ROUTE_SEGMENTS.dashboard, component: BookingDashboardPage, pathMatch: 'full' },
];
