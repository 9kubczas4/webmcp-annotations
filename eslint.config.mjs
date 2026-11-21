import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

const sameFeature = '{{ from.element.captured.feature }}';
const featureLayer = (layer, feature) => ({
  element: { type: 'feature-layer', captured: { layer, ...(feature && { feature }) } },
});
const internalDependencies = {
  domain: ['domain'],
  state: ['state', 'domain'],
  'data-access': ['data-access', 'domain'],
  ui: ['ui', 'domain'],
  feature: ['feature', 'ui', 'state', 'data-access', 'domain'],
};

export default [
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/elements': [
        {
          type: 'feature-layer',
          pattern: 'src/app/features/*/{domain,state,data-access,ui,feature}/**',
          capture: ['feature', 'layer'],
          partialMatch: false,
        },
        {
          type: 'feature-root',
          pattern: 'src/app/features/*/**',
          capture: ['feature'],
          partialMatch: false,
        },
        { type: 'core-routing', pattern: 'src/app/core/routing/**', partialMatch: false },
        { type: 'core', pattern: 'src/app/core/**', partialMatch: false },
        { type: 'shared', pattern: 'src/app/shared/**', partialMatch: false },
        { type: 'frontend', pattern: 'src/**', partialMatch: false },
      ],
      'boundaries/files': [
        {
          pattern: 'src/app/features/*/index.ts',
          category: 'feature-api',
          capture: ['feature'],
        },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: true,
          checkAllOrigins: true,
          checkInternals: true,
          policies: [
            {
              from: [
                { element: { types: ['frontend', 'core-routing', 'core', 'shared'] } },
                featureLayer('{feature,ui,data-access}'),
              ],
              allow: { to: { module: { origin: 'external' } } },
            },
            {
              from: featureLayer('state'),
              allow: { to: { module: { origin: 'external', source: '@angular/core' } } },
            },
            {
              from: { element: { type: 'frontend' } },
              allow: {
                to: {
                  element: { types: ['frontend', 'core-routing', 'core', 'shared'] },
                },
              },
            },
            {
              from: { element: { types: ['core', 'core-routing'] } },
              allow: { to: { element: { types: ['core', 'core-routing', 'shared'] } } },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { file: { categories: 'feature-api' } },
              allow: { to: featureLayer('feature', '{{ from.file.captured.feature }}') },
            },
            ...Object.entries(internalDependencies).map(([from, to]) => ({
              from: featureLayer(from),
              allow: { to: to.map((layer) => featureLayer(layer, sameFeature)) },
            })),
            {
              from: featureLayer('{feature,data-access}'),
              allow: { to: { element: { types: ['core', 'core-routing'] } } },
            },
            {
              from: featureLayer('{feature,ui}'),
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: featureLayer('ui'),
              allow: { to: { element: { type: 'core-routing' } } },
            },
            {
              from: [{ element: { type: 'frontend' } }, featureLayer('feature')],
              allow: { to: { file: { categories: 'feature-api' } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/features/*/{domain,state}/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'fetch',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
      ],
    },
  },
  {
    files: ['src/app/features/*/state/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@angular/core',
              allowImportNames: ['Injectable', 'computed', 'linkedSignal', 'signal'],
              message: 'Keep effects, injection and orchestration in the feature layer.',
            },
          ],
        },
      ],
    },
  },
];
