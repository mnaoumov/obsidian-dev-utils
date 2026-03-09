import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { config } = await jiti.import('./scripts/markdownlint-cli2.ts');
// eslint-disable-next-line import-x/no-default-export -- markdownlint-cli2 infrastructure requires a default export.
export default config;
