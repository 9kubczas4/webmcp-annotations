# Airline Booking Doctor

A single-page Angular dashboard that demonstrates how people and browser agents can work together in ChatGPT. A user annotates a chart card, and an agent can inspect daily cohorts, compare funnel stages and deployments, and update filters in the shared dashboard view. All data is synthetic and labeled **Synthetic demo data** in the app.

## Getting started

The project uses Angular and Angular CLI **22.3.0**, TypeScript **6.0.3**, and Vitest **5.1.1**, as pinned in `package-lock.json`. The development environment used Node.js **22.22.3** and npm **10.9.8**.

```sh
npm ci
npm start
npm run lint
npm run check:boundaries
npm test
npm run build
```

Open [http://localhost:4200](http://localhost:4200/). The production build is written to `dist/airline-booking-doctor/browser/`. Demo data is loaded from local JSON files. The app requires neither a backend nor an API key.

## Firebase Hosting

The app is configured for the `airline-booking-demo-2026` Firebase project. Sign in with the Firebase CLI, build the Angular app, and deploy Hosting:

```sh
firebase login
npm run build
firebase deploy --only hosting
```

The Firebase Hosting site is available at [https://airline-booking-demo-2026.web.app](https://airline-booking-demo-2026.web.app). Hosting serves the Angular browser build, routes application paths to `index.html`, applies security response headers, and gives hashed bundles long-lived immutable caching.

## Frontend architecture

Angular source code, public assets, and styles live directly in `src/`. The root component renders the page header and `RouterOutlet`. The `/` route loads the `booking-dashboard` feature through its public API. App routing helpers live in `app/core/routing`, and route configuration lives in `app.routes.ts`.

The dashboard is implemented as a single feature. `BookingDashboardPage` reads state signals and delegates actions to `DashboardFacade`. The route and WebMCP handlers share the same route-scoped `DashboardStore`, initialized with data from the repository.

| Layer         | Responsibility                                                                        |
| ------------- | ------------------------------------------------------------------------------------- |
| `domain`      | Types, validation, cohort aggregation, and conversion calculations as pure functions. |
| `state`       | Signals, derived data, activity log, and synchronous versioned view updates.          |
| `data-access` | JSON loading and validation, tool definitions, and browser API adapters.              |
| `ui`          | Chart component and number/date formatting for presentation.                          |
| `feature`     | Routed page, route-provider composition, and action handling.                         |

TypeScript path aliases are used for imports between layers. ESLint enforces boundaries for both aliases and relative imports, while `npm run check:boundaries` checks allowed and forbidden dependency examples. Tailwind CSS v4 runs through PostCSS. The global `src/styles.css` contains shared base styles and dashboard styles.

## Five-minute demo

1. In ChatGPT desktop Work or Codex, open the dashboard in its built-in browser and use a supported model. If integrations are disabled, check the site permissions and the **Enable site tools** and **Annotation features** settings. A hosted version requires HTTPS. See [Site tools](https://learn.chatgpt.com/docs/webmcp) and [Annotations Extensibility](https://learn.chatgpt.com/docs/annotations-extensibility).
2. Expand **Integration diagnostics**. In a browser that supports both integrations, the panel shows two `available` statuses and `3 declared` tools. On the initial **All traffic** view for November 3–20, point out the daily conversion drop from 4.0% to 3.4%.
3. Annotate the full **Booking conversion** card or click **Ask about this chart**. Enter the following comment in the native annotation editor and send it to ChatGPT:

   > Investigate the conversion drop from November 12. Compare it with the preceding period, identify the affected segment and funnel steps, inspect nearby deployments, and show me the affected segment in this dashboard. Distinguish evidence from hypotheses.

4. Expand **Activity** to show actual tool calls and results. In the expected view, the agent selects **Mobile · Safari**, keeps the November 3–20 date range so both periods remain visible on one chart, and highlights **Fare selector v2**. The order of read calls can vary by model.
5. Switch to **Desktop · Chrome** to see that conversion stays at 4.0%. **Reset demo** restores the dates, segment, and highlight, and clears the local **Activity** log. Every state change increments the view version.

### Expected result

Compare November 3–11 with November 12–20. Each period has 90,000 sessions. Bookings fall from 3,600 to 3,060, and conversion falls from 4.0% to 3.4% (−0.6 percentage points, or −15% relative). Mobile Safari accounts for all 540 fewer bookings. In that segment, conversion falls from 4.0% to 1.0%; **Results viewed → Fare selected** falls from 50% to 25%, and **Checkout started → Purchase completed** falls from 40% to 20%. **Fare selector v2** shipped on the day of the drop. Daily cohorts do not establish event ordering within a day and cannot prove that the deployment caused the change.

## Integrations

| Tool                    | Behavior                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query_booking_metrics` | Returns counts, ratios, daily series, funnel stages, and four traffic segments, optionally compared with an equal-length earlier window. Also returns the independent current view state. |
| `get_deployments`       | Reads chronological deployment history in UTC by day.                                                                                                                                     |
| `set_dashboard_view`    | Updates dates, segment, and optional highlight in one operation. Requires the current `expectedStateVersion`.                                                                             |

The `booking-conversion-chart` and `booking-funnel-chart` cards each expose six fields through `oai-annotation-metadata`. Metadata describes the card state when it was selected. Before changing filters, the agent reads `currentView`. On `STALE_VIEW`, it can read the view again and account for newer user selections.

Tools are declared with Angular's experimental `provideExperimentalWebMcpTools` route provider. `withAutoCleanupInjectors()` unregisters them when the dashboard route injector is destroyed. Tool calls are logged locally in memory; the activity panel retains the latest 100 entries and limits each logged argument and result preview to 4,000 characters. The host manages annotation comments. See the [WebMCP specification](https://webmachinelearning.github.io/webmcp/).

## Verification

- **Automated.** Vitest covers validation of 80 cohorts, aggregation results and both funnel drops, complete baselines, state atomicity and versioning, rendered metadata, and reset behavior. Route-provider tests use a host stub to check execution schemas and unregistration.
- **ChatGPT built-in browser.** Three live tools were discovered and called on localhost. Reads preserved the view version. A write changed all cards to Mobile Safari and highlighted Fare selector v2. A write using an older version returned `STALE_VIEW`. The **Activity** panel showed executed calls. Date range changes, keyboard behavior, reset, and a 375 px layout were also checked.
- **Host annotations.** `document.oai.annotation.request` was available; the chart button accepted a request, and all six metadata fields refreshed after a view change. The native editor was outside automation access. Manual verification should cover selecting either card, canceling, sending an annotated comment, and receiving a model response in the conversation.
- **Chrome.** The dashboard and filters worked without the annotation API. The annotation button was hidden, and the console showed no warnings or errors. The tested Chrome instance exposed WebMCP. A component test also checks rendering when both APIs are unavailable.
