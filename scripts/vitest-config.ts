import { defineConfig } from 'vitest/config';

const SHARED_RESOLVE = {
  alias: {
    obsidian: 'obsidian-test-mocks/obsidian'
  }
};

const SHARED_COVERAGE = {
  exclude: [
    'src/**/@types/**',
    'src/**/index.ts',
    'src/**/*.d.ts',
    'src/**/*.test.ts',
    'src/test-helpers/**'
  ],
  include: ['src/**/*.ts'],
  provider: 'v8' as const,
  reporter: ['text', 'lcov', 'html'],
  reportsDirectory: './coverage'
};

export const config = defineConfig({
  resolve: SHARED_RESOLVE,
  test: {
    coverage: SHARED_COVERAGE,
    exclude: ['node_modules', 'dist'],
    globals: false,
    projects: [
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'node',
          include: ['src/script-utils/**/*.test.ts'],
          name: 'script-utils',
          server: {
            deps: {
              inline: ['obsidian-typings']
            }
          },
          setupFiles: []
        }
      },
      {
        resolve: SHARED_RESOLVE,
        test: {
          environment: 'jsdom',
          exclude: ['node_modules', 'dist', 'src/script-utils/**/*.test.ts'],
          include: ['src/**/*.test.ts'],
          name: 'obsidian',
          server: {
            deps: {
              inline: ['obsidian-typings']
            }
          },
          setupFiles: ['obsidian-test-mocks/setup', './src/test-helpers/mocks/obsidian-typings/setup.ts', './src/test-helpers/setup.ts']
        }
      }
    ]
  }
});
