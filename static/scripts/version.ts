import { updateVersion } from 'obsidian-dev-utils/ScriptUtils/version';

export async function invoke(versionUpdateType: string): Promise<void> {
  await updateVersion(versionUpdateType);
}
