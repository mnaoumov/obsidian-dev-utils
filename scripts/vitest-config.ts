import { defineConfig } from 'vitest/config';

export const config = defineConfig({
  resolve: {
    alias: {
      obsidian: 'obsidian-test-mocks/obsidian'
    }
  },
  test: {
    coverage: {
      exclude: [
        'src/**/@types/**',
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/test-helpers/**'
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage'
    },
    environment: 'jsdom',
    exclude: ['node_modules', 'dist'],
    globals: false,
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: ['obsidian-typings']
      }
    },
    setupFiles: ['obsidian-test-mocks/setup', './src/test-helpers/mocks/obsidian-typings/setup.ts']
  }
});
