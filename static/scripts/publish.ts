import { publish } from 'obsidian-dev-utils/ScriptUtils/NpmPublish';

export async function invoke(isBeta: boolean): Promise<void> {
  await publish(isBeta);
}
