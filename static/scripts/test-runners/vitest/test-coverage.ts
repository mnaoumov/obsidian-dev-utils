import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { testCoverage } from 'obsidian-dev-utils/script-utils/test-runners/vitest';

await wrapCliTask(() => testCoverage());
