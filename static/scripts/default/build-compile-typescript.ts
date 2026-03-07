import { buildCompileTypeScript } from 'obsidian-dev-utils/script-utils/build';

export async function invoke(): Promise<void> {
  await buildCompileTypeScript();
}
