/**
 * @file
 *
 * The gate on a plugin's feature surface: what must be PRESENT for it to run, and what must NOT be.
 *
 * Both halves answer the same question — may this plugin's `onloadImpl` run right now? — so they are one
 * component rather than two. A second, independent gate would double-load the surface and stack a second
 * "blocked" settings tab onto the same plugin, and neither could see the other's reason for refusing.
 *
 * ## Dependencies: a plugin declaring what it cannot work without
 *
 * This is the strict sibling of `PluginSuggestionComponent`, and the difference is the whole point. A
 * SUGGESTION is an offer — the host keeps working without it and simply cannot do one thing. A DEPENDENCY
 * is a requirement: `onloadImpl` never runs, no command is registered, no handler is installed, nothing is
 * patched. Reach for a suggestion when the other plugin adds something; reach for a dependency when the
 * host's advertised behavior is not there without it.
 *
 * Obsidian has no dependency field in a manifest, which is exactly the problem this closes. Without one,
 * a user meeting an unfamiliar plugin in their list months later has nothing telling them it is
 * load-bearing — they remove it, and the breakage surfaces weeks after that as damage they cannot connect
 * to anything they did. So the relationship is made visible from both ends and enforced while it holds:
 * the dependent explains itself where the user is looking, repairs itself in one click, and reacts the
 * INSTANT the dependency goes away rather than degrading quietly.
 *
 * Three choices are deliberate and worth stating, because each has an obvious-looking alternative:
 *
 * - **Blocked means enabled-but-inert, never self-disabled.** Calling `disablePluginAndSave` on itself
 *   would be the literal reading of "refuses to load", and it rewrites a config that belongs to the user —
 *   who would then have to remember to re-enable it after fixing the dependency. Staying enabled and inert
 *   says the same thing to the user, changes nothing they own, and can undo itself.
 * - **Blocked is not an error.** Throwing from `onload` marks the plugin failed in Obsidian and hands the
 *   user a stack trace instead of a sentence and a button.
 * - **A dependency must publish an API.** That is what makes presence, absence, version and departure all
 *   observable through one mechanism — `watchPluginApi`'s reference is live, is revoked when the provider
 *   unloads, and already classifies not-installed against not-enabled against too-old. A provider with
 *   nothing to expose can publish an empty API purely so it can be depended upon; the alternative would be
 *   a second, weaker detection path to maintain beside it.
 *
 * ## Conflicts: a plugin declaring what it refuses to run beside
 *
 * The inverse relationship, and it needs its own detection path because the dependency one does not fit.
 * A conflicting plugin is typically an OLD version of some other plugin that still owns behavior this one
 * has taken over — it publishes no API at all, so there is no `apiVersionRange` to compare against.
 *
 * The argument for refusing rather than competing comes from the case this generalizes: two rename/delete
 * handlers acting on one rename corrupt links and move attachments twice, and there is no reliable way to
 * win that race — a handler is elected by registry order, but the patches that do the work sit outside
 * that election, so whichever plugin loaded first keeps a hand on the wheel. Every scheme for seizing
 * control from inside is load-order dependent. Refusing is deterministic where competing is not, and a
 * vault that briefly has no handler is a far better outcome than one with two.
 *
 * Two details of that detection carry over verbatim, because both are load-bearing:
 *
 * - **Versions are read, never the registry.** A plugin that has not loaded yet has registered nothing, so
 *   asking the registry gives a different answer depending on when it is asked. `app.plugins.manifests` is
 *   populated for every installed plugin at startup, whatever the load order turns out to be.
 * - **An unparseable version counts as conflicting.** Failing closed is the safe direction: a false alarm
 *   costs a notice, a false all-clear costs a vault.
 *
 * Not every overlap is that severe, which is why a conflict declares a {@link PluginConflictSeverity}.
 * Two plugins shipping the same command duplicate a palette entry and do the work twice — annoying, not
 * corrupting — and refusing to load over that would be a worse outcome than the overlap. Those declare
 * {@link PluginConflictSeverity.Warn} and both keep running.
 *
 * ## What this can and cannot see
 *
 * Obsidian raises no event when ANOTHER plugin is enabled or disabled (see `plugin-lifecycle-events.ts`),
 * so live conflict detection has a real ceiling and it is stated here rather than implied away. A
 * conflicting plugin built on this library announces itself through the lifecycle broadcast, and is
 * therefore caught the moment it is enabled or disabled. One that is not — an old release predating the
 * broadcast, or a plugin by another author entirely — is caught at the next load, which is when its
 * manifest is read.
 */

import type {
  App,
  Plugin
} from 'obsidian';

import { satisfies as satisfiesVersion } from 'compare-versions';
import {
  ButtonComponent,
  PluginSettingTab
} from 'obsidian';

import type { PluginApiRef } from '../plugin/plugin-api.ts';
import type {
  PluginLifecycleEventName,
  PluginLifecycleEventPayload
} from '../plugin/plugin-lifecycle-events.ts';
import type { PluginNoticeComponent } from './plugin-notice-component.ts';

import { convertAsyncToSync } from '../../async.ts';
import { disableCommunityPlugin } from '../community-plugins.ts';
import { CssClass } from '../css-class.ts';
import {
  asCodeBlock,
  createFragmentWithCodeBlocks
} from '../html-element.ts';
import { t } from '../i18n/i18n.ts';
import { watchPluginApi } from '../plugin/plugin-api.ts';
import {
  getInstalledPluginState,
  getInstalledPluginVersion,
  installAndEnablePlugin,
  InstalledPluginState
} from '../plugin/plugin-install-state.ts';
import {
  PLUGIN_LOADED_EVENT_NAME,
  PLUGIN_UNLOADED_EVENT_NAME
} from '../plugin/plugin-lifecycle-events.ts';
import { registerAsyncEvent } from './async-events-component.ts';
import { ComponentEx } from './component-ex.ts';
import { CallbackLayoutReadyComponent } from './layout-ready-component.ts';

/**
 * How badly two plugins running side by side goes wrong, and therefore what this one does about it.
 */
export enum PluginConflictSeverity {
  /**
   * The host refuses to run at all while the conflict holds: `onloadImpl` never runs, nothing is
   * registered, and the plugin explains itself the way a missing dependency does.
   *
   * For an overlap where both plugins acting on the same operation damages the vault.
   */
  Block = 'block',

  /**
   * The host runs anyway and says the overlap is there.
   *
   * For an overlap that is annoying rather than destructive — duplicate commands, work done twice — where
   * refusing to load would cost the user more than the overlap does.
   */
  Warn = 'warn'
}

/**
 * A plugin another plugin refuses to run beside, or warns about running beside.
 */
export interface PluginConflict {
  /**
   * The semver range of the OTHER plugin's versions that conflict, e.g. `'<12.0.0'` for "every version
   * before the one that gave this behavior up".
   *
   * A range rather than a minimum, so an overlap confined to one major (`'>=3 <4'`) is expressible, and so
   * is a plugin that conflicts at every version — spell that `'>=0.0.0'`, since `compare-versions` rejects
   * a bare `*`. Evaluated against `manifest.version`; a version that cannot be parsed counts as
   * conflicting.
   */
  readonly conflictingVersionRange: string;

  /**
   * The `manifest.id` of the conflicting plugin, as listed in Obsidian's community plugin registry.
   */
  readonly pluginId: string;

  /**
   * The display name of the conflicting plugin, shown to the user.
   */
  readonly pluginName: string;

  /**
   * A localized sentence saying what goes wrong when both run, shown in the banner.
   *
   * The declaring plugin owns this string because only it knows what the two of them collide over, and a
   * user being asked to disable something deserves to be told why.
   */
  readonly reason: string;

  /**
   * What this plugin does about the conflict.
   */
  readonly severity: PluginConflictSeverity;
}

/**
 * A plugin another plugin cannot work without.
 */
export interface PluginDependency {
  /**
   * The semver range of API contract versions the dependent compiled against, e.g. `'^2'`.
   *
   * A dependency whose published API falls outside the range counts as UNSATISFIED, which is what turns a
   * silent behavioral mismatch between two independently released plugins into a visible "update this
   * one" message. Spell "any version" as `'>=0.0.0'` — `compare-versions` rejects a bare `*`.
   */
  readonly apiVersionRange: string;

  /**
   * The `manifest.id` of the required plugin, as listed in Obsidian's community plugin registry.
   */
  readonly pluginId: string;

  /**
   * The display name of the required plugin, shown to the user.
   */
  readonly pluginName: string;

  /**
   * A localized sentence saying what the dependent does with this plugin, shown in the settings banner.
   *
   * The dependent owns this string because only it knows what it uses the other plugin for, and a user
   * being asked to install something deserves to be told why.
   */
  readonly reason: string;
}

/**
 * Parameters for the {@link PluginGateComponent} constructor.
 */
export interface PluginGateComponentConstructorParams {
  /**
   * The conflicts to enforce. An empty list means the plugin refuses to run beside nothing.
   */
  readonly conflicts: readonly PluginConflict[];

  /**
   * The dependencies to enforce. An empty list means the plugin depends on nothing, and its feature
   * surface loads immediately.
   */
  readonly dependencies: readonly PluginDependency[];

  /**
   * Loads the host plugin's feature surface. Called once every dependency is satisfied and no blocking
   * conflict holds, and again after a gate that had closed opens back up.
   *
   * @returns A {@link Promise} that resolves once the surface is loaded.
   */
  loadFeatureSurface(this: void): Promise<void>;

  /**
   * The host plugin — the one declaring the dependencies and conflicts.
   */
  readonly plugin: Plugin;

  /**
   * The host plugin's notice component, used to say what is missing, what is in the way, and what changed.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * Unloads the host plugin's feature surface. Called when a gate that had been open closes.
   */
  unloadFeatureSurface(this: void): void;
}

/**
 * Parameters for the {@link BlockedPluginSettingTab} constructor.
 */
interface BlockedPluginSettingTabConstructorParams {
  /**
   * The blocked plugin.
   */
  readonly plugin: Plugin;

  /**
   * Renders the blocked explanation into the tab's container.
   *
   * @param containerEl - The tab's container element.
   */
  renderBanner(this: void, containerEl: HTMLElement): void;
}

/**
 * The settings tab a blocked plugin shows in place of the one it never got to register.
 *
 * A blocked plugin's `onloadImpl` never ran, so its real settings tab does not exist — and a user who goes
 * looking for the plugin's settings is precisely the user asking "why isn't this doing anything?". An
 * empty space is the worst possible answer to that question.
 */
// eslint-disable-next-line obsidianmd/settings-tab/prefer-setting-definitions -- This tab has no settings to declare. It stands in for a settings tab that does not exist yet, carrying an explanation and a repair button, and the plugin's real settings appear the moment the gate opens.
class BlockedPluginSettingTab extends PluginSettingTab {
  private readonly renderBanner: (containerEl: HTMLElement) => void;

  /**
   * Creates an instance of {@link BlockedPluginSettingTab}.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: BlockedPluginSettingTabConstructorParams) {
    super(params.plugin.app, params.plugin);
    this.renderBanner = params.renderBanner;
  }

  /**
   * Renders the tab.
   */
  public override display(): void {
    this.containerEl.empty();
    this.renderBanner(this.containerEl);
  }
}

/**
 * Enforces a plugin's mandatory dependencies and declared conflicts, gating its feature surface on both.
 */
export class PluginGateComponent extends ComponentEx {
  private readonly announcedWarningPluginIds = new Set<string>();
  private readonly apiRefs = new Map<string, PluginApiRef<object>>();
  private blockedSettingTab: null | PluginSettingTab = null;
  private readonly conflicts: readonly PluginConflict[];
  private readonly dependencies: readonly PluginDependency[];
  private hasAnnouncedBlocked = false;
  private isFeatureSurfaceLoaded = false;
  private isLayoutReady = false;
  private readonly loadFeatureSurface: () => Promise<void>;
  private readonly plugin: Plugin;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly unloadFeatureSurface: () => void;

  private get app(): App {
    return this.plugin.app;
  }

  /**
   * Creates an instance of {@link PluginGateComponent}.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: PluginGateComponentConstructorParams) {
    super();
    this.conflicts = params.conflicts;
    this.dependencies = params.dependencies;
    this.loadFeatureSurface = params.loadFeatureSurface;
    this.plugin = params.plugin;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.unloadFeatureSurface = params.unloadFeatureSurface;
  }

  /**
   * Says whether any warning conflict is in force right now.
   *
   * The predicate a declarative settings tab needs, and the counterpart to
   * `PluginSuggestionComponent.getSuggestedPluginState`. Such a tab decides whether a row exists
   * BEFORE it renders anything into it, so {@link renderConflictWarningBanner} writing nothing cannot
   * answer the question for it — a row that renders empty is still a row, with the divider and padding
   * every other setting has.
   *
   * @returns Whether at least one declared warning conflict holds.
   */
  public hasActiveWarningConflicts(): boolean {
    return this.getActiveConflicts(PluginConflictSeverity.Warn).length > 0;
  }

  /**
   * Starts watching every declared dependency and conflict.
   */
  public override onload(): void {
    for (const dependency of this.dependencies) {
      const apiRef = watchPluginApi<object>({
        apiVersionRange: dependency.apiVersionRange,
        app: this.app,
        component: this,
        pluginId: dependency.pluginId
      });
      registerAsyncEvent(
        this,
        apiRef.on('change', async () => {
          await this.refresh();
        })
      );
      this.apiRefs.set(dependency.pluginId, apiRef);
    }

    // A conflict has no API to watch — it is read out of the manifests — so the trigger to re-read is the
    // library's own lifecycle broadcast. It covers every conflicting plugin built on this library; one
    // that is not is caught at the next load, as the file header says.
    const lifecycleEventNames: PluginLifecycleEventName[] = [PLUGIN_LOADED_EVENT_NAME, PLUGIN_UNLOADED_EVENT_NAME];
    for (const eventName of lifecycleEventNames) {
      this.registerEvent(this.app.workspace.on(
        eventName,
        convertAsyncToSync(async (payload: PluginLifecycleEventPayload) => {
          if (payload.pluginId === this.plugin.manifest.id) {
            return;
          }

          await this.refresh();
        })
      ));
    }

    // Nothing is SAID about a missing dependency until the layout is ready. Plugins load in an unspecified
    // order, so a dependency that simply has not loaded yet is indistinguishable at this point from one
    // that is not installed — announcing here would put a "missing plugin" notice on screen at every
    // startup and take it away a moment later. The gate itself does not wait: the surface loads the
    // instant the dependency is there, whenever that is.
    this.addChild(
      new CallbackLayoutReadyComponent(this.app, () => {
        this.isLayoutReady = true;
        this.presentUnsatisfied(this.getUnsatisfiedDependencies(), this.getActiveConflicts(PluginConflictSeverity.Block));
        this.announceWarnings();
      })
    );

    this.register(() => {
      this.hideBlockedSettingTab();
    });
  }

  /**
   * Evaluates the gate once the watches are in place, loading the feature surface if it is already open.
   *
   * @returns A {@link Promise} that resolves once the first evaluation is complete.
   */
  public override async onloadAsync(): Promise<void> {
    await this.refresh();
  }

  /**
   * Renders a banner for every conflict the host is running alongside, so a plugin can put the overlap in
   * its own settings tab.
   *
   * Consumer-invoked, exactly like `PluginSuggestionComponent.renderBanner`: the library registers the
   * settings tab a BLOCKED plugin needs, because that plugin never got to register one of its own, but it
   * has no hook into the tab a running plugin builds. Renders nothing when no warning conflict holds.
   *
   * @param containerEl - The element to render into.
   */
  public renderConflictWarningBanner(containerEl: HTMLElement): void {
    for (const conflict of this.getActiveConflicts(PluginConflictSeverity.Warn)) {
      this.renderConflictEntry(containerEl, conflict, this.createConflictWarningMessage(conflict));
    }
  }

  private announceWarnings(): void {
    // A warning describes two plugins that are both RUNNING, so it is pointless while this one is blocked
    // — and it waits for layout-ready for the same reason the blocked notice does.
    if (!this.isLayoutReady || !this.isFeatureSurfaceLoaded) {
      return;
    }

    for (const conflict of this.getActiveConflicts(PluginConflictSeverity.Warn)) {
      if (this.announcedWarningPluginIds.has(conflict.pluginId)) {
        continue;
      }

      this.announcedWarningPluginIds.add(conflict.pluginId);
      this.pluginNoticeComponent.showNotice(this.createConflictWarningMessage(conflict));
    }
  }

  private createBlockedMessage(dependency: PluginDependency): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginDependency.blockedNotice, {
      dependencyPluginName: asCodeBlock(dependency.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
  }

  private createConflictAppearedMessage(conflict: PluginConflict): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginConflict.conflictAppearedNotice, {
      conflictingPluginName: asCodeBlock(conflict.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
  }

  private createConflictBlockedMessage(conflict: PluginConflict): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginConflict.blockedNotice, {
      conflictingPluginName: asCodeBlock(conflict.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
  }

  private createConflictWarningMessage(conflict: PluginConflict): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginConflict.warningNotice, {
      conflictingPluginName: asCodeBlock(conflict.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
  }

  private createDependencyLostMessage(dependency: PluginDependency): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginDependency.dependencyLostNotice, {
      dependencyPluginName: asCodeBlock(dependency.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
  }

  /**
   * Finds the declared conflicts of one severity that are currently in force.
   *
   * @param severity - The severity to select.
   * @returns The conflicts holding right now, in the order they were declared.
   */
  private getActiveConflicts(severity: PluginConflictSeverity): PluginConflict[] {
    return this.conflicts.filter((conflict) => conflict.severity === severity && this.isConflictActive(conflict));
  }

  private getUnsatisfiedDependencies(): PluginDependency[] {
    return this.dependencies.filter((dependency) => !this.apiRefs.get(dependency.pluginId)?.value);
  }

  private hideBlockedSettingTab(): void {
    if (!this.blockedSettingTab) {
      return;
    }

    this.app.setting.removeSettingTab(this.blockedSettingTab);
    this.blockedSettingTab = null;
  }

  /**
   * Decides whether one declared conflict is in force right now.
   *
   * Only an ENABLED plugin counts. One that is installed but switched off registers nothing, so it cannot
   * collide, and acting on it would be an alarm the user can only answer by uninstalling something they
   * have already turned off.
   *
   * @param conflict - The declared conflict.
   * @returns Whether the conflicting plugin is enabled at a conflicting version.
   */
  private isConflictActive(conflict: PluginConflict): boolean {
    const installedVersion = getInstalledPluginVersion({
      app: this.app,
      pluginId: conflict.pluginId
    });

    if (installedVersion === null) {
      return false;
    }

    try {
      return satisfiesVersion(installedVersion, conflict.conflictingVersionRange);
    } catch {
      return true;
    }
  }

  /**
   * Says what is in the way, and puts the same explanation where the user will look for the plugin's
   * settings.
   *
   * @param unsatisfiedDependencies - The dependencies that are not currently satisfied.
   * @param blockingConflicts - The conflicts currently refusing the plugin the right to run.
   */
  private presentUnsatisfied(
    unsatisfiedDependencies: readonly PluginDependency[],
    blockingConflicts: readonly PluginConflict[]
  ): void {
    if (!this.isLayoutReady || (unsatisfiedDependencies.length === 0 && blockingConflicts.length === 0)) {
      return;
    }

    this.showBlockedSettingTab(unsatisfiedDependencies, blockingConflicts);

    if (this.hasAnnouncedBlocked) {
      return;
    }

    this.hasAnnouncedBlocked = true;
    for (const dependency of unsatisfiedDependencies) {
      this.pluginNoticeComponent.showNotice(this.createBlockedMessage(dependency));
    }

    for (const conflict of blockingConflicts) {
      this.pluginNoticeComponent.showNotice(this.createConflictBlockedMessage(conflict));
    }
  }

  /**
   * Re-evaluates the gate and moves the feature surface to match.
   *
   * @returns A {@link Promise} that resolves once the surface matches the gate.
   */
  private async refresh(): Promise<void> {
    const unsatisfiedDependencies = this.getUnsatisfiedDependencies();
    const blockingConflicts = this.getActiveConflicts(PluginConflictSeverity.Block);

    if (unsatisfiedDependencies.length === 0 && blockingConflicts.length === 0) {
      this.hideBlockedSettingTab();
      this.hasAnnouncedBlocked = false;

      if (!this.isFeatureSurfaceLoaded) {
        this.isFeatureSurfaceLoaded = true;
        await this.loadFeatureSurface();
      }

      this.announceWarnings();
      return;
    }

    if (this.isFeatureSurfaceLoaded) {
      this.isFeatureSurfaceLoaded = false;
      this.unloadFeatureSurface();

      // A gate that closes while the plugin is RUNNING is the case worth being loud about: the user just
      // did something, and the consequence is immediate and invisible without this. Announced regardless
      // of layout readiness, because a running plugin means the layout is long since ready.
      for (const dependency of unsatisfiedDependencies) {
        this.pluginNoticeComponent.showNotice(this.createDependencyLostMessage(dependency));
      }

      for (const conflict of blockingConflicts) {
        this.pluginNoticeComponent.showNotice(this.createConflictAppearedMessage(conflict));
      }

      this.hasAnnouncedBlocked = true;
      this.showBlockedSettingTab(unsatisfiedDependencies, blockingConflicts);
      return;
    }

    this.presentUnsatisfied(unsatisfiedDependencies, blockingConflicts);
  }

  /**
   * Renders the blocked explanation into a settings-tab container: what is missing or in the way, why it
   * matters, and the button that fixes it.
   *
   * @param containerEl - The element to render into.
   * @param unsatisfiedDependencies - The dependencies that are not currently satisfied.
   * @param blockingConflicts - The conflicts currently refusing the plugin the right to run.
   */
  private renderBlockedBanner(
    containerEl: HTMLElement,
    unsatisfiedDependencies: readonly PluginDependency[],
    blockingConflicts: readonly PluginConflict[]
  ): void {
    if (unsatisfiedDependencies.length > 0) {
      containerEl.createEl('h2', { text: t(($) => $.obsidianDevUtils.pluginDependency.settingsHeading) });
    }

    for (const dependency of unsatisfiedDependencies) {
      const bannerEl = containerEl.createDiv({
        cls: [CssClass.LibraryName, CssClass.PluginDependencyBanner]
      });
      bannerEl.append(this.createBlockedMessage(dependency));
      bannerEl.createDiv({ text: dependency.reason });

      const state = getInstalledPluginState({
        app: this.app,
        pluginId: dependency.pluginId
      });

      new ButtonComponent(bannerEl)
        .setButtonText(t(($) =>
          state === InstalledPluginState.InstalledButDisabled
            ? $.obsidianDevUtils.pluginSuggestion.enable
            : $.obsidianDevUtils.pluginSuggestion.install
        ))
        .setCta()
        .onClick(convertAsyncToSync(async () => {
          await installAndEnablePlugin({
            app: this.app,
            pluginId: dependency.pluginId,
            pluginName: dependency.pluginName,
            pluginNoticeComponent: this.pluginNoticeComponent
          });
        }));

      // The link OUT to the dependency's own settings, shown only once it is installed and enabled — the
      // other half of the relationship being visible from both ends. It is what stops "configure one
      // operation across two plugins" from meaning "go and find the other plugin yourself".
      if (state !== InstalledPluginState.Enabled) {
        continue;
      }

      this.renderOpenSettingsButton(bannerEl, dependency.pluginId, dependency.pluginName);
    }

    if (blockingConflicts.length === 0) {
      return;
    }

    containerEl.createEl('h2', { text: t(($) => $.obsidianDevUtils.pluginConflict.settingsHeading) });

    for (const conflict of blockingConflicts) {
      this.renderConflictEntry(containerEl, conflict, this.createConflictBlockedMessage(conflict));
    }
  }

  /**
   * Renders one conflict: what it is, why it matters, and the two ways out of it.
   *
   * The repair is offered on the OTHER plugin — disabling it is the one thing this plugin can do in a
   * click, since it cannot update someone else's plugin — and it is the persisted `disablePluginAndSave`
   * rather than the transient disable, because the user asked for it by clicking.
   *
   * @param containerEl - The element to render into.
   * @param conflict - The conflict to render.
   * @param messageFragment - The sentence explaining the conflict.
   */
  private renderConflictEntry(containerEl: HTMLElement, conflict: PluginConflict, messageFragment: DocumentFragment): void {
    const bannerEl = containerEl.createDiv({
      cls: [CssClass.LibraryName, CssClass.PluginConflictBanner]
    });
    bannerEl.append(messageFragment);
    bannerEl.createDiv({ text: conflict.reason });

    new ButtonComponent(bannerEl)
      .setButtonText(t(($) => $.obsidianDevUtils.pluginConflict.disable, { conflictingPluginName: conflict.pluginName }))
      .setCta()
      .onClick(convertAsyncToSync(async () => {
        await disableCommunityPlugin({
          app: this.app,
          pluginId: conflict.pluginId
        });
        await this.refresh();
      }));

    this.renderOpenSettingsButton(bannerEl, conflict.pluginId, conflict.pluginName);
  }

  private renderOpenSettingsButton(bannerEl: HTMLElement, pluginId: string, pluginName: string): void {
    new ButtonComponent(bannerEl)
      .setButtonText(t(($) => $.obsidianDevUtils.pluginDependency.openDependencySettings, {
        dependencyPluginName: pluginName
      }))
      .onClick(() => {
        this.app.setting.open();
        this.app.setting.openTabById(pluginId);
      });
  }

  private showBlockedSettingTab(
    unsatisfiedDependencies: readonly PluginDependency[],
    blockingConflicts: readonly PluginConflict[]
  ): void {
    if (this.blockedSettingTab) {
      return;
    }

    // Added through `app.setting` rather than `plugin.addSettingTab`, because this tab has to come back
    // OFF again the moment the gate opens — otherwise the plugin's own settings tab, registered by
    // `onloadImpl`, would appear beside a stale "required plugin missing" one. `plugin.addSettingTab`
    // only ever removes at plugin unload.
    const blockedSettingTab = new BlockedPluginSettingTab({
      plugin: this.plugin,
      renderBanner: (containerEl): void => {
        this.renderBlockedBanner(containerEl, unsatisfiedDependencies, blockingConflicts);
      }
    });
    this.app.setting.addSettingTab(blockedSettingTab);
    this.blockedSettingTab = blockedSettingTab;
  }
}
