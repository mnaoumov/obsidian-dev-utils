import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'obsidian': fileURLToPath(new URL('./__mocks__/obsidian/index.ts', import.meta.url)),
      'obsidian-typings/implementations': fileURLToPath(new URL('./__mocks__/obsidian-typings/implementations/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    environment: 'node',
    globals: false,
    setupFiles: ['./__mocks__/obsidian-globals/index.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/@types/**',
        'src/**/index.ts',
        'src/**/*.d.ts'
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage'
    }
  }
});
