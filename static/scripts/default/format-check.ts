import { format } from 'obsidian-dev-utils/ScriptUtils/formatters/dprint/dprint';

export async function invoke(): Promise<void> {
  await format(false);
}
