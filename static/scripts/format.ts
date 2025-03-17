import { format } from 'obsidian-dev-utils/ScriptUtils/format';

export async function invoke(): Promise<void> {
  await format();
}
