import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export const config = defineConfig({
  resolve: {
    alias: {
      'obsidian': fileURLToPath(new URL('./__mocks__/obsidian/index.ts', import.meta.url)),
      'obsidian-typings/implementations': fileURLToPath(new URL('./__mocks__/obsidian-typings/implementations/index.ts', import.meta.url))
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
    setupFiles: ['./__mocks__/obsidian-globals/index.ts']
  }
});
