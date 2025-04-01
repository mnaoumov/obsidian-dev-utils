import { getDirname } from 'obsidian-dev-utils/Path';
import { existsSync } from 'obsidian-dev-utils/ScriptUtils/NodeModules';
import {
  execFromRoot,
  getRootDir,
  resolvePathFromRootSafe
} from 'obsidian-dev-utils/ScriptUtils/Root';

export async function invoke(): Promise<void> {
  await formatWithPrettier(true);
}

export async function formatWithPrettier(rewrite: boolean): Promise<void> {
  const PRETTIER_CONFIG_FILE_NAME = '.prettierrc.json';
  const prettierJsonPath = resolvePathFromRootSafe(PRETTIER_CONFIG_FILE_NAME);
  if (!existsSync(prettierJsonPath)) {
    const packageDirectory = getRootDir(getDirname(import.meta.url));
    if (!packageDirectory) {
      throw new Error('Could not find package directory.');
    }
    throw new Error(`${PRETTIER_CONFIG_FILE_NAME} not found`);
  }

  const command = rewrite ? '--write' : '--check';
  await execFromRoot(['npx', 'prettier', '.', command]);
}
