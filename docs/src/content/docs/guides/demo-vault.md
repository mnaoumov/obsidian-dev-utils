---
title: Demo Vault
---

`Obsidian Dev Utils` lets a plugin ship a **demo vault** — a curated Obsidian vault, committed to the plugin repo, that showcases the plugin — and lets users open it in one step. There are two cooperating parts:

- **Release side** — at release time, the demo vault is packaged (with the freshly built plugin installed into it) and attached to the GitHub release as an archive.
- **Runtime side** — an opt-in `Open demo vault` command downloads that archive and opens it as a vault in a new window.

## Release side: archiving the demo vault

Put a curated vault at `demo-vault/` in your plugin repo root (a normal vault, including its `.obsidian/` config). When you release with [`updateVersion`](/obsidian-dev-utils/guides/cli-commands/), the demo vault is archived automatically for Obsidian plugins:

1. The freshly built plugin (from `dist/build/`) is installed into `demo-vault/.obsidian/plugins/<plugin-id>/`.
2. The bundled `demo-vault-helper` bootstrap plugin (shipped inside `obsidian-dev-utils`) is injected into `demo-vault/.obsidian/plugins/demo-vault-helper/` — see [The `demo-vault-helper` bootstrap plugin](#the-demo-vault-helper-bootstrap-plugin).
3. The whole `demo-vault/` folder is zipped to `dist/build/demo-vault-<version>.zip`.
4. Because the GitHub-release step uploads every file in `dist/build/`, the archive is attached to the release automatically.

If the repo has no `demo-vault/` folder, the step is silently skipped.

### Opting out

Archiving is on by default. Pass `--no-demo-vault` to skip it for a release, or set `shouldArchiveDemoVault: false` in the `updateVersion` options.

### Consumer setup

- Create `demo-vault/` with the curated notes and an `.obsidian/` config.
- Commit `demo-vault/.obsidian/community-plugins.json` containing `["<plugin-id>"]` so the plugin is enabled when the demo vault is opened.
- Gitignore the installed build so nothing built lands in git:

  ```text
  demo-vault/.obsidian/plugins/<plugin-id>/
  demo-vault/.obsidian/workspace*.json
  ```

### The `demo-vault-helper` bootstrap plugin

A demo vault usually showcases the plugin through notes whose `code-button`s run TypeScript via [CodeScript Toolkit](https://github.com/mnaoumov/obsidian-codescript-toolkit). So those buttons work with no manual setup, `archivePluginDemoVault` injects a tiny, plugin-agnostic bootstrap plugin — `demo-vault-helper`, owned, versioned, and bundled by `obsidian-dev-utils` — into every demo vault at release time. On layout-ready it installs CodeScript Toolkit from the community store (if missing), writes its settings, and enables it (writing the settings **before** enabling, so it loads already configured with no reload). CodeScript Toolkit then runs the vault's `startup.ts`.

Because `obsidian-dev-utils` owns and injects it, a demo vault commits **nothing** helper-related and never needs a manual "install CodeScript Toolkit" step; an `obsidian-dev-utils` bump propagates any fix to every demo vault. To adopt it, a demo vault commits only:

- `demo-vault/.obsidian/community-plugins.json` listing `demo-vault-helper` (alongside your own `<plugin-id>`), so it auto-enables once injected.
- `demo-vault/_assets/CodeScriptToolkit/startup.ts` exporting `invoke(app)` — where the vault opens its start note (e.g. `00 Start`) and does any plugin-specific setup.

No CodeScript Toolkit config (`data.json`) is committed — the helper writes it at runtime.

### `archivePluginDemoVault`

The archiving is exposed directly if you need to call it outside `updateVersion`:

```ts
import { archivePluginDemoVault } from 'obsidian-dev-utils/script-utils/demo-vault';

// Returns the path of the created zip, or `null` if there is no `demo-vault/` folder.
const zipPath = await archivePluginDemoVault('1.2.3');
```

## Runtime side: the `Open demo vault` command

The runtime side is opt-in. Register `OpenDemoVaultCommandHandler` directly from your plugin (for example in your `CommandHandlerComponent`'s command handlers) — no platform guard is needed, even in a plugin that also runs on mobile:

```ts
import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';

new OpenDemoVaultCommandHandler({
  app: this.app,
  manifest: this.manifest,
  pluginNoticeComponent: this.pluginNoticeComponent
});
```

The command is **desktop only** — it hides itself on mobile (its `canExecute` gates on `Platform.isDesktopApp`, so no mobile notice is ever shown), and the desktop-only machinery is loaded lazily (only when the command runs on desktop), so registering the handler is safe on every platform. When invoked the command:

1. Resolves the plugin's GitHub repository from Obsidian's community registry (see [`getCommunityPluginRepo`](#getcommunitypluginrepo)).
2. Reads the latest release version. If the installed version is the latest (or newer), its demo vault opens directly; otherwise the user is offered a choice between the latest and the currently-installed version via a [Select Option](/obsidian-dev-utils/guides/modals/#select-option) dialog.
3. Downloads and extracts the chosen version's `demo-vault-<version>.zip` to a per-version cache folder (under the OS temp directory, reused if already extracted).
4. Opens that folder as a vault in a new window.

If the plugin is not in the community registry, or no archive exists for the chosen version, a notice is shown and nothing is opened.

### `getCommunityPluginRepo`

Resolves the `owner/name` GitHub repository of a community plugin from Obsidian's public `community-plugins.json` registry (the plugin manifest itself carries no repository). The registry is fetched once and cached.

```ts
import { getCommunityPluginRepo } from 'obsidian-dev-utils/obsidian/community-plugins';

const repo = await getCommunityPluginRepo('my-plugin'); // e.g. 'owner/my-plugin', or `null` if not listed
```
