import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/coverage/', '**/node_modules/'] },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['shared/**/*.ts', 'api/**/*.ts', 'bank-mocks/**/*.ts', '*.js'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'pino', 'nock', 'undici', 'supertest'].map((name) => ({
            name,
            message: 'O domínio não depende de infraestrutura.',
          })),
          patterns: [
            {
              group: [
                '**/infra/**',
                '**/http/**',
                '**/services/**',
                '**/container',
                '**/app',
                '**/server',
              ],
              message: 'O domínio não depende de infraestrutura.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'O domínio não depende de infraestrutura.' },
      ],
    },
  },

  prettier,
);
