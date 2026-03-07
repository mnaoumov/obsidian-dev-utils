import { format } from 'obsidian-dev-utils/script-utils/formatters/dprint/dprint';

export async function invoke(): Promise<void> {
  await format();
}
