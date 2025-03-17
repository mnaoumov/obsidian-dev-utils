import { lint } from 'obsidian-dev-utils/ScriptUtils/ESLint/ESLint';

export async function invoke(): Promise<void> {
  await lint(true);
}
