import { spellcheck } from 'obsidian-dev-utils/ScriptUtils/spellcheck';

export async function invoke(): Promise<void> {
  await spellcheck();
}
