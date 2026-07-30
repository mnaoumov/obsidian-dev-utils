/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';

// What an `evalInObsidian` closure can observe about the injected library, returned so the assertions live on
// The Node side.
interface LibProbe {
  readonly didAwaitMetadataCacheReady: boolean;
  readonly noteFolderPath: string;
  readonly pluginEnabled: boolean;
}

describe('consumer-path lib injection', () => {
  // This test runs in the DEDICATED `obsidian-integration-tests:consumer-lib` project (see
  // `scripts/vitest-config.ts`), whose global setup registers a vault with NO plugin-under-test and seeds the
  // Harness plugin as a plain community plugin via the PUBLISHED `getIntegrationTestPluginPopulate` +
  // `enableCommunityPlugins` pair, while its `setupFiles` names the PUBLISHED
  // `./src/integration-test-setup.ts`. That is a consumer's wiring end to end — so if this passes, a consumer
  // Plugin that adds the same two config lines gets `lib.<helper>` too.
  it('should expose the whole library as lib.<helper> with no plugin-under-test', async () => {
    const probe = await evalInObsidian({
      args: { harnessPluginId: HARNESS_PLUGIN_ID },
      async fn({ app, harnessPluginId, lib }): Promise<LibProbe> {
        const {
          dirname,
          ensureMetadataCacheReady
        } = lib;

        // An async library helper, awaited for real inside the closure: this is the helper whose absence in a
        // Consumer's `lib` prompted this whole capability (it failed to compile there with TS2339).
        await ensureMetadataCacheReady(app);

        return {
          didAwaitMetadataCacheReady: true,
          // A pure helper, called for real: proves `lib` carries working implementations, not just names.
          noteFolderPath: dirname('folder/subfolder/note.md'),
          pluginEnabled: app.plugins.enabledPlugins.has(harnessPluginId)
        };
      }
    });

    expect(probe.pluginEnabled).toBe(true);
    expect(probe.didAwaitMetadataCacheReady).toBe(true);
    expect(probe.noteFolderPath).toBe('folder/subfolder');
  });
});
