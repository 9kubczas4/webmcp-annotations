import { inject, provideExperimentalWebMcpTools } from '@angular/core';
import { bookingSiteTools } from '@features/booking-dashboard/data-access/booking-site-tools';
import { DemoDataRepository } from '@features/booking-dashboard/data-access/demo-data.repository';
import { ActivityStore } from '@features/booking-dashboard/state/activity.store';
import { DashboardStore } from '@features/booking-dashboard/state/dashboard.store';
import { DashboardFacade } from './dashboard.facade';

export const DASHBOARD_ROUTE_PROVIDERS = [
  DashboardFacade,
  ActivityStore,
  {
    provide: DashboardStore,
    useFactory: () => new DashboardStore(inject(DemoDataRepository).dataset),
  },
  provideExperimentalWebMcpTools(
    bookingSiteTools({
      queryMetrics: async (args) => inject(DashboardFacade).queryMetricsForAgent(args),
      getDeployments: async (args) => inject(DashboardFacade).getDeploymentsForAgent(args),
      setView: async (args) => inject(DashboardFacade).setDashboardViewForAgent(args),
    }),
  ),
];
