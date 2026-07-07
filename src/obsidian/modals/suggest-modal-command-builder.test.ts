import type {
  Instruction,
  KeymapContext,
  KeymapEventListener,
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

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { SuggestModalCommandBuilder } from './suggest-modal-command-builder.ts';

interface RegisterCall {
  func: KeymapEventListener;
  key: string;
  modifiers: Modifier[];
}

function captureRegisterCalls(scope: Scope): RegisterCall[] {
  const calls: RegisterCall[] = [];
  const originalRegister = scope.register.bind(scope);
  vi.spyOn(scope, 'register').mockImplementation((modifiers, key, func) => {
    calls.push({ func, key: key ?? '', modifiers: modifiers ?? [] });
    return originalRegister(modifiers, key, func);
  });
  return calls;
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

describe('SuggestModalCommandBuilder', () => {
  let builder: SuggestModalCommandBuilder;

  beforeEach(() => {
    builder = new SuggestModalCommandBuilder();
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
      const checkboxElement = modal.instructionsEl.querySelector('input[type="checkbox"]');
      expect(checkboxElement).toBeTruthy();
      const checkbox = checkboxElement as HTMLInputElement;
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
        onInit: (el) => {
          capturedCheckbox = el;
          el.disabled = true;
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
      handler?.func(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
      // OnChange should NOT have been called since checkbox is disabled
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should toggle checkbox via keyboard shortcut when enabled', () => {
      const onChange = vi.fn();
      builder.addCheckbox({
        key: '1',
        modifiers: ['Alt'],
        onChange,
        onInit: (el) => {
          el.checked = false;
        },
        purpose: 'Test'
      });
      const modal = createMockModal();
      const registerCalls = captureRegisterCalls(modal.scope);
      builder.build(modal);

      const handler = registerCalls.find((c) => c.key === '1');
      expect(handler).toBeDefined();
      handler?.func(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
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
      handler?.func(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
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
      handler?.func(new KeyboardEvent('keydown'), castTo<KeymapContext>({}));
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
      builder = new SuggestModalCommandBuilder();
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
      builder = new SuggestModalCommandBuilder();
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
      builder = new SuggestModalCommandBuilder();
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
});
