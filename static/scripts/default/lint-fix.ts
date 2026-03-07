import { lint } from 'obsidian-dev-utils/ScriptUtils/linters/eslint/ESLint';

export async function invoke(): Promise<void> {
  await lint(true);
}
