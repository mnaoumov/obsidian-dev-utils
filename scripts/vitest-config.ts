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
        'src/**/*.d.ts'
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage'
    },
    environment: 'node',
    exclude: ['node_modules', 'dist'],
    globals: false,
    include: ['__tests__/**/*.test.ts'],
    server: {
      deps: {
        inline: ['obsidian-typings']
      }
    },
    setupFiles: ['obsidian-test-mocks/globals', './__mocks__/obsidian-typings/index.ts']
  }
});
