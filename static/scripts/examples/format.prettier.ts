import { existsSync } from 'node:fs';
import { assertNonNullable } from 'obsidian-dev-utils/object-utils';
import { getFolderName } from 'obsidian-dev-utils/path';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from 'obsidian-dev-utils/script-utils/root';

export async function invoke(): Promise<void> {
  await formatWithPrettier(true);
}

export async function formatWithPrettier(rewrite: boolean): Promise<void> {
  const PRETTIER_CONFIG_FILE_NAME = '.prettierrc.json';
  const prettierJsonPath = resolvePathFromRootSafe(PRETTIER_CONFIG_FILE_NAME);
  if (!existsSync(prettierJsonPath)) {
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    assertNonNullable(packageFolder, () => 'Could not find package folder.');
    throw new Error(`${PRETTIER_CONFIG_FILE_NAME} not found`);
  }

  const command = rewrite ? '--write' : '--check';
  await execFromRoot(['npx', 'prettier', '.', command]);
}
