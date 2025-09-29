/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits multiple text values.
 */

import type { Promisable } from 'type-fest';

import {
  loadPrism,
  TextAreaComponent,
  ValueComponent
} from 'obsidian';

import type { ValidatorElement } from '../../../HTMLElement.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../SettingEx.ts';
import type { TextBasedComponent } from './TextBasedComponent.ts';
import type { ValidatorComponent } from './ValidatorComponent.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../../Async.ts';
import { CssClass } from '../../../CssClass.ts';
import { toPx } from '../../../HTMLElement.ts';
import { addPluginCssClasses } from '../../Plugin/PluginContext.ts';

/**
 * A component that displays and edits code.
 *
 * You can add this component using {@link SettingEx.addCodeHighlighter}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class CodeHighlighterComponent extends ValueComponent<string>
  implements TextBasedComponent<string>, ValidatorComponent, ValueComponentWithChangeTracking<string> {
  /**
   * An input element of the component.
   *
   * @returns The input element of the component.
   */
  public get inputEl(): HTMLTextAreaElement {
    return this.textAreaComponent.inputEl;
  }

  /**
   * Gets the validator element of the component.
   *
   * @returns The validator element of the component.
   */
  public get validatorEl(): ValidatorElement {
    return this.inputEl;
  }

  private readonly codeEl: HTMLElement;
  private placeholder = '';
  private readonly preEl: HTMLElement;
  private tabSize: number;
  private readonly textAreaComponent: TextAreaComponent;

  /**
   * Creates a new multiple text component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super();
    addPluginCssClasses(containerEl, CssClass.CodeHighlighterComponent);

    const wrapper = containerEl.createDiv();
    addPluginCssClasses(wrapper, CssClass.SettingComponentWrapper);

    this.textAreaComponent = new TextAreaComponent(wrapper);
    this.preEl = wrapper.createEl('pre');
    this.codeEl = this.preEl.createEl('code');

    this.inputEl.addEventListener('input', convertAsyncToSync(this.updateHighlightedCode.bind(this)));
    this.inputEl.addEventListener('scroll', this.handleScroll.bind(this));
    this.inputEl.addEventListener('keydown', this.handleKeyDown.bind(this));
    const DEFAULT_TAB_SIZE = 2;
    this.tabSize = DEFAULT_TAB_SIZE;
  }

  /**
   * Empties the component.
   */
  public empty(): void {
    this.setValue('');
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): string {
    return this.textAreaComponent.getValue();
  }

  /**
   * Checks if the component is empty.
   *
   * @returns `true` if the component is empty, `false` otherwise.
   */
  public isEmpty(): boolean {
    return this.textAreaComponent.getValue() === '';
  }

  /**
   * Adds a change listener to the component.
   *
   * @param callback - The callback to call when the value changes.
   * @returns The component.
   */
  public onChange(callback: (newValue: string) => Promisable<void>): this {
    this.textAreaComponent.onChange(() => callback(this.getValue()));
    return this;
  }

  /**
   * Sets the disabled state of the component.
   *
   * @param disabled - The disabled state to set.
   * @returns The component.
   */
  public override setDisabled(disabled: boolean): this {
    super.setDisabled(disabled);
    this.textAreaComponent.setDisabled(disabled);
    return this;
  }

  /**
   * Sets the language for code highlighting.
   *
   * @param language - The language to set.
   * @returns The component.
   */
  public setLanguage(language: string): this {
    const LANGUAGE_CLASS_PREFIX = 'language-';
    for (const el of [this.preEl, this.codeEl]) {
      for (const cls of Array.from(el.classList)) {
        if (cls.startsWith(LANGUAGE_CLASS_PREFIX)) {
          el.classList.remove(cls);
        }
      }
      el.classList.add(`${LANGUAGE_CLASS_PREFIX}${language}`);
    }
    return this;
  }

  /**
   * Sets the placeholder of the component.
   *
   * @param placeholder - The placeholder to set.
   * @returns The component.
   */
  public setPlaceholder(placeholder: string): this {
    this.placeholder = placeholder;
    invokeAsyncSafely(this.updateHighlightedCode.bind(this));
    return this;
  }

  /**
   * Sets the placeholder value of the component.
   *
   * @param placeholderValue - The placeholder value to set.
   * @returns The component.
   */
  public setPlaceholderValue(placeholderValue: string): this {
    this.setPlaceholder(placeholderValue);
    return this;
  }

  /**
   * Sets the tab size of the component.
   *
   * @param tabSize - The tab size to set.
   * @returns The component.
   */
  public setTabSize(tabSize: number): this {
    this.tabSize = tabSize;
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public override setValue(value: string): this {
    this.textAreaComponent.setValue(value);
    invokeAsyncSafely(this.updateHighlightedCode.bind(this));
    return this;
  }

  private handleKeyDown(evt: KeyboardEvent): void {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      const focusables = Array.from(document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [tabindex]:not([tabindex=-1])'
      )).filter((el) => !el.hasAttribute('disabled'));
      const i = focusables.indexOf(this.inputEl);
      const next = focusables[(i + 1) % focusables.length];
      next?.focus();
      return;
    }

    if (evt.key !== 'Tab') {
      return;
    }

    evt.preventDefault();

    const oldValue = this.getValue();
    const selectionStart = this.inputEl.selectionStart;
    const selectionEnd = this.inputEl.selectionEnd;
    const beforeSelection = oldValue.slice(0, selectionStart);
    const afterSelection = oldValue.slice(selectionEnd);
    const tabs = ' '.repeat(this.tabSize);
    let newBeforeSelection = beforeSelection;

    if (evt.shiftKey) {
      if (beforeSelection.endsWith(tabs)) {
        newBeforeSelection = beforeSelection.slice(0, -this.tabSize);
      }
    } else {
      newBeforeSelection = beforeSelection + tabs;
    }

    const newValue = `${newBeforeSelection}${afterSelection}`;
    this.setValue(newValue);
    this.inputEl.selectionStart = newBeforeSelection.length;
    this.inputEl.selectionEnd = newBeforeSelection.length;
  }

  private handleScroll(): void {
    this.preEl.scrollTop = this.inputEl.scrollTop;
    this.preEl.scrollLeft = this.inputEl.scrollLeft;
  }

  private async updateHighlightedCode(): Promise<void> {
    this.codeEl.textContent = this.inputEl.value || this.placeholder;
    const prism = await loadPrism();
    prism.highlightElement(this.codeEl);
    this.preEl.toggleClass(CssClass.IsPlaceholder, this.isEmpty());
    requestAnimationFrame(() => {
      const gap = Math.max(0, this.inputEl.scrollHeight - this.preEl.scrollHeight);
      this.preEl.setCssProps({
        '--bottom-gap': toPx(gap)
      });
      this.handleScroll();
    });
  }
}
