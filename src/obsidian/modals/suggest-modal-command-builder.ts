/**
 * @file
 *
 * A builder for a {@link SuggestModal}'s instruction bar.
 *
 * {@link SuggestModalCommandBuilder} assembles the instruction bar shown at the bottom of a
 * {@link SuggestModal}: keyboard-command hints ({@link SuggestModalCommandBuilder.addKeyboardCommand}),
 * interactive checkboxes bound to a modifier+key shortcut
 * ({@link SuggestModalCommandBuilder.addCheckbox}), and dropdowns bound to a modifier+key shortcut
 * ({@link SuggestModalCommandBuilder.addDropDown}). Chain the `add*` calls, then apply everything to a
 * modal with {@link SuggestModalCommandBuilder.build}:
 *
 * ```ts
 * new SuggestModalCommandBuilder()
 *   .addKeyboardCommand({ key: 'Enter', modifiers: ['Mod'], onKey, purpose: 'to create' })
 *   .addCheckbox({ key: '1', modifiers: ['Alt'], onChange, onInit, purpose: 'Fix footnotes' })
 *   .build(modal);
 * ```
 *
 * {@link SuggestModalCommandBuilder.build} always registers the essential navigation/action key
 * handlers, but only renders the instruction UI and registers the option-toggle shortcuts when
 * {@link SuggestModalCommandBuilderBuildOptions.shouldShowInstructions} is `true` (the default).
 */

import type {
  Instruction,
  KeymapContext,
  Modifier,
  Scope,
  SuggestModal
} from 'obsidian';

import {
  DropdownComponent,
  Platform
} from 'obsidian';

const KEYS_MAP = new Map<string, string>([
  ['Enter', '↵'],
  ['UpDown', '↑↓']
]);

/**
 * A checkbox command shown in a {@link SuggestModal}'s instruction bar and bound to a modifier+key
 * shortcut that toggles it.
 */
export interface CheckboxCommand {
  /**
   * The key that toggles the checkbox.
   */
  key: string;

  /**
   * The modifiers combined with {@link CheckboxCommand.key} to toggle the checkbox. When omitted, no
   * modifiers are required.
   */
  modifiers?: Modifier[];

  /**
   * Called when the checkbox value changes.
   *
   * @param value - The new checked state.
   */
  onChange(value: boolean): void;

  /**
   * Called once with the created checkbox element, to initialize its state.
   *
   * @param checkboxEl - The created checkbox element.
   */
  onInit(checkboxEl: HTMLInputElement): void;

  /**
   * The human-readable description shown next to the checkbox in the instruction bar.
   */
  purpose: string;
}

/**
 * A dropdown command shown in a {@link SuggestModal}'s instruction bar and bound to a modifier+key
 * shortcut that cycles through its options.
 */
export interface DropDownCommand {
  /**
   * The key that cycles the dropdown to its next option.
   */
  key: string;

  /**
   * The modifiers combined with {@link DropDownCommand.key} to cycle the dropdown. When omitted, no
   * modifiers are required.
   */
  modifiers?: Modifier[];

  /**
   * Called when the dropdown value changes.
   *
   * @param value - The newly selected value.
   */
  onChange(value: string): void;

  /**
   * Called once with the created dropdown component, to initialize its options and state.
   *
   * @param dropdownComponent - The created dropdown component.
   */
  onInit(dropdownComponent: DropdownComponent): void;

  /**
   * The human-readable description shown next to the dropdown in the instruction bar.
   */
  purpose: string;
}

/**
 * A keyboard command shown in a {@link SuggestModal}'s instruction bar and optionally bound to a
 * modifier+key handler.
 */
export interface KeyboardCommand {
  /**
   * The key shown in the instruction bar (and registered with the modal scope when
   * {@link KeyboardCommand.onKey} is provided).
   */
  key: string;

  /**
   * The modifiers combined with {@link KeyboardCommand.key}. When omitted, no modifiers are required.
   */
  modifiers?: Modifier[];

  /**
   * The handler invoked when the shortcut is pressed. When omitted, the command is a hint only and no
   * scope handler is registered.
   *
   * @param evt - The keyboard event.
   * @param ctx - The keymap context.
   * @returns `false` to prevent Obsidian's default handling, or `void`/`true` otherwise.
   */
  onKey?(evt: KeyboardEvent, ctx: KeymapContext): boolean;

  /**
   * The human-readable description shown next to the key in the instruction bar.
   */
  purpose: string;
}

/**
 * Options for {@link SuggestModalCommandBuilder.build}.
 */
export interface SuggestModalCommandBuilderBuildOptions {
  /**
   * Whether to render the instruction bar (checkboxes, dropdowns, keyboard hints) and register the
   * option-toggle keyboard shortcuts. When `false`, no instruction UI is shown and the option-toggle
   * shortcuts are not registered; only the essential navigation key handlers remain active.
   *
   * @default `true`
   */
  readonly shouldShowInstructions?: boolean;
}

interface InstructionEx extends Instruction {
  init?(purposeEl: HTMLSpanElement, scope: Scope): void;
  registerScope?(scope: Scope): void;
}

/**
 * Builds a {@link SuggestModal}'s instruction bar from keyboard commands, interactive checkboxes, and
 * dropdowns, then applies them to a modal via {@link SuggestModalCommandBuilder.build}.
 */
export class SuggestModalCommandBuilder {
  private readonly instructions: InstructionEx[] = [];

  /**
   * Adds an interactive checkbox to the instruction bar, bound to a modifier+key shortcut that toggles
   * it.
   *
   * @param command - The checkbox command to add.
   * @returns The builder instance for chaining.
   */
  public addCheckbox(command: CheckboxCommand): this {
    this.instructions.push({
      command: this.buildCommand(command),
      init: (purposeEl, scope) => {
        const checkboxEl = purposeEl.createEl('input', { type: 'checkbox' });
        command.onInit(checkboxEl);
        checkboxEl.addEventListener('change', () => {
          command.onChange(checkboxEl.checked);
        });

        scope.register(command.modifiers ?? [], command.key, () => {
          if (checkboxEl.disabled) {
            return;
          }
          checkboxEl.checked = !checkboxEl.checked;
          checkboxEl.trigger('change');
        });
      },
      purpose: command.purpose
    });
    return this;
  }

  /**
   * Adds a dropdown to the instruction bar, bound to a modifier+key shortcut that cycles through its
   * options.
   *
   * @param command - The dropdown command to add.
   * @returns The builder instance for chaining.
   */
  public addDropDown(command: DropDownCommand): this {
    this.instructions.push({
      command: this.buildCommand(command),
      init: (purposeEl, scope) => {
        purposeEl.appendText(' ');
        const dropdownComponent = new DropdownComponent(purposeEl);
        command.onInit(dropdownComponent);
        dropdownComponent.onChange((value) => {
          command.onChange(value);
        });

        /* v8 ignore start -- defensive ?? on optional modifiers. */
        scope.register(command.modifiers ?? [], command.key, () => {
          /* v8 ignore stop */
          if (dropdownComponent.disabled) {
            return;
          }
          const selectEl = dropdownComponent.selectEl;
          selectEl.selectedIndex = (selectEl.selectedIndex + 1) % selectEl.options.length;
          selectEl.trigger('change');
        });
      },
      purpose: command.purpose
    });
    return this;
  }

  /**
   * Adds a keyboard command to the instruction bar. When {@link KeyboardCommand.onKey} is provided, its
   * handler is registered with the modal scope; otherwise the command is a hint only.
   *
   * @param command - The keyboard command to add.
   * @returns The builder instance for chaining.
   */
  public addKeyboardCommand(command: KeyboardCommand): this {
    this.instructions.push({
      command: this.buildCommand(command),
      purpose: command.purpose,
      registerScope: (scope) => {
        if (command.onKey) {
          /* v8 ignore start -- defensive ?? on optional modifiers. */
          scope.register(command.modifiers ?? [], command.key, command.onKey.bind(command));
          /* v8 ignore stop */
        }
      }
    });
    return this;
  }

  /**
   * Applies the accumulated commands to a modal. Always registers the essential navigation/action key
   * handlers; only renders the instruction UI and registers the option-toggle shortcuts when
   * {@link SuggestModalCommandBuilderBuildOptions.shouldShowInstructions} is `true`.
   *
   * @param modal - The modal to apply the commands to.
   * @param options - The build options.
   */
  public build(modal: SuggestModal<unknown>, options: SuggestModalCommandBuilderBuildOptions = {}): void {
    const { shouldShowInstructions = true } = options;

    // Essential navigation/action key handlers must stay active even when the instruction bar is hidden.
    for (const instruction of this.instructions) {
      instruction.registerScope?.(modal.scope);
    }

    if (!shouldShowInstructions) {
      return;
    }

    modal.setInstructions(this.instructions);
    const purposeEls = Array.from(modal.instructionsEl.findAll('.prompt-instruction > span:nth-child(2)')) as HTMLSpanElement[];
    for (let i = 0; i < purposeEls.length; i++) {
      const purposeEl = purposeEls[i];
      /* v8 ignore start -- purposeEls[i] is always defined within loop bounds. */
      if (!purposeEl) {
        continue;
      }
      /* v8 ignore stop */

      this.instructions[i]?.init?.(purposeEl, modal.scope);
    }
  }

  private buildCommand(entry: KeyboardCommand): string {
    let command = KEYS_MAP.get(entry.key) ?? entry.key;

    for (const modifier of entry.modifiers ?? []) {
      command = `${this.getModifierString(modifier)} ${command}`;
    }

    return command;
  }

  private getModifierString(modifier: Modifier): string {
    switch (modifier) {
      case 'Alt':
        return 'alt';
      case 'Ctrl':
        return 'ctrl';
      case 'Meta':
        return Platform.isMacOS ? 'cmd' : 'win';
      case 'Mod':
        return Platform.isMacOS ? 'cmd' : 'ctrl';
      case 'Shift':
        return 'shift';
      default:
        return modifier;
    }
  }
}
