import { buildCompileSvelte } from 'obsidian-dev-utils/ScriptUtils/build';

export async function invoke(): Promise<void> {
  await buildCompileSvelte();
}
