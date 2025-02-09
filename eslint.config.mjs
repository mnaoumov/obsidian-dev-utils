import { tsImport } from 'tsx/esm/api';
export default (await tsImport('./scripts/eslint.config.ts', { parentURL: import.meta.url })).configs;
