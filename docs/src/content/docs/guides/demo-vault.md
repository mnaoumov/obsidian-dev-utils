---
title: Demo Vault
description: Ship a curated vault with your plugin - archived into the GitHub release, and opened by an `Open demo vault` command.
---

`Obsidian Dev Utils` lets a plugin ship a **demo vault** — a curated Obsidian vault, committed to the plugin repo, that showcases the plugin — and lets users open it in one step. There are two cooperating parts:

- **Release side** — at release time, the demo vault is packaged (with the freshly built plugin installed into it) and attached to the GitHub release as an archive.
- **Runtime side** — an opt-in `Open demo vault` command downloads that archive and opens it as a vault in a new window.

## Release side: archiving the demo vault

Put a curated vault at `demo-vault/` in your plugin repo root (a normal vault, including its `.obsidian/` config). When you release with [`updateVersion`](/obsidian-dev-utils/guides/cli-commands/), the demo vault is archived automatically for Obsidian plugins:

1. The freshly built plugin (from `dist/build/`) is installed into `demo-vault/.obsidian/plugins/<plugin-id>/`.
2. The bundled `demo-vault-helper` bootstrap plugin (shipped inside `obsidian-dev-utils`) is injected into `demo-vault/.obsidian/plugins/demo-vault-helper/` — see [The `demo-vault-helper` bootstrap plugin](#the-demo-vault-helper-bootstrap-plugin).
3. The whole `demo-vault/` folder is zipped to `dist/build/<plugin-id>-demo-vault-<version>.zip` (named by plugin id so several plugins' demo vaults never collide, and by version so each release ships its own distinctly named artifact).
4. The archive's `.obsidian/app.json` gets the [demo-vault settings `obsidian-dev-utils` owns](#the-appjson-settings-obsidian-dev-utils-owns) merged into it.
5. Because the GitHub-release step uploads every file in `dist/build/`, the archive is attached to the release automatically.

If the repo has no `demo-vault/` folder, the step is silently skipped.

### Opting out

Archiving is on by default. Pass `--no-demo-vault` to skip it for a release, or set `shouldArchiveDemoVault: false` in the `updateVersion` options.

### The `app.json` settings `obsidian-dev-utils` owns

Four Obsidian settings have to be the same in every demo vault, so this package owns them rather than
asking each vault to remember them:

| Setting | Value | Why |
| --- | --- | --- |
| `defaultViewMode` | `"preview"` | A note opens as a reader sees it, not as raw markup — the vault is documentation first and an editing surface second. |
| `livePreview` | `false` | Same reason; both are needed, and both are Obsidian-only (GitHub never reads `app.json`). |
| `useMarkdownLinks` | `true` | Decides what Obsidian writes when a link is created inside the vault. At the default, every new link is a `[[wikilink]]` — which GitHub renders as literal brackets leading nowhere. |
| `newLinkFormat` | `"relative"` | Keeps a link resolving once the vault is extracted to an arbitrary folder. `"absolute"` would not. |

They are injected into the **archived** vault, and a demo vault must **not commit any of them**: a committed
copy is a second source of truth that nothing reconciles, and it is the copy that goes stale. The
[demo-vault coverage suite](#keeping-the-vault-honest) fails a vault that commits one, and
`archivePluginDemoVault` refuses to archive it — so the settings have exactly one owner. Everything else in
`app.json` is the vault's own and is carried into the archive untouched.

One consequence worth knowing: because the injection reaches only the archived copy, creating a link while
authoring the vault in your own Obsidian still follows *your* settings, not these. The coverage suite's
no-wikilink check is what catches that before it ships.

### Consumer setup

- Create `demo-vault/` with the curated notes and an `.obsidian/` config.
- Commit `demo-vault/.obsidian/community-plugins.json` containing `["<plugin-id>"]` so the plugin is enabled when the demo vault is opened.
- Do not commit the four [`app.json` settings above](#the-appjson-settings-obsidian-dev-utils-owns) — they are injected at release time.
- Gitignore the installed build so nothing built lands in git:

  ```text
  demo-vault/.obsidian/plugins/<plugin-id>/
  demo-vault/.obsidian/workspace*.json
  ```

### The `demo-vault-helper` bootstrap plugin

A demo vault usually showcases the plugin through notes whose `code-button`s run TypeScript via [CodeScript Toolkit](https://github.com/mnaoumov/obsidian-codescript-toolkit). So those buttons work with no manual setup, `archivePluginDemoVault` injects a tiny, plugin-agnostic bootstrap plugin — `demo-vault-helper`, owned, versioned, and bundled by `obsidian-dev-utils` — into every demo vault at release time. On layout-ready it installs CodeScript Toolkit from the community store (if missing), writes its settings, and enables it (writing the settings **before** a fresh enable, so it loads already configured with no reload). If CodeScript Toolkit is already enabled but the settings just changed, it is reloaded so it re-reads them; an ordinary re-open (settings unchanged) reloads nothing. CodeScript Toolkit then runs the vault's `startup.ts`, and the helper raises the [sandbox notice](#the-sandbox-notice).

Among the settings it writes is a `defaultCodeButtonConfig` that turns CodeScript Toolkit's source viewer on for every button, so a reader can see the code a button runs. Because it is written by the helper, every demo vault gets it without editing a single note.

Because `obsidian-dev-utils` owns and injects it, a demo vault commits **nothing** helper-related and never needs a manual "install CodeScript Toolkit" step; an `obsidian-dev-utils` bump propagates any fix to every demo vault. To adopt it, a demo vault commits only:

- `demo-vault/.obsidian/community-plugins.json` listing `demo-vault-helper` (alongside your own `<plugin-id>`), so it auto-enables once injected.
- `demo-vault/_assets/CodeScriptToolkit/startup.ts` exporting `invoke(app)` — where the vault opens its start note (e.g. `00 Start`) and does any plugin-specific setup.

No CodeScript Toolkit config (`data.json`) is committed — the helper writes it at runtime.

### `archivePluginDemoVault`

The archiving is exposed directly if you need to call it outside `updateVersion`:

```ts
import { archivePluginDemoVault } from 'obsidian-dev-utils/script-utils/demo-vault';

// Returns the path of the created zip, or `null` if there is no `demo-vault/` folder.
// The plugin id and version are read from the repo's `manifest.json`.
const zipPath = await archivePluginDemoVault();
```

## Runtime side: the `Open demo vault` command

The runtime side is opt-in. Register `OpenDemoVaultCommandHandler` directly from your plugin (for example in your `CommandHandlerComponent`'s command handlers) — no platform guard is needed, even in a plugin that also runs on mobile:

```ts
import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';

new OpenDemoVaultCommandHandler({
  app: this.app,
  pluginId: this.manifest.id,
  pluginNoticeComponent: this.pluginNoticeComponent,
  pluginVersion: this.manifest.version
});
```

The command is **desktop only** — it hides itself on mobile (its `canExecute` gates on `Platform.isDesktopApp`, so no mobile notice is ever shown), and the desktop-only machinery is loaded lazily (only when the command runs on desktop), so registering the handler is safe on every platform. When invoked the command:

1. Resolves the plugin's GitHub repository from Obsidian's community registry (see [`getCommunityPluginRepo`](#getcommunitypluginrepo)).
2. Reads the latest release version. If the installed version is the latest (or newer), its demo vault opens directly; otherwise the user is offered a choice between the latest and the currently-installed version via a [Select Option](/obsidian-dev-utils/guides/modals/#select-option) dialog.
3. Downloads the chosen version's `<plugin-id>-demo-vault-<version>.zip`. Only the **archive** is cached (under the OS temp directory, keyed by plugin id and version); every open extracts a **fresh** copy into its own folder, so a previous session's edits never leak into a new one. Extracted folders left over from earlier sessions are removed, best-effort, about a day after their last use.
4. Opens that folder as a vault in a new window.

A progress notice is shown from the moment the command is invoked (`Opening demo vault for …`, then `Downloading …`, then `Extracting …`), because resolving the release and downloading the archive can take a while and a silent command invites a second click — which would produce a second extracted vault.

If the plugin is not in the community registry, or no archive exists for the chosen version, a notice is shown and nothing is opened.

### The sandbox notice

Because every open extracts a fresh copy, a user who writes their own notes in a demo vault will not find them in the next one. So once the vault is open, `demo-vault-helper` raises a notice — modelled on Obsidian's own sandbox-vault notice, staying up until it is clicked — that names the plugin the vault demonstrates, gives the folder it was extracted to, says the folder is cleaned up automatically about a day after its last use, and explains that re-running the command creates a new copy.

The notice is raised by the **helper**, inside the demo vault, not by the `Open demo vault` command: that command runs in the vault the user started from, not the one being opened. Nothing is needed to opt in — every demo vault gets it through the injected helper.

### `getCommunityPluginRepo`

Resolves the `owner/name` GitHub repository of a community plugin from Obsidian's public `community-plugins.json` registry (the plugin manifest itself carries no repository). The registry is fetched once and cached.

```ts
import { getCommunityPluginRepo } from 'obsidian-dev-utils/obsidian/community-plugins';

const repo = await getCommunityPluginRepo('my-plugin'); // e.g. 'owner/my-plugin', or `null` if not listed
```

## Authoring the notes

The demo vault is not a set of samples sitting beside the documentation — it **is** the documentation, read either in Obsidian or straight from GitHub by someone who has not installed the plugin. That second reader is what the following rules protect, and the [coverage suite](#keeping-the-vault-honest) enforces them:

1. **Every note opens with an `# H1`, then 1-3 sentences of what it does and why you would want it** — in behavior terms, not technical nouns. A note that goes from its title straight to a button teaches nothing to a reader who does not already know the feature.
2. **Links between notes are `[Text](<./NN Name.md>)`, never `[[wikilinks]]`.** A wikilink renders as literal brackets on GitHub and leads nowhere. Angle brackets keep a name with spaces intact. Wikilinks shown *inside* a code fence or inline code are sample text and are fine. A note whose **subject** is the wikilink — an embed spelling the reader is being taught to type, a frontmatter property value that contrasts with a Markdown link, a fixture that must keep the wikilink a command is meant to leave alone, a link the reader clicks while it still resolves to nothing — says so itself, with the reason, in one of two forms modelled on ESLint's.

   Per line or per region, as an HTML comment (invisible in Obsidian *and* on GitHub — the spelling already used for `markdownlint-disable-next-line`):

   ```markdown
   <!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- Clicking a link to a note that does not exist yet IS the feature. -->
   2. Click this link: [[Projects/Fresh idea]].

   <!-- obsidian-dev-utils-disable demo-vault-validation/no-wikilinks -- The wikilink embed is the syntax this note teaches. -->
   ![[basic.html|400]]
   <!-- obsidian-dev-utils-enable demo-vault-validation/no-wikilinks -->
   ```

   Per note, in its frontmatter — the only form that reaches a wikilink **inside** frontmatter, where a comment cannot go:

   ```yaml
   ---
   obsidian-dev-utils:
     demo-vault-validation:
       allow-wikilinks: The `wikilink` property value is the contrast this note is built around.
   ---
   ```

   Either exempts the note from the wikilink rule only; the rest still apply. A declaration with no reason, one covering no wikilink, a region never enabled again, or a misspelled directive all fail the suite — an exemption nobody can justify, that nothing needs any more, or that silently does nothing is worse than none.
3. **No `[Docs](…)` link line.** The note is the docs; a line pointing elsewhere for the real explanation is the shape this convention exists to remove.
4. **`00 Start.md` is a getting-started narrative**, not a bare list — what the vault is, one concrete first success, then an index grouped under headings with a one-line description per entry. Every other note must be reachable from it.
5. **The first success spells out the mechanics**, because a first-time reader has never seen CodeScript Toolkit: a code button renders as a captioned rectangle, **clicking it runs the code**, the result appears below it, and the `</>` toggle beside it reveals the source. Nothing about a coloured rectangle says "button" to someone who does not already know — say it once, in the first example, instead of assuming it.
6. **`.obsidian/app.json` commits none of the [settings `obsidian-dev-utils` owns](#the-appjson-settings-obsidian-dev-utils-owns)** — the reading experience they configure is injected into the archive, so the vault does not carry a second copy of it.

Rules 1-3, the reachability half of rule 4, and rule 6 are machine-checked by the coverage suite below. Whether `00 Start.md` actually reads as a narrative and rule 5 are convention only — no check can tell prose from filler.

## Keeping the vault honest

`registerDemoVaultCoverageSuite` (from `obsidian-dev-utils/script-utils/demo-vault-coverage`) registers a `vitest` suite that reads the plugin's real surface from source and checks the vault against it — without launching Obsidian. Call it once from `src/demo-vault.no-app.integration.test.ts`:

```ts
import { registerDemoVaultCoverageSuite } from 'obsidian-dev-utils/script-utils/demo-vault-coverage';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';

registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'PluginSettings', sourcePath: 'src/plugin-settings.ts' }],
  interfaces: [{ interfaceName: 'CodeButtonContext', kind: 'methods', receiver: 'codeButtonContext', sourcePath: 'src/code-button-context.ts' }],
  nonTrivialGuard: {
    expectDemoNote: '00 Start.md',
    expectMember: 'console',
    interfaceName: 'CodeButtonContext',
    sourcePath: 'src/code-button-context.ts'
  },
  rootFolder: getRootFolder() ?? process.cwd()
});
```

It asserts that every reflected member is demonstrated somewhere in the notes, that no note references a member that no longer exists (rename drift), that `.obsidian/app.json` commits none of the [settings this package injects](#the-appjson-settings-obsidian-dev-utils-owns), **and** that the notes follow the authoring rules above.

The authoring checks are always on — a note that breaks the convention is broken for real readers, so there is no flag to turn them off. The optional `authoring` member only tunes them:

```ts
authoring: {
  // Notes outside the learning path, exempt from every authoring check.
  // Defaults to the vault's own README, which addresses someone browsing the repo.
  excludedNotes: ['README.md'],
  // The note every other note must be reachable from. Defaults to `00 Start.md`.
  startNote: '00 Start.md'
}
```

`docs` stays optional and is only for a plugin that still keeps a separate `docs/` folder: it checks that every feature doc has a demo note linking to it. A plugin whose vault is its documentation has no use for it.

`rootFolder` is the only required member. A plugin with no settings and no public API to reflect — nothing to put in `configInterfaces`, `interfaces` or `nonTrivialGuard` — registers the suite with that alone:

```ts
registerDemoVaultCoverageSuite({ rootFolder: getRootFolder() ?? process.cwd() });
```

It then runs every authoring check, plus a guard that the vault is not empty — with no notes to read, the authoring checks would pass by having nothing to look at. Omit the reflection specs, never the suite: the authoring rules apply to every vault, whatever the plugin exposes.

## Clicking every button

The coverage suite reads the notes; it never runs them. A button whose `require('/demoSetup.ts')` path is wrong, or that calls an API which has since changed shape, fails **at click time** — `lint:md` reads the markdown, the coverage suite checks the conventions, and neither executes anything, so nothing in a normal gate run ever finds out. `registerDemoVaultButtonSuite` (from `obsidian-dev-utils/script-utils/demo-vault-buttons`) is the gate that does: it opens every note of the in-repo `demo-vault/` in a real Obsidian, clicks each `code-button`, and fails with the note, the caption and CodeScript Toolkit's own captured error for any button that reports an error or never reports at all.

It takes three pieces of wiring, and all three are needed — the suite alone, without the other two, collects nothing or passes vacuously.

### The suite

`src/demo-vault-buttons.demo-vault.integration.test.ts` is the whole per-repo cost:

```ts
import { registerDemoVaultButtonSuite } from 'obsidian-dev-utils/script-utils/demo-vault-buttons';

registerDemoVaultButtonSuite();
```

It registers one `it` per note that declares at least one button, and runs one `evalInObsidian` per button — a single closure is one CDP `Runtime.evaluate`, which the harness caps at 30 seconds, so a note with a dozen buttons batched into one closure would time out as a whole instead of naming the button that actually failed.

Every option has a default worth knowing before overriding it:

```ts
registerDemoVaultButtonSuite({
  // How long a clicked button may take to report a result. Defaults to 15000.
  buttonResultTimeoutInMilliseconds: 15_000,
  // Notes to skip. Defaults to `['README.md']` — the repo-facing page GitHub renders, not a walkthrough.
  // `00 Start.md` is deliberately NOT excluded: landing notes carry buttons of their own.
  excludedNotes: ['README.md'],
  // The repo root holding `demo-vault/`. Defaults to the resolved repo root, falling back to `process.cwd()`.
  rootFolder: getRootFolder() ?? process.cwd(),
  // How long a note's preview and its buttons may take to mount. Defaults to 20000.
  settleTimeoutInMilliseconds: 20_000
});
```

### The global setup

The suite opens a temporary copy of the vault, so something has to put the vault there first — including the CodeScript Toolkit binary, without which every ```` ```code-button ```` fence stays an inert code block. That half is `buildDemoVaultPopulate` from `obsidian-integration-testing`; this package deliberately does not duplicate it. Put it in `scripts/demo-vault-global-setup.ts`:

```ts
import type { PopulateFilesParams } from 'obsidian-integration-testing';

import { join } from 'node:path';
import process from 'node:process';
import { CODE_SCRIPT_TOOLKIT_PLUGIN_ID } from 'obsidian-dev-utils/script-utils/demo-vault-buttons';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';
import { buildDemoVaultPopulate } from 'obsidian-integration-testing';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

const CODE_SCRIPT_TOOLKIT_SETTINGS = {
  invocableScriptsFolder: 'Invocables',
  modulesRoot: '_assets/CodeScriptToolkit',
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
};

function populate(): PopulateFilesParams {
  return buildDemoVaultPopulate({
    demoVaultPath: join(getRootFolder() ?? process.cwd(), 'demo-vault'),
    injectPlugins: [{
      data: CODE_SCRIPT_TOOLKIT_SETTINGS,
      pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID
    }]
  });
}

const { setup, teardown } = createSetup({
  enableCommunityPlugins: [CODE_SCRIPT_TOOLKIT_PLUGIN_ID],
  populate
});

export {
  setup,
  teardown
};
```

`CODE_SCRIPT_TOOLKIT_PLUGIN_ID` is exported by the same module so no repo has to hard-code `fix-require-modules` — CodeScript Toolkit still carries its original manifest id, which no longer matches its name and cannot be changed now that it is published.

The binary is **copied out of your own `demo-vault/`**, where the in-vault `demo-vault-helper` installs it from the community registry the first time the vault is opened. That keeps the run hermetic — no network, nothing to rate-limit — at the price of one manual step per repo. Until it has been done, the setup fails with:

```text
Community plugin "fix-require-modules" is not installed in the demo vault (…/main.js missing).
Open demo-vault/ in Obsidian once so demo-vault-helper installs it, then re-run.
```

Do exactly that, once; the installed copy is gitignored, so each machine that runs the suite does it for itself.

### The vitest project

The suite drives a real desktop Obsidian, like the desktop project, but against a populated copy of `demo-vault/` rather than an empty vault — so it needs its own `globalSetup`, and its own file suffix so the desktop project does not collect it and open it against a vault with no notes:

```ts
export const config = defineObsidianPluginVitestConfig({
  customProjects(context: ObsidianPluginVitestConfigContext): TestProjectConfiguration[] {
    return [
      {
        test: {
          ...context.desktop,
          globalSetup: ['./scripts/demo-vault-global-setup.ts'],
          include: ['src/**/*.demo-vault.integration.test.ts'],
          name: 'integration-tests:demo-vault'
        }
      }
    ];
  }
});
```

Then add the project to `scripts/test-integration.ts` alongside the standard ones. Both halves matter: a project that is never declared matches no filter, and `vitest` fails the run with `No projects matched the filter "integration-tests:demo-vault"` — which, in a script that awaits its projects in order, also stops every project after it from running at all. A suite file whose suffix matches no declared project's `include` is collected by nothing and reports nothing, which looks exactly like passing.

Run it in isolation with `npx vitest run --project integration-tests:demo-vault`.

### What reading view does to the assertions

Two quirks of Obsidian's reading view shape the suite, and both explain assertions that otherwise look too weak:

- **It renders lazily and unmounts sections far off-screen**, so no single scroll position holds a whole note's buttons: sitting at the top never mounts the last ones, and sitting at the bottom never mounts the first ones. The suite therefore **walks** the preview — a viewport at a time, wrapping back to the top — while it waits, and accumulates the captions it sees along the way. Until 94.4.1 it pinned the preview to the bottom instead, which silently reported every button that was not near the end of its note as never rendered (`status: 'timeout'` with empty output). If you see that status with an empty output, the button did not fail — the suite failed to reach it.
- **While it settles it can hold several elements per fence** — the same button has been observed rendered twice, so a four-button note reports six buttons with the first two captions duplicated. Buttons are therefore addressed **by caption, deduplicated**, never by index: indexing would click one button twice and miss another entirely. For the same reason the count assertion is a lower bound (at least as many distinct buttons rendered as the source declares), which still catches the failure that matters — a fence that silently stayed a plain code block.
