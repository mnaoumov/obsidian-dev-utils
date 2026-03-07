import { spellcheck } from 'obsidian-dev-utils/script-utils/linters/cspell/cspell';

export async function invoke(): Promise<void> {
  await spellcheck();
}
