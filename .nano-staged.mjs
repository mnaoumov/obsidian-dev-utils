import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { config } = await jiti.import('./scripts/nano-staged-config.ts');
// eslint-disable-next-line import-x/no-default-export -- nano-staged infrastructure requires a default export.
export default config;
