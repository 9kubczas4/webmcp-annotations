import { ESLint } from 'eslint';

const app = 'src/frontend/app';
const dashboard = `${app}/features/booking-dashboard`;
const cases = [
  [
    'feature uses the repository',
    `${dashboard}/feature/services`,
    "import '@features/booking-dashboard/data-access/demo-data.repository';",
  ],
  [
    'state uses its domain',
    `${dashboard}/state`,
    "import '@features/booking-dashboard/domain/booking-model';",
  ],
  ['root uses the feature public API', app, "import '@features/booking-dashboard';"],
  [
    'feature uses another public API',
    `${app}/features/other/feature`,
    "import '@features/booking-dashboard';",
  ],
  [
    'state cannot use the repository via an alias',
    `${dashboard}/state`,
    "import '@features/booking-dashboard/data-access/demo-data.repository';",
    'boundaries/dependencies',
  ],
  [
    'state cannot use the repository via a relative path',
    `${dashboard}/state`,
    "import '../data-access/demo-data.repository';",
    'boundaries/dependencies',
  ],
  [
    'state cannot use another feature public API',
    `${app}/features/other/state`,
    "import '@features/booking-dashboard';",
    'boundaries/dependencies',
  ],
  [
    'root cannot deep-import features',
    app,
    "import '@features/booking-dashboard/state/dashboard.store';",
    'boundaries/dependencies',
  ],
  [
    'data-access cannot call the facade',
    `${dashboard}/data-access`,
    "import '../feature/services/dashboard.facade';",
    'boundaries/dependencies',
  ],
  [
    'UI cannot call the state store',
    `${dashboard}/ui`,
    "import '../state/dashboard.store';",
    'boundaries/dependencies',
  ],
  [
    'domain cannot use Angular',
    `${dashboard}/domain`,
    "import '@angular/core';",
    'boundaries/dependencies',
  ],
  [
    'state cannot run effects',
    `${dashboard}/state`,
    "export { effect } from '@angular/core';",
    'no-restricted-imports',
  ],
  [
    'state cannot schedule timers',
    `${dashboard}/state`,
    'setTimeout(() => {}, 0);',
    'no-restricted-globals',
  ],
];

const eslint = new ESLint();
for (const [name, directory, source, expectedRule] of cases) {
  const [result] = await eslint.lintText(source, { filePath: `${directory}/boundary-probe.ts` });
  const messages = result.messages.map(({ ruleId, message }) => ({ ruleId, message }));
  const passed = expectedRule
    ? messages.length > 0 && messages.every(({ ruleId }) => ruleId === expectedRule)
    : messages.length === 0;
  if (!passed) {
    console.error(name, messages);
    process.exitCode = 1;
  }
}

if (!process.exitCode) console.log(`Verified ${cases.length} dependency rules.`);
