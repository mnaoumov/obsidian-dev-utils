import { updateVersion } from 'obsidian-dev-utils/script-utils/version';

export async function invoke(versionUpdateType: string): Promise<void> {
  await updateVersion(versionUpdateType);
}
