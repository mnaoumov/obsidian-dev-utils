import { lint } from 'obsidian-dev-utils/script-utils/linters/eslint/eslint';

export async function invoke(): Promise<void> {
  await lint(true);
}
