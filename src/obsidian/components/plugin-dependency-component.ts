/**
 * @file
 *
 * Mandatory dependencies on other plugins: a plugin declares what it cannot work without, and does nothing
 * at all until that is present.
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
 */

import type {
  App,
  Plugin
} from 'obsidian';

import {
  ButtonComponent,
  PluginSettingTab
} from 'obsidian';

import type { PluginApiRef } from '../plugin/plugin-api.ts';
import type { PluginNoticeComponent } from './plugin-notice-component.ts';

import { convertAsyncToSync } from '../../async.ts';
import { CssClass } from '../css-class.ts';
import {
  asCodeBlock,
  createFragmentWithCodeBlocks
} from '../html-element.ts';
import { t } from '../i18n/i18n.ts';
import { watchPluginApi } from '../plugin/plugin-api.ts';
import {
  getInstalledPluginState,
  installAndEnablePlugin,
  InstalledPluginState
} from '../plugin/plugin-install-state.ts';
import { registerAsyncEvent } from './async-events-component.ts';
import { ComponentEx } from './component-ex.ts';
import { CallbackLayoutReadyComponent } from './layout-ready-component.ts';

/**
 * Parameters for the {@link PluginDependenciesComponent} constructor.
 */
export interface PluginDependenciesComponentConstructorParams {
  /**
   * The dependencies to enforce. An empty list means the plugin depends on nothing, and its feature
   * surface loads immediately.
   */
  readonly dependencies: readonly PluginDependency[];

  /**
   * Loads the host plugin's feature surface. Called once every dependency is satisfied, and again after a
   * dependency that had gone away comes back.
   *
   * @returns A {@link Promise} that resolves once the surface is loaded.
   */
  loadFeatureSurface(this: void): Promise<void>;

  /**
   * The host plugin — the one declaring the dependencies.
   */
  readonly plugin: Plugin;

  /**
   * The host plugin's notice component, used to say what is missing and what changed.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * Unloads the host plugin's feature surface. Called when a dependency that had been satisfied stops
   * being so.
   */
  unloadFeatureSurface(this: void): void;
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
// eslint-disable-next-line obsidianmd/settings-tab/prefer-setting-definitions -- This tab has no settings to declare. It stands in for a settings tab that does not exist yet, carrying an explanation and a repair button, and the plugin's real settings appear the moment the dependency is satisfied.
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
 * Enforces a plugin's mandatory dependencies, gating its feature surface on them.
 */
export class PluginDependenciesComponent extends ComponentEx {
  private readonly apiRefs = new Map<string, PluginApiRef<object>>();
  private blockedSettingTab: null | PluginSettingTab = null;
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
   * Creates an instance of {@link PluginDependenciesComponent}.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: PluginDependenciesComponentConstructorParams) {
    super();
    this.dependencies = params.dependencies;
    this.loadFeatureSurface = params.loadFeatureSurface;
    this.plugin = params.plugin;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.unloadFeatureSurface = params.unloadFeatureSurface;
  }

  /**
   * Starts watching every declared dependency.
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

    // Nothing is SAID about a missing dependency until the layout is ready. Plugins load in an unspecified
    // Order, so a dependency that simply has not loaded yet is indistinguishable at this point from one
    // That is not installed — announcing here would put a "missing plugin" notice on screen at every
    // Startup and take it away a moment later. The gate itself does not wait: the surface loads the
    // Instant the dependency is there, whenever that is.
    this.addChild(
      new CallbackLayoutReadyComponent(this.app, () => {
        this.isLayoutReady = true;
        this.presentUnsatisfied(this.getUnsatisfiedDependencies());
      })
    );

    this.register(() => {
      this.hideBlockedSettingTab();
    });
  }

  /**
   * Evaluates the dependencies once the watches are in place, loading the feature surface if they are all
   * already satisfied.
   *
   * @returns A {@link Promise} that resolves once the first evaluation is complete.
   */
  public override async onloadAsync(): Promise<void> {
    await this.refresh();
  }

  private createBlockedMessage(dependency: PluginDependency): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginDependency.blockedNotice, {
      dependencyPluginName: asCodeBlock(dependency.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
  }

  private createDependencyLostMessage(dependency: PluginDependency): DocumentFragment {
    return createFragmentWithCodeBlocks(t(($) => $.obsidianDevUtils.pluginDependency.dependencyLostNotice, {
      dependencyPluginName: asCodeBlock(dependency.pluginName),
      pluginName: asCodeBlock(this.plugin.manifest.name)
    }));
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
   * Says what is missing, and puts the same explanation where the user will look for the plugin's
   * settings.
   *
   * @param unsatisfiedDependencies - The dependencies that are not currently satisfied.
   */
  private presentUnsatisfied(unsatisfiedDependencies: readonly PluginDependency[]): void {
    if (!this.isLayoutReady || unsatisfiedDependencies.length === 0) {
      return;
    }

    this.showBlockedSettingTab(unsatisfiedDependencies);

    if (this.hasAnnouncedBlocked) {
      return;
    }

    this.hasAnnouncedBlocked = true;
    for (const dependency of unsatisfiedDependencies) {
      this.pluginNoticeComponent.showNotice(this.createBlockedMessage(dependency));
    }
  }

  /**
   * Re-evaluates every dependency and moves the feature surface to match.
   *
   * @returns A {@link Promise} that resolves once the surface matches the dependencies.
   */
  private async refresh(): Promise<void> {
    const unsatisfiedDependencies = this.getUnsatisfiedDependencies();

    if (unsatisfiedDependencies.length === 0) {
      this.hideBlockedSettingTab();
      this.hasAnnouncedBlocked = false;

      if (!this.isFeatureSurfaceLoaded) {
        this.isFeatureSurfaceLoaded = true;
        await this.loadFeatureSurface();
      }

      return;
    }

    if (this.isFeatureSurfaceLoaded) {
      this.isFeatureSurfaceLoaded = false;
      this.unloadFeatureSurface();

      // A dependency that goes away while the plugin is RUNNING is the case worth being loud about: the
      // User just did something, and the consequence is immediate and invisible without this. Announced
      // Regardless of layout readiness, because a running plugin means the layout is long since ready.
      for (const dependency of unsatisfiedDependencies) {
        this.pluginNoticeComponent.showNotice(this.createDependencyLostMessage(dependency));
      }

      this.hasAnnouncedBlocked = true;
      this.showBlockedSettingTab(unsatisfiedDependencies);
      return;
    }

    this.presentUnsatisfied(unsatisfiedDependencies);
  }

  /**
   * Renders the blocked explanation into a settings-tab container: what is missing, why the plugin needs
   * it, and the button that fixes it.
   *
   * @param containerEl - The element to render into.
   * @param unsatisfiedDependencies - The dependencies that are not currently satisfied.
   */
  private renderBlockedBanner(containerEl: HTMLElement, unsatisfiedDependencies: readonly PluginDependency[]): void {
    containerEl.createEl('h2', { text: t(($) => $.obsidianDevUtils.pluginDependency.settingsHeading) });

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
      // Other half of the relationship being visible from both ends. It is what stops "configure one
      // Operation across two plugins" from meaning "go and find the other plugin yourself".
      if (state !== InstalledPluginState.Enabled) {
        continue;
      }

      new ButtonComponent(bannerEl)
        .setButtonText(t(($) => $.obsidianDevUtils.pluginDependency.openDependencySettings, {
          dependencyPluginName: dependency.pluginName
        }))
        .onClick(() => {
          this.app.setting.open();
          this.app.setting.openTabById(dependency.pluginId);
        });
    }
  }

  private showBlockedSettingTab(unsatisfiedDependencies: readonly PluginDependency[]): void {
    if (this.blockedSettingTab) {
      return;
    }

    // Added through `app.setting` rather than `plugin.addSettingTab`, because this tab has to come back
    // OFF again the moment the dependency arrives — otherwise the plugin's own settings tab, registered by
    // `onloadImpl`, would appear beside a stale "required plugin missing" one. `plugin.addSettingTab`
    // Only ever removes at plugin unload.
    const blockedSettingTab = new BlockedPluginSettingTab({
      plugin: this.plugin,
      renderBanner: (containerEl): void => {
        this.renderBlockedBanner(containerEl, unsatisfiedDependencies);
      }
    });
    this.app.setting.addSettingTab(blockedSettingTab);
    this.blockedSettingTab = blockedSettingTab;
  }
}
