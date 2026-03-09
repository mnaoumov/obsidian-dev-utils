export const config: Record<string, string[]> = {
  '*.{ts,tsx,mts}': [
    'npm run lint:fix',
    'npm run format'
  ],
  '*.md': ['npm run lint:md:fix']
};
