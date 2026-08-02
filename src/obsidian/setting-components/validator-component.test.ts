// @vitest-environment jsdom

import {
  ColorComponent,
  DropdownComponent,
  ProgressBarComponent,
  SearchComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ToggleComponent
} from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../../function.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { getValidatorComponent } from './validator-component.ts';

vi.mock('../css-class.ts', () => ({
  CssClass: {
    OverlayValidator: 'overlay-validator',
    SettingComponentWrapper: 'setting-component-wrapper'
  }
}));

vi.mock('../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('getValidatorComponent', () => {
  it('should return null for unknown objects', () => {
    expect(getValidatorComponent({})).toBeNull();
    expect(getValidatorComponent('string')).toBeNull();
  });

  it('should return the object itself if it already implements ValidatorComponent', () => {
    const validatorElement = createEl('input');
    const $object = { validatorElement };
    const result = getValidatorComponent($object);
    expect(result).toBe($object);
  });

  it('should wrap ColorComponent with ValidatorElementWrapper', () => {
    const container = createDiv();
    const comp = new ColorComponent(container);
    const colorPickerElement = createEl('input', { type: 'color' });
    // eslint-disable-next-line unicorn/name-replacements -- The member belongs to a dependency and cannot be renamed here.
    comp.colorPickerEl = colorPickerElement;
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorElement).toBe(colorPickerElement);
  });

  it('should wrap DropdownComponent with ValidatorElementWrapper', () => {
    const container = createDiv();
    const comp = new DropdownComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorElement).toBe(comp.selectEl);
  });

  it('should wrap SearchComponent with ValidatorElementWrapper', () => {
    const container = createDiv();
    const comp = new SearchComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);

    expect(result.validatorElement).toBe(comp.inputEl);
  });

  it('should wrap SliderComponent with ValidatorElementWrapper', () => {
    const container = createDiv();
    const comp = new SliderComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorElement).toBe(comp.sliderEl);
  });

  it('should wrap TextAreaComponent with ValidatorElementWrapper', () => {
    const container = createDiv();
    const comp = new TextAreaComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);

    expect(result.validatorElement).toBe(comp.inputEl);
  });

  it('should wrap TextComponent with ValidatorElementWrapper', () => {
    const container = createDiv();
    const comp = new TextComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);

    expect(result.validatorElement).toBe(comp.inputEl);
  });

  it('should create OverlayValidatorComponent for ProgressBarComponent', () => {
    const parent = createDiv();
    const container = createDiv();
    parent.appendChild(container);
    const comp = new ProgressBarComponent(container);
    // Pre-assign progressBar so the strict proxy allows access
    const progressBar = createDiv();
    comp.progressBar = progressBar;
    // ProgressBarComponent.progressBar needs to be inside parent
    parent.appendChild(progressBar);

    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorElement).toBeInstanceOf(HTMLInputElement);
  });

  it('should create OverlayValidatorComponent for ToggleComponent', () => {
    const parent = createDiv();
    const container = createDiv();
    parent.appendChild(container);
    const comp = new ToggleComponent(container);
    parent.appendChild(comp.toggleEl);

    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorElement).toBeInstanceOf(HTMLInputElement);
  });

  it('should handle focus on overlay validator element', () => {
    const parent = createDiv();
    const element = createDiv();
    parent.appendChild(element);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    const result = getValidatorComponent(comp);
    assertNonNullable(result);
    const validatorElement = result.validatorElement;
    validatorElement.dispatchEvent(new Event('focus'));
  });

  it('should handle focusin on overlay element', () => {
    const parent = createDiv();
    const element = createDiv();
    parent.appendChild(element);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    getValidatorComponent(comp);
    comp.toggleEl.dispatchEvent(new Event('focusin'));
  });

  it('should handle click on overlay element', () => {
    const parent = createDiv();
    const element = createDiv();
    parent.appendChild(element);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    getValidatorComponent(comp);
    comp.toggleEl.dispatchEvent(new Event('click'));
  });

  it('should handle focusout on overlay element when not focused', async () => {
    await noopAsync();
    vi.useFakeTimers();
    const parent = createDiv();
    const element = createDiv();
    parent.appendChild(element);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    getValidatorComponent(comp);
    comp.toggleEl.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
  });

  it('should skip blur when element is still active during focusout', () => {
    vi.useFakeTimers();
    const parent = createDiv();
    activeDocument.body.appendChild(parent);
    const element = createDiv();
    element.tabIndex = 0;
    parent.appendChild(element);
    const comp = new ToggleComponent(parent);
    Object.defineProperty(comp, 'toggleEl', { value: element });

    getValidatorComponent(comp);
    element.focus();
    element.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    activeDocument.body.removeChild(parent);
  });

  it('should use element with tabindex if present', () => {
    const parent = createDiv();
    const element = createDiv();
    const tabElement = createEl('button');
    tabElement.setAttribute('tabindex', '0');
    element.appendChild(tabElement);
    parent.appendChild(element);
    const comp = new ProgressBarComponent(parent);
    // Override progressBar to be our element with a child that has tabindex
    Object.defineProperty(comp, 'progressBar', { value: element });

    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
  });

  it('should set tabIndex on element without tabindex attribute', () => {
    const parent = createDiv();
    const element = createDiv();
    parent.appendChild(element);
    const comp = new ToggleComponent(parent);
    Object.defineProperty(comp, 'toggleEl', { value: element });

    getValidatorComponent(comp);
    expect(element.tabIndex).toBe(-1);
  });
});
