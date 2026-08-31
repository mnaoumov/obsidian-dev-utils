import type {
  Instruction,
  KeymapContext,
  KeymapEventListener,
  Modal,
  Modifier,
  SuggestModal
} from 'obsidian';

import {
  DropdownComponent,
  Platform,
  Scope
} from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ModalCommandsHost } from './modal-command-builder.ts';

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { CssClass } from '../css-class.ts';
import {
  ModalCommandBuilder,
  ModalCommandsRenderMode
} from './modal-command-builder.ts';

interface RegisterCall {
  $function: KeymapEventListener;
  key: string;
  modifiers: Modifier[];
}

function captureRegisterCalls(scope: Scope): RegisterCall[] {
  const calls: RegisterCall[] = [];
  const originalRegister = scope.register.bind(scope);
  vi.spyOn(scope, 'register').mockImplementation((modifiers, key, $function) => {
    calls.push({ $function, key: key ?? '', modifiers: modifiers ?? [] });
    return originalRegister(modifiers, key, $function);
  });
  return calls;
}

function commandButtons(host: ModalCommandsHost): HTMLButtonElement[] {
  return [...host.containerEl.querySelectorAll(`.${CssClass.ModalCommand}`)].filter((el) => el.instanceOf(HTMLButtonElement));
}

function createMockHost(): ModalCommandsHost {
  return {
    containerEl: createDiv(),
    scope: new Scope()
  };
}

function createMockModal(): SuggestModal<unknown> {
  const instructionsEl = createDiv();
  const scope = new Scope();
  return strictProxy<SuggestModal<unknown>>({
    instructionsEl,
    scope,
    setInstructions: vi.fn((instructions: Instruction[]) => {
      instructionsEl.empty();
      for (const instruction of instructions) {
        const promptInstruction = instructionsEl.createDiv('prompt-instruction');
        promptInstruction.createSpan({ text: instruction.command });
        promptInstruction.createSpan({ text: instruction.purpose });
      }
    })
  });
}

/**
 * A plain `Modal`, which has NEITHER `setInstructions` nor `instructionsEl`.
 *
 * `modalEl` and `containerEl` are distinct elements on purpose: a real `Modal`'s `containerEl` is the outer
 * `.modal-container`, so a strip appended there would land outside the modal frame.
 *
 * @returns The mock modal.
 */
function createMockPlainModal(): Modal {
  const containerEl = createDiv();
  return strictProxy<Modal>({
    containerEl,
    modalEl: containerEl.createDiv(),
    scope: new Scope()
  });
}

describe('ModalCommandBuilder', () => {
  let builder: ModalCommandBuilder;

  beforeEach(() => {
    builder = new ModalCommandBuilder();
  });

  describe('addKeyboardCommand', () => {
    it('should add a keyboard command instruction', () => {
      builder.addKeyboardCommand({ key: 'Enter', purpose: 'to confirm' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: '↵', purpose: 'to confirm' })
        ])
      );
    });

    it('should map UpDown key', () => {
      builder.addKeyboardCommand({ key: 'UpDown', purpose: 'to navigate' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: '↑↓' })
        ])
      );
    });

    it('should pass through unmapped keys', () => {
      builder.addKeyboardCommand({ key: 'Escape', purpose: 'to dismiss' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'Escape' })
        ])
      );
    });

    it('should register onKey callback with scope when onKey is provided', () => {
      const onKey = vi.fn();
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Mod'], onKey, purpose: 'to create' });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal);
      const call = registerCalls.find((c) => c.key === 'Enter' && c.modifiers.includes('Mod'));
      expect(call).toBeDefined();
    });

    it('should not register scope handler when no onKey is provided', () => {
      builder.addKeyboardCommand({ key: 'UpDown', purpose: 'to navigate' });
      const modal = createMockModal();
      builder.build(modal);
      // No onKey means no scope.register call for this command
      expect(modal.setInstructions).toHaveBeenCalled();
    });

    it('should return this for chaining', () => {
      const result = builder.addKeyboardCommand({ key: 'Enter', purpose: 'test' });
      expect(result).toBe(builder);
    });
  });

  describe('addCheckbox', () => {
    it('should add a checkbox instruction', () => {
      const onChange = vi.fn();
      const onInit = vi.fn();
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange, onInit, purpose: 'Fix footnotes' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'alt 1', purpose: 'Fix footnotes' })
        ])
      );
    });

    it('should create checkbox element and call onInit', () => {
      const onInit = vi.fn();
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange: vi.fn(), onInit, purpose: 'Test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(onInit).toHaveBeenCalled();
    });

    it('should call onChange when checkbox changes', () => {
      const onChange = vi.fn();
      builder.addCheckbox({
        key: '1',
        modifiers: ['Alt'],
        onChange,
        onInit: vi.fn(),
        purpose: 'Test'
      });
      const modal = createMockModal();
      builder.build(modal);
      // Find the checkbox in the modal's instructionsEl
      const checkboxEl = modal.instructionsEl.querySelector('input[type="checkbox"]');
      expect(checkboxEl).toBeTruthy();
      const checkbox = checkboxEl as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should register keyboard shortcut for checkbox', () => {
      const onChange = vi.fn();
      builder.addCheckbox({
        key: '1',
        modifiers: ['Alt'],
        onChange,
        onInit: vi.fn(),
        purpose: 'Test'
      });
      const modal = createMockModal();
      builder.build(modal);
      // Verify instruction was added
      expect(modal.setInstructions).toHaveBeenCalled();
    });

    it('should not toggle checkbox via keyboard when disabled', () => {
      const onChange = vi.fn();
      let capturedCheckbox: HTMLInputElement | undefined;
      builder.addCheckbox({
        key: '1',
        onChange,
        onInit: (element) => {
          capturedCheckbox = element;
          element.disabled = true;
        },
        purpose: 'Test'
      });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal);
      // The checkbox should be disabled and the keyboard handler should return early
      expect(capturedCheckbox?.disabled).toBe(true);

      // Trigger the keyboard handler - it should not toggle
      const handler = registerCalls.find((c) => c.key === '1');
      expect(handler).toBeDefined();
      handler?.$function(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      // OnChange should NOT have been called since checkbox is disabled
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should toggle checkbox via keyboard shortcut when enabled', () => {
      const onChange = vi.fn();
      builder.addCheckbox({
        key: '1',
        modifiers: ['Alt'],
        onChange,
        onInit: (element) => {
          element.checked = false;
        },
        purpose: 'Test'
      });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal);

      const handler = registerCalls.find((c) => c.key === '1');
      expect(handler).toBeDefined();
      handler?.$function(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should return this for chaining', () => {
      const result = builder.addCheckbox({ key: '1', onChange: vi.fn(), onInit: vi.fn(), purpose: 'Test' });
      expect(result).toBe(builder);
    });
  });

  describe('addDropDown', () => {
    it('should add a dropdown instruction', () => {
      builder.addDropDown({
        key: '5',
        modifiers: ['Alt'],
        onChange: vi.fn(),
        onInit: vi.fn(),
        purpose: 'Strategy'
      });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'alt 5', purpose: 'Strategy' })
        ])
      );
    });

    it('should call onInit with DropdownComponent', () => {
      const onInit = vi.fn();
      builder.addDropDown({
        key: '5',
        modifiers: ['Alt'],
        onChange: vi.fn(),
        onInit,
        purpose: 'Strategy'
      });
      const modal = createMockModal();
      builder.build(modal);
      expect(onInit).toHaveBeenCalledWith(expect.any(DropdownComponent));
    });

    it('should call onChange when dropdown value changes via setValue', () => {
      const onChange = vi.fn();
      let capturedDropdown: DropdownComponent | undefined;
      builder.addDropDown({
        key: '5',
        modifiers: ['Alt'],
        onChange,
        onInit: (dropdownComponent) => {
          dropdownComponent.addOptions({ a: 'A', b: 'B', c: 'C' });
          capturedDropdown = dropdownComponent;
        },
        purpose: 'Strategy'
      });
      const modal = createMockModal();
      builder.build(modal);

      // Trigger change via setValue which invokes the onChange callback
      expect(capturedDropdown).toBeDefined();
      capturedDropdown?.setValue('b');
      expect(onChange).toHaveBeenCalledWith('b');
    });

    it('should execute keyboard handler for dropdown cycling', () => {
      const onChange = vi.fn();
      builder.addDropDown({
        key: '5',
        modifiers: ['Alt'],
        onChange,
        onInit: (dropdownComponent) => {
          dropdownComponent.addOptions({ a: 'A', b: 'B' });
        },
        purpose: 'Strategy'
      });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal);

      const handler = registerCalls.find((c) => c.key === '5');
      expect(handler).toBeDefined();
      // This executes the handler code even though `selectEl.trigger('change')` won't call
      // DropdownComponent's internal callback
      handler?.$function(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      expect(handler).toBeDefined();
    });

    it('should not cycle dropdown when disabled', () => {
      builder.addDropDown({
        key: '5',
        modifiers: ['Alt'],
        onChange: vi.fn(),
        onInit: (dropdownComponent) => {
          dropdownComponent.addOptions({ a: 'A', b: 'B' });
          dropdownComponent.setDisabled(true);
        },
        purpose: 'Strategy'
      });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal);

      const handler = registerCalls.find((c) => c.key === '5');
      expect(handler).toBeDefined();
      // This should return early due to disabled check
      handler?.$function(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      // The handler returned early, select index was not changed
      const selectEl = modal.instructionsEl.querySelector('select');
      expect(selectEl?.selectedIndex).toBe(0);
    });

    it('should return this for chaining', () => {
      const result = builder.addDropDown({
        key: '5',
        onChange: vi.fn(),
        onInit: vi.fn(),
        purpose: 'Strategy'
      });
      expect(result).toBe(builder);
    });
  });

  describe('build', () => {
    it('should skip missing purposeEls gracefully', () => {
      builder.addKeyboardCommand({ key: 'Enter', purpose: 'test' });
      const modal = strictProxy<SuggestModal<unknown>>({
        instructionsEl: createDiv(),
        scope: new Scope(),
        setInstructions: vi.fn()
      });
      // InstructionsEl is empty so no purpose els found — should not throw
      expect(() => {
        builder.build(modal);
      }).not.toThrow();
    });

    it('should show instructions by default', () => {
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange: vi.fn(), onInit: vi.fn(), purpose: 'Test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalled();
      expect(modal.instructionsEl.querySelector('input[type="checkbox"]')).toBeTruthy();
    });

    it('should not render the instruction bar when shouldShowInstructions is false', () => {
      const onInit = vi.fn();
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange: vi.fn(), onInit, purpose: 'Test' });
      const modal = createMockModal();
      builder.build(modal, { shouldShowInstructions: false });
      expect(modal.setInstructions).not.toHaveBeenCalled();
      expect(onInit).not.toHaveBeenCalled();
      expect(modal.instructionsEl.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('should still register essential keyboard handlers when shouldShowInstructions is false', () => {
      const onKey = vi.fn();
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Mod'], onKey, purpose: 'to create' });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal, { shouldShowInstructions: false });
      const call = registerCalls.find((c) => c.key === 'Enter' && c.modifiers.includes('Mod'));
      expect(call).toBeDefined();
    });

    it('should not register option-toggle shortcuts when shouldShowInstructions is false', () => {
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange: vi.fn(), onInit: vi.fn(), purpose: 'Test' });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal, { shouldShowInstructions: false });
      const call = registerCalls.find((c) => c.key === '1');
      expect(call).toBeUndefined();
    });
  });

  describe('getModifierString', () => {
    it('should handle Alt modifier', () => {
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Alt'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'alt ↵' })
        ])
      );
    });

    it('should handle Ctrl modifier', () => {
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Ctrl'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'ctrl ↵' })
        ])
      );
    });

    it('should handle Meta modifier on macOS', () => {
      vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(true);
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Meta'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'cmd ↵' })
        ])
      );
    });

    it('should handle Meta modifier on non-macOS', () => {
      vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
      builder = new ModalCommandBuilder();
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Meta'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'win ↵' })
        ])
      );
    });

    it('should handle Mod modifier on macOS', () => {
      vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(true);
      builder = new ModalCommandBuilder();
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Mod'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'cmd ↵' })
        ])
      );
    });

    it('should handle Mod modifier on non-macOS', () => {
      vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
      builder = new ModalCommandBuilder();
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Mod'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'ctrl ↵' })
        ])
      );
    });

    it('should handle Shift modifier', () => {
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Shift'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'shift ↵' })
        ])
      );
    });

    it('should handle unknown modifier', () => {
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['unknown' as Modifier], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'unknown ↵' })
        ])
      );
    });

    it('should handle multiple modifiers', () => {
      builder.addKeyboardCommand({ key: 'Enter', modifiers: ['Ctrl', 'Shift'], purpose: 'test' });
      const modal = createMockModal();
      builder.build(modal);
      expect(modal.setInstructions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'shift ctrl ↵' })
        ])
      );
    });
  });

  describe('plain-Modal and bare-host targets', () => {
    it('should render its own instruction bar into a plain modal', () => {
      builder.addKeyboardCommand({ key: 'Enter', purpose: 'to confirm' });
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange: vi.fn(), onInit: vi.fn(), purpose: 'Fix footnotes' });
      const modal = createMockPlainModal();
      builder.build(modal);

      const instructionsEl = modal.modalEl.querySelector(`.${CssClass.PromptInstructions}`);
      expect(instructionsEl).toBeTruthy();
      expect(instructionsEl?.querySelectorAll(`.${CssClass.PromptInstruction}`)).toHaveLength(2);
      expect(instructionsEl?.querySelector('input[type="checkbox"]')).toBeTruthy();
      expect([...instructionsEl?.querySelectorAll(`.${CssClass.PromptInstruction} > span:first-child`) ?? []].map((el) => el.textContent))
        .toEqual(['↵', 'alt 1']);
    });

    it('should render its own instruction bar into a bare host', () => {
      builder.addCheckbox({ key: '1', onChange: vi.fn(), onInit: vi.fn(), purpose: 'Test' });
      const host = createMockHost();
      builder.build(host);
      expect(host.containerEl.querySelector('input[type="checkbox"]')).toBeTruthy();
    });

    it('should toggle a self-rendered checkbox via its shortcut', () => {
      const onChange = vi.fn();
      builder.addCheckbox({ key: '1', modifiers: ['Alt'], onChange, onInit: vi.fn(), purpose: 'Test' });
      const host = createMockHost();
      const registerCalls = captureRegisterCalls(host.scope);
      builder.build(host);

      const handler = registerCalls.find((c) => c.key === '1');
      handler?.$function(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('buttons render mode', () => {
    beforeEach(() => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
    });

    it('should render one button per pointer-reachable command', () => {
      builder.addKeyboardCommand({ key: 'UpDown', purpose: 'to navigate' });
      builder.addKeyboardCommand({ key: 'Enter', onKey: vi.fn(), purpose: 'to confirm' });
      builder.addKeyboardCommand({ key: '1', modifiers: ['Alt'], onActivate: vi.fn(), purpose: 'No link' });
      builder.addCheckbox({ key: '2', modifiers: ['Alt'], onChange: vi.fn(), onInit: vi.fn(), purpose: 'All files' });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });

      // The hint-only and keyboard-only commands render nothing; both activatable ones do.
      expect(commandButtons(host).map((buttonEl) => buttonEl.querySelector('span')?.textContent)).toEqual(['No link', 'All files']);
    });

    it('should show the hotkey hint on desktop', () => {
      builder.addKeyboardCommand({ key: '1', modifiers: ['Alt'], onActivate: vi.fn(), purpose: 'No link' });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      expect(commandButtons(host)[0]?.querySelector(`.${CssClass.ModalCommandHotkey}`)?.textContent).toBe('alt 1');
    });

    it('should suppress the hotkey hint on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      builder.addKeyboardCommand({ key: '1', modifiers: ['Alt'], onActivate: vi.fn(), purpose: 'No link' });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      expect(commandButtons(host)[0]?.querySelector(`.${CssClass.ModalCommandHotkey}`)).toBeNull();
    });

    it('should run onActivate when the button is clicked', () => {
      const onActivate = vi.fn();
      builder.addKeyboardCommand({ key: '1', modifiers: ['Alt'], onActivate, purpose: 'No link' });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      commandButtons(host)[0]?.click();
      expect(onActivate).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it('should disable rather than remove an unavailable command', () => {
      const onActivate = vi.fn();
      builder.addKeyboardCommand({
        checkIsAvailable: () => false,
        key: '1',
        modifiers: ['Alt'],
        onActivate,
        purpose: 'No link'
      });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      const buttonEl = commandButtons(host)[0];
      // Still rendered — a strip that lost buttons as modes change would reflow under the pointer. A
      // Disabled button fires no click, so `disabled` IS the whole gate on `onActivate`.
      expect(buttonEl).toBeDefined();
      expect(buttonEl?.disabled).toBe(true);
      buttonEl?.click();
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('should hold input focus by preventing the mousedown default', () => {
      builder.addKeyboardCommand({ key: '1', onActivate: vi.fn(), purpose: 'No link' });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      const $event = new MouseEvent('mousedown', { cancelable: true });
      commandButtons(host)[0]?.dispatchEvent($event);
      expect($event.defaultPrevented).toBe(true);
    });

    it('should toggle a checkbox command by clicking its button', () => {
      const onChange = vi.fn();
      builder.addCheckbox({ key: '2', modifiers: ['Alt'], onChange, onInit: vi.fn(), purpose: 'All files' });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      commandButtons(host)[0]?.click();
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should not toggle an unavailable checkbox command, by shortcut or by button', () => {
      const onChange = vi.fn();
      builder.addCheckbox({
        checkIsAvailable: () => false,
        key: '2',
        onChange,
        onInit: vi.fn(),
        purpose: 'All files'
      });
      const host = createMockHost();
      const registerCalls = captureRegisterCalls(host.scope);
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });

      commandButtons(host)[0]?.click();
      // The shortcut route needs its own guard: unlike the button, a `Scope` handler fires regardless.
      registerCalls.find((c) => c.key === '2')?.$function(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should reflect a checkbox command pressed state on its button', () => {
      builder.addCheckbox({
        key: '2',
        onChange: vi.fn(),
        onInit: (checkboxEl) => {
          checkboxEl.checked = true;
        },
        purpose: 'All files'
      });
      const host = createMockHost();
      builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      const buttonEl = commandButtons(host)[0];
      expect(buttonEl?.getAttribute('aria-pressed')).toBe('true');
      expect(buttonEl?.hasClass(CssClass.IsActive)).toBe(true);
    });

    it('should throw when a dropdown is rendered as a button', () => {
      builder.addDropDown({ key: '5', onChange: vi.fn(), onInit: vi.fn(), purpose: 'Strategy' });
      const host = createMockHost();
      expect(() => {
        builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      }).toThrow('Cannot render dropdown command "Strategy" as a button');
    });
  });

  describe('refresh', () => {
    it('should re-read checkIsOn and checkIsAvailable', () => {
      let isOn = false;
      let isAvailable = true;
      builder.addKeyboardCommand({
        checkIsAvailable: () => isAvailable,
        checkIsOn: () => isOn,
        key: '1',
        onActivate: vi.fn(),
        purpose: 'By date'
      });
      const host = createMockHost();
      const modalCommands = builder.build(host, { renderMode: ModalCommandsRenderMode.Buttons });
      const buttonEl = commandButtons(host)[0];
      expect(buttonEl?.getAttribute('aria-pressed')).toBe('false');
      expect(buttonEl?.disabled).toBe(false);

      isOn = true;
      isAvailable = false;
      modalCommands.refresh();
      expect(buttonEl?.getAttribute('aria-pressed')).toBe('true');
      expect(buttonEl?.disabled).toBe(true);
    });

    it('should disable an unavailable instruction-bar checkbox', () => {
      let isAvailable = true;
      builder.addCheckbox({
        checkIsAvailable: () => isAvailable,
        key: '1',
        onChange: vi.fn(),
        onInit: vi.fn(),
        purpose: 'Test'
      });
      const modal = createMockModal();
      const modalCommands = builder.build(modal);
      const checkboxEl = ensureNonNullable(modal.instructionsEl.querySelector<HTMLInputElement>('input[type="checkbox"]'));
      expect(checkboxEl.disabled).toBe(false);

      isAvailable = false;
      modalCommands.refresh();
      expect(checkboxEl.disabled).toBe(true);
    });

    it('should disable an unavailable instruction-bar dropdown', () => {
      let isAvailable = true;
      let capturedDropdown: DropdownComponent | undefined;
      builder.addDropDown({
        checkIsAvailable: () => isAvailable,
        key: '5',
        onChange: vi.fn(),
        onInit: (dropdownComponent) => {
          dropdownComponent.addOptions({ a: 'A', b: 'B' });
          capturedDropdown = dropdownComponent;
        },
        purpose: 'Strategy'
      });
      const modal = createMockModal();
      const modalCommands = builder.build(modal);
      expect(capturedDropdown?.disabled).toBe(false);

      isAvailable = false;
      modalCommands.refresh();
      expect(capturedDropdown?.disabled).toBe(true);
    });

    it('should leave the disabled state alone when no checkIsAvailable is supplied', () => {
      builder.addCheckbox({
        key: '1',
        onChange: vi.fn(),
        onInit: (checkboxEl) => {
          checkboxEl.disabled = true;
        },
        purpose: 'Test'
      });
      const modal = createMockModal();
      const modalCommands = builder.build(modal);
      const checkboxEl = ensureNonNullable(modal.instructionsEl.querySelector<HTMLInputElement>('input[type="checkbox"]'));
      expect(checkboxEl.disabled).toBe(true);
      modalCommands.refresh();
      expect(checkboxEl.disabled).toBe(true);
    });

    it('should be a no-op when nothing was rendered', () => {
      builder.addCheckbox({ key: '1', onChange: vi.fn(), onInit: vi.fn(), purpose: 'Test' });
      const modal = createMockModal();
      const modalCommands = builder.build(modal, { shouldShowInstructions: false });
      expect(() => {
        modalCommands.refresh();
      }).not.toThrow();
    });
  });
});
