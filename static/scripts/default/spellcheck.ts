import { spellcheck } from 'obsidian-dev-utils/ScriptUtils/linters/cspell/cspell';

export async function invoke(): Promise<void> {
  await spellcheck();
}
