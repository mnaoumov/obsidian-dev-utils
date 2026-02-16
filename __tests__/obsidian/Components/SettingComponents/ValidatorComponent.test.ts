// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  ColorComponent,
  DropdownComponent,
  ProgressBarComponent,
  SearchComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ToggleComponent
} from '../../../../__mocks__/obsidian/index.ts';
import { getValidatorComponent } from '../../../../src/obsidian/Components/SettingComponents/ValidatorComponent.ts';
import { assertNonNullable } from '../../../../src/TypeGuards.ts';

vi.mock('../../../../src/CssClass.ts', () => ({
  CssClass: {
    OverlayValidator: 'overlay-validator',
    SettingComponentWrapper: 'setting-component-wrapper'
  }
}));

vi.mock('../../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('getValidatorComponent', () => {
  it('should return null for unknown objects', () => {
    expect(getValidatorComponent({})).toBeNull();
    expect(getValidatorComponent('string')).toBeNull();
  });

  it('should return the object itself if it already implements ValidatorComponent', () => {
    const validatorEl = document.createElement('input');
    const obj = { validatorEl };
    const result = getValidatorComponent(obj);
    expect(result).toBe(obj);
  });

  it('should wrap ColorComponent with ValidatorElementWrapper', () => {
    const container = document.createElement('div');
    const comp = new ColorComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBe(comp.colorPickerEl);
  });

  it('should wrap DropdownComponent with ValidatorElementWrapper', () => {
    const container = document.createElement('div');
    const comp = new DropdownComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBe(comp.selectEl);
  });

  it('should wrap SearchComponent with ValidatorElementWrapper', () => {
    const container = document.createElement('div');
    const comp = new SearchComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBe(comp.inputEl);
  });

  it('should wrap SliderComponent with ValidatorElementWrapper', () => {
    const container = document.createElement('div');
    const comp = new SliderComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBe(comp.sliderEl);
  });

  it('should wrap TextAreaComponent with ValidatorElementWrapper', () => {
    const container = document.createElement('div');
    const comp = new TextAreaComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBe(comp.inputEl);
  });

  it('should wrap TextComponent with ValidatorElementWrapper', () => {
    const container = document.createElement('div');
    const comp = new TextComponent(container);
    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBe(comp.inputEl);
  });

  it('should create OverlayValidatorComponent for ProgressBarComponent', () => {
    const parent = document.createElement('div');
    const container = document.createElement('div');
    parent.appendChild(container);
    const comp = new ProgressBarComponent(container);
    // ProgressBarComponent.progressBar needs to be inside parent
    parent.appendChild(comp.progressBar);

    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBeInstanceOf(HTMLInputElement);
  });

  it('should create OverlayValidatorComponent for ToggleComponent', () => {
    const parent = document.createElement('div');
    const container = document.createElement('div');
    parent.appendChild(container);
    const comp = new ToggleComponent(container);
    parent.appendChild(comp.toggleEl);

    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
    assertNonNullable(result);
    expect(result.validatorEl).toBeInstanceOf(HTMLInputElement);
  });

  it('should handle focus on overlay validator element', () => {
    const parent = document.createElement('div');
    const el = document.createElement('div');
    parent.appendChild(el);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    const result = getValidatorComponent(comp);
    assertNonNullable(result);
    const validatorEl = result.validatorEl;
    validatorEl.dispatchEvent(new Event('focus'));
  });

  it('should handle focusin on overlay element', () => {
    const parent = document.createElement('div');
    const el = document.createElement('div');
    parent.appendChild(el);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    getValidatorComponent(comp);
    comp.toggleEl.dispatchEvent(new Event('focusin'));
  });

  it('should handle click on overlay element', () => {
    const parent = document.createElement('div');
    const el = document.createElement('div');
    parent.appendChild(el);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    getValidatorComponent(comp);
    comp.toggleEl.dispatchEvent(new Event('click'));
  });

  it('should handle focusout on overlay element when not focused', async () => {
    vi.useFakeTimers();
    const parent = document.createElement('div');
    const el = document.createElement('div');
    parent.appendChild(el);
    const comp = new ToggleComponent(parent);
    parent.appendChild(comp.toggleEl);

    getValidatorComponent(comp);
    comp.toggleEl.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
  });

  it('should skip blur when element is still active during focusout', () => {
    vi.useFakeTimers();
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const el = document.createElement('div');
    el.tabIndex = 0;
    parent.appendChild(el);
    const comp = new ToggleComponent(parent);
    Object.defineProperty(comp, 'toggleEl', { value: el });

    getValidatorComponent(comp);
    el.focus();
    el.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    document.body.removeChild(parent);
  });

  it('should use element with tabindex if present', () => {
    const parent = document.createElement('div');
    const el = document.createElement('div');
    const tabEl = document.createElement('button');
    tabEl.setAttribute('tabindex', '0');
    el.appendChild(tabEl);
    parent.appendChild(el);
    const comp = new ProgressBarComponent(parent);
    // Override progressBar to be our element with a child that has tabindex
    Object.defineProperty(comp, 'progressBar', { value: el });

    const result = getValidatorComponent(comp);
    expect(result).not.toBeNull();
  });

  it('should set tabIndex on element without tabindex attribute', () => {
    const parent = document.createElement('div');
    const el = document.createElement('div');
    parent.appendChild(el);
    const comp = new ToggleComponent(parent);
    Object.defineProperty(comp, 'toggleEl', { value: el });

    getValidatorComponent(comp);
    expect(el.tabIndex).toBe(-1);
  });
});
