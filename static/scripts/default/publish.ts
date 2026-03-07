import { publish } from 'obsidian-dev-utils/script-utils/npm-publish';

export async function invoke(isBeta: boolean): Promise<void> {
  await publish(isBeta);
}
