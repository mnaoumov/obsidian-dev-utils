/**
 * @file
 *
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type {
  Debouncer,
  Plugin,
  Setting,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingDefinitionRender,
  SettingGroup
} from 'obsidian';
import type {
  ConditionalKeys,
  Except,
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import {
  debounce,
  PluginSettingTab,
  setTooltip
} from 'obsidian';

import type { StringKeys } from '../../type.ts';
import type {
  PluginSettingsComponentBase,
  ReadonlyPluginSettings,
  ReadonlyPluginSettingsState
} from '../components/plugin-settings-component.ts';
import type { ValueComponentWithChangeTracking } from '../setting-components/value-component-with-change-tracking.ts';
import type { SettingEx } from '../setting-ex.ts';
import type { ValidationMessageHolder } from '../validation.ts';

import { mixinAsyncEvents } from '../../async-events.ts';
import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../async.ts';
import {
  noop,
  noopAsync
} from '../../function.ts';
import {
  castTo,
  isDeepEqual,
  normalizeOptionalProperties
} from '../../object-utils.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { registerAsyncEvent } from '../components/async-events-component.ts';
import { ComponentEx } from '../components/component-ex.ts';
import { CssClass } from '../css-class.ts';
import { ensureWrapped } from '../setting-components/setting-component-wrapper.ts';
import { getTextBasedComponentValue } from '../setting-components/text-based-component.ts';
import { getValidatorComponent } from '../setting-components/validator-component.ts';
import { adoptSettingEx } from '../setting-ex.ts';
import { isValidationMessageHolder } from '../validation.ts';
import { addPluginCssClasses } from './plugin-context.ts';

/**
 * A context passed to the {@link PluginSettingsComponentBase.saveToFile} method.
 */
export const SAVE_TO_FILE_CONTEXT = 'PluginSettingsTab';

/**
 * Options for `PluginSettingsTabBase.bind`.
 *
 * @typeParam T - The type of the settings property value.
 */
export interface BindOptions<T> {
  /**
   * A callback function that is called when the value of the component changes.
   */
  onChanged?(newValue: ReadonlyDeep<T>, oldValue: ReadonlyDeep<T>): Promisable<void>;

  /**
   * Whether to reset the setting when the component value is empty.
   * Applicable only to text-based components.
   *
   * @default `true`
   */
  readonly shouldResetSettingWhenComponentIsEmpty?: boolean;

  /**
   * Whether to show the placeholder for default values.
   * Applicable only to text-based components.
   *
   * @default `true`
   */
  readonly shouldShowPlaceholderForDefaultValues?: boolean;

  /**
   * Whether to show the validation message when the component value is invalid.
   *
   * @default `true`
   */
  readonly shouldShowValidationMessage?: boolean;
}

/**
 * Extended options for `PluginSettingsTabBase.bind`.
 *
 * @typeParam PluginSettings - The plugin settings type.
 * @typeParam UIValue - The type of the UI component's value.
 * @typeParam PropertyName - The settings property name being bound.
 */
export interface BindOptionsExtended<
  PluginSettings extends object,
  UIValue,
  PropertyName extends StringKeys<PluginSettings>
> extends BindOptions<PluginSettings[PropertyName]> {
  /**
   * Converts the UI component's value back to the plugin settings value.
   *
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  componentToPluginSettingsValueConverter(uiValue: UIValue): PluginSettings[PropertyName] | ValidationMessageHolder;

  /**
   * Converts the plugin settings value to the value used by the UI component.
   *
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  pluginSettingsToComponentValueConverter(pluginSettingsValue: ReadonlyDeep<PluginSettings[PropertyName]>): UIValue;
}

/**
 * Extended params for {@link PluginSettingsTabBase.bind} with value converters.
 *
 * @typeParam PluginSettings - The plugin settings type.
 * @typeParam UIValue - The type of the UI component's value.
 * @typeParam TValueComponent - The type of the value component.
 * @typeParam PropertyName - The settings property name being bound.
 */
export interface PluginSettingsTabBaseBindExtendedParams<
  PluginSettings extends object,
  UIValue,
  TValueComponent,
  PropertyName extends StringKeys<PluginSettings>
> extends BindOptionsExtended<PluginSettings, UIValue, PropertyName> {
  /**
   * The property name of the plugin settings to bind to.
   */
  readonly propertyName: PropertyName;

  /**
   * The value component to bind.
   */
  readonly valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>;
}

/**
 * Params for {@link PluginSettingsTabBase.bind}.
 *
 * @typeParam PluginSettings - The plugin settings type.
 * @typeParam UIValue - The type of the UI component's value.
 * @typeParam TValueComponent - The type of the value component.
 */
export interface PluginSettingsTabBaseBindParams<
  PluginSettings extends object,
  UIValue,
  TValueComponent
> extends BindOptions<UIValue> {
  /**
   * The property of the plugin settings to bind to.
   */
  readonly propertyName: ConditionalKeys<PluginSettings, UIValue>;

  /**
   * The value component to bind.
   */
  readonly valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>;
}

/**
 * Params for creating a {@link PluginSettingsTabBase}.
 *
 * @typeParam PluginSettings - The plugin settings type.
 */
export interface PluginSettingsTabBaseConstructorParams<PluginSettings extends object> {
  /**
   * The plugin instance (needed by Obsidian's PluginSettingTab).
   */
  readonly plugin: Plugin;

  /**
   * The settings component.
   */
  readonly pluginSettingsComponent: PluginSettingsComponentBase<PluginSettings>;
}

/**
 * Params for {@link PluginSettingsTabBase.settingEx}.
 */
export interface PluginSettingsTabBaseSettingExParams {
  /**
   * Additional search terms for the setting.
   */
  readonly aliases?: string[];

  /**
   * The description of the setting. Used for rendering; the text content of a fragment is used for search.
   */
  readonly desc?: DocumentFragment | string;

  /**
   * Whether the setting row is disabled.
   *
   * A function form is re-evaluated on every render AND on every {@link PluginSettingsTabBase.refreshDomState}
   * call, so it can reflect runtime state. Obsidian applies it with `Setting.setDisabled`, which disables the
   * row and every component registered on it.
   */
  readonly disabled?: (() => boolean) | boolean;

  /**
   * The display name of the setting. Used for rendering and search.
   */
  readonly name: string;

  /**
   * Renders the setting row imperatively, typically via the {@link SettingEx} adders and
   * {@link PluginSettingsTabBase.bind}.
   *
   * The setting Obsidian creates for the row is adopted into a {@link SettingEx} before it is handed over, so
   * an imperative row body carries over unchanged. May return a cleanup function, invoked before the row is
   * torn down or re-rendered.
   *
   * @param setting - The setting to render into.
   * @param group - The group the setting belongs to.
   * @returns An optional cleanup function.
   */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- Mirrors Obsidian's `SettingDefinitionRender.render`, whose cleanup function is optional.
  render(setting: SettingEx, group: SettingGroup): (() => void) | void;

  /**
   * Controls whether the setting is included in the settings search. Defaults to `true`.
   */
  readonly searchable?: (() => boolean) | boolean;

  /**
   * Controls whether the setting row is rendered. A function form is re-evaluated on every render and on
   * every {@link PluginSettingsTabBase.refreshDomState} call. Defaults to `true`.
   */
  readonly visible?: (() => boolean) | boolean;
}

/**
 * Params for {@link PluginSettingsTabBase.settingGroupEx}.
 *
 * Every member of {@link SettingDefinitionGroup} except its discriminator, which
 * {@link PluginSettingsTabBase.settingGroupEx} sets.
 */
export type PluginSettingsTabBaseSettingGroupExParams = Except<SettingDefinitionGroup, 'type'>;

/**
 * Implementation params for {@link PluginSettingsTabBase.bind}.
 *
 * @typeParam PluginSettings - The plugin settings type.
 * @typeParam UIValue - The type of the UI component's value.
 * @typeParam TValueComponent - The type of the value component.
 * @typeParam PropertyName - The settings property name being bound.
 */
interface PluginSettingsTabBaseBindImplParams<
  PluginSettings extends object,
  UIValue,
  TValueComponent,
  PropertyName extends StringKeys<PluginSettings>
> extends BindOptions<PluginSettings[PropertyName]> {
  /**
   * The property name of the plugin settings to bind to.
   */
  readonly propertyName: PropertyName;

  /**
   * The value component to bind.
   */
  readonly valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>;
}

interface PluginSettingsTabBaseEventMap {
  validationMessageChanged: [propertyName: string, validationMessage: string];
}

/**
 * Parameters for {@link PluginSettingsTabBase.onSaveSettings}.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
interface PluginSettingsTabBaseOnSaveSettingsParams<PluginSettings extends object> {
  /**
   * The save context.
   */
  readonly context: unknown;

  /**
   * The new settings state.
   */
  readonly newState: ReadonlyPluginSettingsState<PluginSettings>;

  /**
   * The old settings state.
   */
  readonly oldState: ReadonlyPluginSettingsState<PluginSettings>;
}

/**
 * Params for {@link PluginSettingsTabBase.renderSettingEx}.
 */
interface PluginSettingsTabBaseRenderSettingExParams {
  /**
   * The group the row belongs to.
   */
  readonly group: SettingGroup;

  /**
   * The setting Obsidian created for the row.
   */
  readonly setting: Setting;

  /**
   * The params the row was declared with.
   */
  readonly settingExParams: PluginSettingsTabBaseSettingExParams;
}

/**
 * Constructor params for {@link PluginSettingsTabEventsComponent}.
 *
 * @typeParam PluginSettings - The plugin settings type.
 */
interface PluginSettingsTabEventsComponentConstructorParams<PluginSettings extends object> {
  /**
   * Called when the plugin settings are loaded.
   */
  onLoadSettings(loadedState: ReadonlyPluginSettingsState<PluginSettings>, isInitialLoad: boolean): Promisable<void>;

  /**
   * Called when the plugin settings are saved.
   */
  onSaveSettings(
    newState: ReadonlyPluginSettingsState<PluginSettings>,
    oldState: ReadonlyPluginSettingsState<PluginSettings>,
    context: unknown
  ): Promisable<void>;

  /**
   * The settings component to subscribe to.
   */
  readonly pluginSettingsComponent: PluginSettingsComponentBase<PluginSettings>;
}

/**
 * Owns the tab's subscriptions to the settings component.
 *
 * The subscriptions live in {@link onload} rather than at each render, so that a load/unload pair registers
 * them exactly once. Registering them per render instead would accumulate a fresh pair on every render cycle,
 * because {@link ComponentEx.load} early-returns once the component is loaded and nothing resets in between.
 *
 * @typeParam PluginSettings - The plugin settings type.
 */
class PluginSettingsTabEventsComponent<PluginSettings extends object> extends ComponentEx {
  private readonly params: PluginSettingsTabEventsComponentConstructorParams<PluginSettings>;

  /**
   * Creates a new component.
   *
   * @param params - The params.
   */
  public constructor(params: PluginSettingsTabEventsComponentConstructorParams<PluginSettings>) {
    super();
    this.params = params;
  }

  /**
   * Subscribes to the settings component's events.
   */
  public override onload(): void {
    super.onload();
    const { pluginSettingsComponent } = this.params;
    registerAsyncEvent(this, pluginSettingsComponent.on('loadSettings', (loadedState, isInitialLoad) => this.params.onLoadSettings(loadedState, isInitialLoad)));
    registerAsyncEvent(this, pluginSettingsComponent.on('saveSettings', (newState, oldState, context) => this.params.onSaveSettings(newState, oldState, context)));
  }
}

/**
 * Base class for creating plugin settings tabs in Obsidian.
 * Provides a method for binding value components to plugin settings and handling changes.
 *
 * @typeParam PluginSettings - The plugin settings type.
 */
export abstract class PluginSettingsTabBase<PluginSettings extends object> extends mixinAsyncEvents<PluginSettingsTabBaseEventMap>()(PluginSettingTab) {
  /**
   * Whether the plugin settings tab is open.
   *
   * @returns Whether the plugin settings tab is open.
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * The settings manager.
   */
  protected readonly pluginSettingsComponent: PluginSettingsComponentBase<PluginSettings>;

  /**
   * A debounce timeout for saving settings.
   *
   * @returns The debounce timeout for saving settings.
   */
  protected get saveSettingsDebounceTimeoutInMilliseconds(): number {
    const DEFAULT = 2000;
    return DEFAULT;
  }

  private _isOpen = false;
  private readonly component: PluginSettingsTabEventsComponent<PluginSettings>;
  private currentRenderComponent: ComponentEx | null = null;
  private readonly saveSettingsDebounced: Debouncer<[], void>;

  private get pluginSettings(): ReadonlyPluginSettings<PluginSettings> {
    return this.pluginSettingsComponent.settingsState.inputValues;
  }

  /**
   * Creates a new plugin settings tab.
   *
   * @param params - The params.
   */
  public constructor(params: PluginSettingsTabBaseConstructorParams<PluginSettings>) {
    super(params.plugin.app, params.plugin);
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    addPluginCssClasses(this.containerEl, CssClass.PluginSettingsTab);
    this.saveSettingsDebounced = debounce(
      convertAsyncToSync(() => this.pluginSettingsComponent.saveToFile(SAVE_TO_FILE_CONTEXT)),
      this.saveSettingsDebounceTimeoutInMilliseconds
    );
    this.component = new PluginSettingsTabEventsComponent<PluginSettings>({
      onLoadSettings: (loadedState, isInitialLoad): Promisable<void> => this.onLoadSettings(loadedState, isInitialLoad),
      onSaveSettings: (newState, oldState, context): Promisable<void> => this.onSaveSettings({ context, newState, oldState }),
      pluginSettingsComponent: this.pluginSettingsComponent
    });
  }

  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @param params - The params for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent
  >(
    params: PluginSettingsTabBaseBindParams<PluginSettings, UIValue, TValueComponent>
  ): TValueComponent;
  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @typeParam PropertyName - The property name of the plugin settings to bind to.
   * @param params - The params for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent,
    PropertyName extends StringKeys<PluginSettings>
  >(
    params: PluginSettingsTabBaseBindExtendedParams<PluginSettings, UIValue, TValueComponent, PropertyName>
  ): TValueComponent;
  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @typeParam PropertyName - The property name of the plugin settings to bind to.
   * @param params - The params for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent,
    PropertyName extends StringKeys<PluginSettings>
  >(
    params: PluginSettingsTabBaseBindImplParams<PluginSettings, UIValue, TValueComponent, PropertyName> // eslint-disable-line obsidian-dev-utils/params-options-name-match -- bind overload shares the Bind* param family.
  ): TValueComponent {
    const {
      propertyName,
      valueComponent,
      ...options
    } = params;
    type PropertyType = PluginSettings[PropertyName];
    const DEFAULT_OPTIONS: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = {
      componentToPluginSettingsValueConverter: (value: UIValue): PropertyType => value as PropertyType,
      onChanged: noop,
      pluginSettingsToComponentValueConverter: (value: ReadonlyDeep<PropertyType>): UIValue => value as UIValue,
      shouldResetSettingWhenComponentIsEmpty: true,
      shouldShowPlaceholderForDefaultValues: true,
      shouldShowValidationMessage: true
    };

    const optionsExtension: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = { ...DEFAULT_OPTIONS, ...options };

    const validatorElement = getValidatorComponent(valueComponent)?.validatorElement;

    const textBasedComponent = getTextBasedComponentValue(valueComponent);

    const readonlyValue = this.getPluginSettingsProperty(propertyName);
    const defaults = this.pluginSettingsComponent.defaultSettings as PluginSettings;
    const defaultValue = defaults[propertyName];
    const defaultComponentValue = optionsExtension.pluginSettingsToComponentValueConverter(defaultValue as ReadonlyDeep<PropertyType>);
    textBasedComponent?.setPlaceholderValue(defaultComponentValue);

    let validationMessage: string;
    let tooltipElement: HTMLElement | null = null;
    let tooltipContentElement: HTMLElement | null = null;
    if (validatorElement) {
      const wrapper = ensureWrapped(validatorElement);
      tooltipElement = wrapper.createDiv();
      addPluginCssClasses(tooltipElement, [CssClass.Tooltip, CssClass.TooltipValidator]);
      tooltipContentElement = tooltipElement.createSpan();
      const tooltipArrowElement = tooltipElement.createDiv();
      addPluginCssClasses(tooltipArrowElement, CssClass.TooltipArrow);
      tooltipElement.hide();
      wrapper.append(tooltipElement);
    }

    registerAsyncEvent(
      this.getRenderComponent(),
      this.on('validationMessageChanged', (anotherPropertyName, anotherValidationMessage) => {
        if (propertyName !== anotherPropertyName) {
          return;
        }

        validationMessage = anotherValidationMessage;
        updateValidatorElementDebounced();
      })
    );

    let shouldEmptyOnBlur = false;
    let shouldRevertToDefaultValueOnBlur = false;

    if (textBasedComponent && optionsExtension.shouldShowPlaceholderForDefaultValues && isDeepEqual(readonlyValue, defaultValue)) {
      textBasedComponent.empty();
    } else {
      valueComponent.setValue(optionsExtension.pluginSettingsToComponentValueConverter(readonlyValue));
    }

    let shouldSkipOnChange = false;
    const UPDATE_VALIDATOR_EL_TIMEOUT_IN_MILLISECONDS = 100;
    const updateValidatorElementDebounced = debounce(() => {
      window.requestAnimationFrame(() => {
        updateValidatorElement();
      });
    }, UPDATE_VALIDATOR_EL_TIMEOUT_IN_MILLISECONDS);

    valueComponent.onChange(convertAsyncToSync(async (uiValue) => {
      if (shouldSkipOnChange) {
        shouldSkipOnChange = false;
        return;
      }

      shouldEmptyOnBlur = false;

      const oldValue = this.getPluginSettingsProperty(propertyName);
      let newValue: PropertyType | undefined;
      let shouldSetProperty = true;
      shouldRevertToDefaultValueOnBlur = !!textBasedComponent?.isEmpty() && optionsExtension.shouldResetSettingWhenComponentIsEmpty;
      if (shouldRevertToDefaultValueOnBlur) {
        newValue = defaultValue;
      } else {
        const convertedValue = optionsExtension.componentToPluginSettingsValueConverter(uiValue);
        if (isValidationMessageHolder(convertedValue)) {
          validationMessage = convertedValue.validationMessage;
          shouldSetProperty = false;
        } else {
          newValue = convertedValue;
        }
      }

      if (shouldSetProperty) {
        validationMessage = await this.pluginSettingsComponent.setProperty(propertyName, newValue as PluginSettings[PropertyName]);
        if (textBasedComponent && optionsExtension.shouldShowPlaceholderForDefaultValues && !textBasedComponent.isEmpty() && isDeepEqual(newValue, defaultValue)) {
          shouldEmptyOnBlur = true;
        }
      }

      updateValidatorElementDebounced();
      if (shouldSetProperty) {
        await optionsExtension.onChanged(newValue as ReadonlyDeep<PropertyType>, oldValue);
      }
      this.saveSettingsDebounced();
    }));

    validatorElement?.addEventListener('focus', () => {
      updateValidatorElementDebounced();
    });
    validatorElement?.addEventListener('blur', () => {
      updateValidatorElementDebounced();
    });
    validatorElement?.addEventListener('click', () => {
      window.requestAnimationFrame(() => {
        updateValidatorElementDebounced();
      });
    });

    const validationMessages = this.pluginSettingsComponent.settingsState.validationMessages as Record<string, string>;
    validationMessage = validationMessages[propertyName] ?? '';
    updateValidatorElementDebounced();

    return valueComponent;

    function updateValidatorElement(): void {
      if (!validatorElement?.isActiveElement()) {
        if (shouldEmptyOnBlur) {
          shouldEmptyOnBlur = false;

          if (!textBasedComponent?.isEmpty()) {
            shouldSkipOnChange = true;
            textBasedComponent?.empty();
          }
        } else if (shouldRevertToDefaultValueOnBlur) {
          shouldRevertToDefaultValueOnBlur = false;

          if (textBasedComponent?.isEmpty()) {
            shouldSkipOnChange = true;
            valueComponent.setValue(defaultComponentValue);
          }
        }
      }

      if (!validatorElement) {
        return;
      }

      assertNonNullable(tooltipContentElement);

      if (validationMessage === '') {
        validatorElement.setCustomValidity('');
        validatorElement.checkValidity();
        validationMessage = validatorElement.validationMessage;
      }

      validatorElement.setCustomValidity(validationMessage);
      if (optionsExtension.shouldShowValidationMessage) {
        tooltipContentElement.textContent = validationMessage;
        tooltipElement?.toggle(!!validationMessage);
      } else if (validationMessage) {
        setTooltip(validatorElement, validationMessage);
      }
    }
  }

  /**
   * Renders the plugin settings tab.
   */
  public override display(): void {
    this.displayLegacy();
  }

  /**
   * Legacy way to render the plugin settings tab imperatively.
   *
   * The pre-declarative fallback: Obsidian only calls it when {@link getSettingDefinitions} returns an empty
   * array, i.e. when the consumer has not overridden {@link getSettingDefinitionItems}. Such a consumer
   * overrides this method and builds the UI with {@link SettingEx} and {@link bind}.
   */
  public displayLegacy(): void {
    this.beginRenderCycle();
    this.containerEl.empty();
  }

  /**
   * Reads the value backing a native `control` setting definition.
   *
   * Obsidian calls it on every render of a `control`-type definition. The inherited implementation reads
   * `plugin.settings`, which a plugin built on {@link PluginSettingsComponentBase} never populates, so it is
   * routed to the settings component instead.
   *
   * @param key - The settings property name.
   * @returns The current value.
   */
  public override getControlValue(key: string): unknown {
    return this.getPluginSettingsProperty(castTo<StringKeys<PluginSettings>>(key));
  }

  /**
   * Returns the declarative setting definitions rendered by Obsidian 1.13+.
   *
   * Delegates to {@link getSettingDefinitionItems}. When a consumer has not overridden that hook it returns
   * an empty array, and Obsidian falls back to the imperative {@link displayLegacy} path.
   *
   * @returns The setting definitions.
   */
  public override getSettingDefinitions(): SettingDefinitionItem[] {
    return this.getSettingDefinitionItems();
  }

  /**
   * Hides the plugin settings tab.
   */
  public override hide(): void {
    super.hide();
    this.saveSettingsDebounced.cancel();
    this._isOpen = false;
    this.endRenderCycle();
    this.component.unload();
    invokeAsyncSafely(() => this.hideAsync());
  }

  /**
   * Async actions to perform when the settings tab is being hidden.
   *
   * @returns A {@link Promise} that resolves when the settings tab is hidden.
   */
  public async hideAsync(): Promise<void> {
    await this.pluginSettingsComponent.saveToFile(SAVE_TO_FILE_CONTEXT);
  }

  /**
   * Re-renders the settings tab after the underlying state changed.
   *
   * Rebuilds the definitions and re-renders, which covers both paths: Obsidian renders the declarative
   * definitions when {@link getSettingDefinitionItems} provides them, and falls back to
   * {@link displayLegacy} when it does not. Nothing is rendered while the tab is not the one on screen.
   *
   * Use it only for changes that alter the STRUCTURE of the tab — rows added or removed. When only a
   * {@link PluginSettingsTabBaseSettingExParams.disabled} / {@link PluginSettingsTabBaseSettingExParams.visible}
   * predicate has to be re-evaluated, call the much cheaper {@link refreshDomState} instead, which toggles the
   * rendered DOM in place.
   */
  public refresh(): void {
    this.update();
  }

  /**
   * Persists the value of a native `control` setting definition.
   *
   * The counterpart of {@link getControlValue}: it routes the write to the settings component instead of the
   * inherited `plugin.saveData` path, so validation, transformers and the debounced save all apply as they do
   * for a {@link bind}-ed component.
   *
   * @param key - The settings property name.
   * @param value - The value to persist.
   * @returns A {@link Promise} that resolves when the value is set.
   */
  public override async setControlValue(key: string, value: unknown): Promise<void> {
    type PropertyName = StringKeys<PluginSettings>;
    await this.pluginSettingsComponent.setProperty(castTo<PropertyName>(key), castTo<PluginSettings[PropertyName]>(value));
    this.saveSettingsDebounced();
  }

  /**
   * Shows the plugin settings tab.
   */
  public show(): void {
    this.app.setting.openTab(this);
  }

  /**
   * The declarative setting definitions for the tab (Obsidian 1.13+).
   *
   * Consumers override this, typically building each row with {@link settingEx} and {@link bind} and grouping
   * them with `settingGroupEx`. Returning an empty array — the default — makes Obsidian fall back to the
   * imperative {@link displayLegacy} path.
   *
   * MUST be a pure builder. Obsidian calls it when the tab is registered (`addSettingTab`), long before the
   * tab is ever opened, in order to index the settings for search. Anything with a side effect belongs inside
   * a row's {@link PluginSettingsTabBaseSettingExParams.render} callback, which runs only when the row is
   * actually rendered.
   *
   * @returns The setting definitions.
   */
  protected getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [];
  }

  /**
   * Called when the plugin settings are loaded.
   *
   * @param _loadedState - The loaded settings state.
   * @param _isInitialLoad - Whether the settings are being loaded for the first time.
   * @returns A {@link Promise} that resolves when the settings are loaded.
   */
  protected async onLoadSettings(_loadedState: ReadonlyPluginSettingsState<PluginSettings>, _isInitialLoad: boolean): Promise<void> {
    this.refresh();
    await noopAsync();
  }

  /**
   * Revalidates the settings.
   *
   * @returns A {@link Promise} that resolves when the settings are revalidated.
   */
  protected async revalidate(): Promise<void> {
    const validationMessages = await this.pluginSettingsComponent.revalidate();
    await this.updateValidations(validationMessages);
  }

  /**
   * Builds a search-indexable declarative row that is rendered imperatively.
   *
   * The bridge between the declarative API and ODU's imperative building blocks: Obsidian owns the row (so it
   * indexes it for search and evaluates its {@link PluginSettingsTabBaseSettingExParams.visible} /
   * {@link PluginSettingsTabBaseSettingExParams.disabled} predicates on every
   * {@link refreshDomState}), while {@link PluginSettingsTabBaseSettingExParams.render} fills it in with
   * {@link SettingEx} adders and {@link bind} exactly as an imperative tab would.
   *
   * @param params - The row params.
   * @returns The setting definition.
   */
  protected settingEx(params: PluginSettingsTabBaseSettingExParams): SettingDefinitionRender {
    return normalizeOptionalProperties<SettingDefinitionRender>({
      aliases: params.aliases,
      desc: params.desc,
      disabled: params.disabled,
      name: params.name,
      render: (setting: Setting, group: SettingGroup) => this.renderSettingEx({ group, setting, settingExParams: params }),
      searchable: params.searchable,
      visible: params.visible
    });
  }

  /**
   * Builds a declarative heading group.
   *
   * The declarative counterpart of `SettingGroupEx`: where that class appends a group to a container
   * imperatively, this returns the definition Obsidian renders, so a group-structured tab keeps its shape
   * after the migration.
   *
   * @param params - The group params.
   * @returns The group definition.
   */
  protected settingGroupEx(params: PluginSettingsTabBaseSettingGroupExParams): SettingDefinitionGroup {
    return normalizeOptionalProperties<SettingDefinitionGroup>({
      ...params,
      type: 'group'
    });
  }

  private beginRenderCycle(): void {
    this.endRenderCycle();
    this.currentRenderComponent = this.createRenderComponent();
  }

  private createRenderComponent(): ComponentEx {
    this._isOpen = true;
    this.component.load();
    return this.component.addChild(new ComponentEx());
  }

  private endRenderCycle(): void {
    const renderComponent = this.currentRenderComponent;
    if (!renderComponent) {
      return;
    }

    this.currentRenderComponent = null;
    this.component.removeChild(renderComponent);
  }

  private getPluginSettingsProperty<PropertyName extends StringKeys<PluginSettings>>(
    propertyName: PropertyName
  ): ReadonlyDeep<PluginSettings[PropertyName]> {
    const settings = this.pluginSettings as PluginSettings;
    return settings[propertyName] as ReadonlyDeep<PluginSettings[PropertyName]>;
  }

  private getRenderComponent(): ComponentEx {
    this.currentRenderComponent ??= this.createRenderComponent();
    return this.currentRenderComponent;
  }

  private async onSaveSettings(params: PluginSettingsTabBaseOnSaveSettingsParams<PluginSettings>): Promise<void> {
    const {
      context,
      newState,
      oldState: _oldState
    } = params;
    if (context === SAVE_TO_FILE_CONTEXT) {
      await this.updateValidations(newState.validationMessages as Record<StringKeys<PluginSettings>, string>);
      return;
    }

    this.refresh();
  }

  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- Mirrors Obsidian's `SettingDefinitionRender.render`, whose cleanup function is optional.
  private renderSettingEx(params: PluginSettingsTabBaseRenderSettingExParams): (() => void) | void {
    const rowComponent = this.createRenderComponent();
    const previousRenderComponent = this.currentRenderComponent;
    this.currentRenderComponent = rowComponent;

    try {
      const cleanup = params.settingExParams.render(adoptSettingEx(params.setting), params.group);
      return () => {
        if (typeof cleanup === 'function') {
          cleanup();
        }

        this.component.removeChild(rowComponent);
      };
    } finally {
      this.currentRenderComponent = previousRenderComponent;
    }
  }

  private async updateValidations(validationMessages: Record<StringKeys<PluginSettings>, string>): Promise<void> {
    for (const [propertyName, validationMessage] of Object.entries(validationMessages)) {
      await this.triggerAsync('validationMessageChanged', propertyName, validationMessage as string);
    }
  }
}
