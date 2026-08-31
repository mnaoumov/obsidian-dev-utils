/**
 * @file
 *
 * A builder for a modal's control strip.
 *
 * {@link ModalCommandBuilder} assembles the strip of controls shown at the bottom of a modal:
 * keyboard-command hints ({@link ModalCommandBuilder.addKeyboardCommand}), interactive checkboxes bound to
 * a modifier+key shortcut ({@link ModalCommandBuilder.addCheckbox}), and dropdowns bound to a modifier+key
 * shortcut ({@link ModalCommandBuilder.addDropDown}). Chain the `add*` calls, then apply everything to a
 * modal with {@link ModalCommandBuilder.build}:
 *
 * ```ts
 * new ModalCommandBuilder()
 *   .addKeyboardCommand({ key: 'Enter', modifiers: ['Mod'], onKey, purpose: 'to create' })
 *   .addCheckbox({ key: '1', modifiers: ['Alt'], onChange, onInit, purpose: 'Fix footnotes' })
 *   .build(modal);
 * ```
 *
 * The strip is described by two independent axes:
 *
 * - **Where it is hosted.** A {@link SuggestModal} in {@link ModalCommandsRenderMode.Instructions} mode
 *   keeps Obsidian's own instruction bar (`setInstructions` + `instructionsEl`). Every other target — a
 *   plain {@link Modal}, or a bare {@link ModalCommandsHost} of an element plus a `Scope` — gets a strip
 *   element the builder creates itself.
 * - **How each control looks.** {@link ModalCommandsRenderMode.Instructions} renders the purpose text with
 *   an inline checkbox or dropdown; {@link ModalCommandsRenderMode.Buttons} renders one clickable button
 *   per control, carrying its pressed and disabled state.
 *
 * The axes are independent because a button strip inside a {@link SuggestModal} is a real combination.
 *
 * {@link ModalCommandBuilder.build} always registers the essential navigation/action key handlers, but
 * only renders the control UI and registers the option-toggle shortcuts when
 * {@link ModalCommandBuilderBuildOptions.shouldShowInstructions} is `true` (the default).
 */

import type {
  Instruction,
  KeymapContext,
  Modal,
  Modifier,
  Scope,
  SuggestModal
} from 'obsidian';

import {
  DropdownComponent,
  Platform
} from 'obsidian';

import { CssClass } from '../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

const KEYS_MAP = new Map<string, string>([
  ['Enter', '↵'],
  ['UpDown', '↑↓']
]);

/**
 * The way {@link ModalCommandBuilder.build} renders each control.
 */
export enum ModalCommandsRenderMode {
  /**
   * One clickable button per control, carrying its pressed (`aria-pressed`) and disabled state.
   *
   * Only controls reachable by pointer are rendered — checkboxes, and keyboard commands that supply
   * {@link KeyboardCommand.onActivate}. A hint-only or keyboard-only command still registers its handler
   * but renders no button, because a button nobody can press is worse than no button. A dropdown throws:
   * a control that CYCLES has no button form.
   */
  Buttons = 'buttons',

  /**
   * Obsidian's instruction-bar look: the shortcut, then the purpose text with an inline checkbox or
   * dropdown.
   */
  Instructions = 'instructions'
}

/**
 * A checkbox command shown in a modal's control strip and bound to a modifier+key shortcut that toggles
 * it.
 */
export interface CheckboxCommand extends CommandBase {
  /**
   * Called when the checkbox value changes.
   *
   * @param isChecked - The new checked state.
   */
  onChange(isChecked: boolean): void;

  /**
   * Called once with the created checkbox element, to initialize its state.
   *
   * In {@link ModalCommandsRenderMode.Buttons} mode the element is created but never appended — the
   * button is a view of it — so the same initialization code serves both render modes.
   *
   * @param checkboxEl - The created checkbox element.
   */
  onInit(checkboxEl: HTMLInputElement): void;
}

/**
 * The members every command shares.
 */
export interface CommandBase {
  /**
   * Whether the control can be used right now. When it returns `false` the control is rendered
   * **disabled rather than removed**, so the strip does not reflow under the pointer as modes change —
   * which on a phone means a mis-tap.
   *
   * Re-read by {@link ModalCommands.refresh}. When omitted, the builder never touches the control's
   * disabled state, leaving whatever {@link CheckboxCommand.onInit} / {@link DropDownCommand.onInit} set.
   *
   * @returns Whether the control can be used right now.
   */
  checkIsAvailable?(this: void): boolean;

  /**
   * The key that activates the command.
   */
  key: string;

  /**
   * The modifiers combined with {@link CommandBase.key}. When omitted, no modifiers are required.
   */
  modifiers?: Modifier[];

  /**
   * The human-readable description shown next to the control.
   */
  purpose: string;
}

/**
 * A dropdown command shown in a modal's control strip and bound to a modifier+key shortcut that cycles
 * through its options.
 *
 * Supported in {@link ModalCommandsRenderMode.Instructions} mode only.
 */
export interface DropDownCommand extends CommandBase {
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
}

/**
 * A keyboard command shown in a modal's control strip and optionally bound to a modifier+key handler.
 */
export interface KeyboardCommand extends CommandBase {
  /**
   * Whether the command reads as ON. Supply it for a toggle whose state lives outside the strip; omit it
   * for an action, which does something and is done. A {@link CheckboxCommand} needs no equivalent — its
   * checkbox element is the state.
   *
   * Re-read by {@link ModalCommands.refresh}.
   *
   * @returns Whether the command reads as ON.
   */
  checkIsOn?(this: void): boolean;

  /**
   * The pointer route into the same handler the shortcut runs. Required for the command to render a
   * button in {@link ModalCommandsRenderMode.Buttons} mode — on a phone there is no modifier key to
   * press, so this is the only way in.
   *
   * @param $event - The click event, so a command that picks something has one to hand on.
   */
  onActivate?(this: void, $event: MouseEvent): void;

  /**
   * The handler invoked when the shortcut is pressed. When omitted, the command is a hint only and no
   * scope handler is registered.
   *
   * @param $event - The keyboard event.
   * @param context - The keymap context.
   * @returns `false` to prevent Obsidian's default handling, or `void`/`true` otherwise.
   */
  onKey?($event: KeyboardEvent, context: KeymapContext): boolean;
}

/**
 * Options for {@link ModalCommandBuilder.build}.
 */
export interface ModalCommandBuilderBuildOptions {
  /**
   * The way each control is rendered.
   *
   * @default {@link ModalCommandsRenderMode.Instructions}
   */
  readonly renderMode?: ModalCommandsRenderMode;

  /**
   * Whether to render the control strip (checkboxes, dropdowns, keyboard hints) and register the
   * option-toggle keyboard shortcuts. When `false`, no control UI is shown and the option-toggle
   * shortcuts are not registered; only the essential navigation key handlers remain active.
   *
   * @default `true`
   */
  readonly shouldShowInstructions?: boolean;
}

/**
 * The handle returned by {@link ModalCommandBuilder.build}.
 */
export interface ModalCommands {
  /**
   * Brings every rendered control's disabled and pressed state up to date, by re-reading
   * {@link CommandBase.checkIsAvailable} and {@link KeyboardCommand.checkIsOn}.
   *
   * The strip is built once and only re-stated afterwards, because rebuilding it would replace an element
   * the pointer may be about to click.
   */
  refresh(): void;
}

/**
 * A bare host for a control strip: the element to render into, plus the scope to register shortcuts with.
 */
export interface ModalCommandsHost {
  /**
   * The element the control strip is appended to.
   */
  readonly containerEl: HTMLElement;

  /**
   * The scope the shortcuts are registered with.
   */
  readonly scope: Scope;
}

/**
 * Every target {@link ModalCommandBuilder.build} accepts.
 */
export type ModalCommandsTarget = Modal | ModalCommandsHost | SuggestModal<unknown>;

/**
 * One accumulated command, reduced to the handful of things both renderers need.
 *
 * Optional collaborators are `null | X` required fields rather than `?`, so every construction site has to
 * say which ones it has.
 */
/**
 * One control rendered as a BUTTON.
 *
 * It reports its own pressed state, because only the button renderer has anywhere to show one.
 */
interface ButtonControl {
  checkIsOn(this: void): boolean;
  setDisabled(this: void, isDisabled: boolean): void;
}

interface CommandEntry {
  readonly checkIsAvailable: ((this: void) => boolean) | null;
  readonly commandText: string;
  readonly initButton: ((buttonEl: HTMLButtonElement, scope: Scope) => ButtonControl) | null;
  readonly initInstruction: ((purposeEl: HTMLSpanElement, scope: Scope) => InstructionControl) | null;
  readonly isDropDown: boolean;
  readonly purpose: string;
  readonly registerScope: ((scope: Scope) => void) | null;
}

/**
 * One control rendered into an INSTRUCTION bar.
 *
 * There is deliberately no pressed state here: the control — a checkbox, a dropdown — shows its own,
 * so a second copy would only be a second thing to keep in sync.
 */
interface InstructionControl {
  setDisabled(this: void, isDisabled: boolean): void;
}

interface InstructionEx extends Instruction {
  readonly entry: CommandEntry;
}

/**
 * Re-states one rendered control, already bound to its own elements.
 */
type RefreshControl = (this: void) => void;

const NOOP_MODAL_COMMANDS: ModalCommands = {
  refresh: (): void => {
    // Nothing was rendered, so there is no state to re-state.
  }
};

/**
 * Builds a modal's control strip from keyboard commands, interactive checkboxes, and dropdowns, then
 * applies them to a modal via {@link ModalCommandBuilder.build}.
 */
export class ModalCommandBuilder {
  private readonly entries: CommandEntry[] = [];

  /**
   * Adds an interactive checkbox to the control strip, bound to a modifier+key shortcut that toggles it.
   *
   * @param command - The checkbox command to add.
   * @returns The builder instance for chaining.
   */
  public addCheckbox(command: CheckboxCommand): this {
    this.entries.push({
      checkIsAvailable: command.checkIsAvailable ?? null,
      commandText: this.buildCommandText(command),
      initButton: (buttonEl: HTMLButtonElement, scope: Scope): ButtonControl => {
        // Created but never appended: the checkbox holds the state and the button is a view of it, so
        // `onInit` / `onChange` mean exactly the same thing in both render modes.
        const checkboxEl = createEl('input', { type: 'checkbox' });
        initCheckbox(checkboxEl, scope);
        buttonEl.addEventListener('click', () => {
          toggleCheckbox(checkboxEl);
        });
        return {
          checkIsOn: (): boolean => checkboxEl.checked,
          setDisabled: (isDisabled: boolean): void => {
            checkboxEl.disabled = isDisabled;
            buttonEl.disabled = isDisabled;
          }
        };
      },
      initInstruction: (purposeEl: HTMLSpanElement, scope: Scope): InstructionControl => initCheckbox(purposeEl.createEl('input', { type: 'checkbox' }), scope),
      isDropDown: false,
      purpose: command.purpose,
      registerScope: null
    });
    return this;

    function initCheckbox(checkboxEl: HTMLInputElement, scope: Scope): InstructionControl {
      command.onInit(checkboxEl);
      checkboxEl.addEventListener('change', () => {
        command.onChange(checkboxEl.checked);
      });

      scope.register(command.modifiers ?? [], command.key, () => {
        toggleCheckbox(checkboxEl);
      });

      return {
        setDisabled: (isDisabled: boolean): void => {
          checkboxEl.disabled = isDisabled;
        }
      };
    }
  }

  /**
   * Adds a dropdown to the control strip, bound to a modifier+key shortcut that cycles through its
   * options.
   *
   * @param command - The dropdown command to add.
   * @returns The builder instance for chaining.
   */
  public addDropDown(command: DropDownCommand): this {
    this.entries.push({
      checkIsAvailable: command.checkIsAvailable ?? null,
      commandText: this.buildCommandText(command),
      initButton: null,
      initInstruction: (purposeEl: HTMLSpanElement, scope: Scope): InstructionControl => {
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

        return {
          setDisabled: (isDisabled: boolean): void => {
            dropdownComponent.setDisabled(isDisabled);
          }
        };
      },
      isDropDown: true,
      purpose: command.purpose,
      registerScope: null
    });
    return this;
  }

  /**
   * Adds a keyboard command to the control strip. When {@link KeyboardCommand.onKey} is provided, its
   * handler is registered with the modal scope; otherwise the command is a hint only.
   *
   * @param command - The keyboard command to add.
   * @returns The builder instance for chaining.
   */
  public addKeyboardCommand(command: KeyboardCommand): this {
    const checkIsOn = command.checkIsOn ?? ((): boolean => false);
    const onActivate = command.onActivate ?? null;
    const onKey = command.onKey?.bind(command) ?? null;

    this.entries.push({
      checkIsAvailable: command.checkIsAvailable ?? null,
      commandText: this.buildCommandText(command),
      initButton: onActivate
        // No disabled guard on the listener: a disabled button fires no click at all, so `setDisabled`
        // Below is the whole gate.
        ? (buttonEl: HTMLButtonElement): ButtonControl => {
          buttonEl.addEventListener('click', ($event) => {
            onActivate($event);
          });
          return {
            checkIsOn,
            setDisabled: (isDisabled: boolean): void => {
              buttonEl.disabled = isDisabled;
            }
          };
        }
        : null,
      initInstruction: null,
      isDropDown: false,
      purpose: command.purpose,
      registerScope: onKey
        /* v8 ignore start -- defensive ?? on optional modifiers. */
        ? (scope: Scope): void => {
          scope.register(command.modifiers ?? [], command.key, onKey);
        }
        /* v8 ignore stop */
        : null
    });
    return this;
  }

  /**
   * Applies the accumulated commands to a modal. Always registers the essential navigation/action key
   * handlers; only renders the control strip and registers the option-toggle shortcuts when
   * {@link ModalCommandBuilderBuildOptions.shouldShowInstructions} is `true`.
   *
   * @param target - The modal, or the bare element + scope, to apply the commands to.
   * @param options - The build options.
   * @returns A handle whose {@link ModalCommands.refresh} re-states every rendered control.
   */
  public build(target: ModalCommandsTarget, options: ModalCommandBuilderBuildOptions = {}): ModalCommands {
    const {
      renderMode = ModalCommandsRenderMode.Instructions,
      shouldShowInstructions = true
    } = options;

    const scope = target.scope;

    // Essential navigation/action key handlers must stay active even when the control strip is hidden.
    for (const entry of this.entries) {
      entry.registerScope?.(scope);
    }

    if (!shouldShowInstructions) {
      return NOOP_MODAL_COMMANDS;
    }

    // Each renderer hands back one closure per control it actually drew, already bound to that control's
    // Elements — so `refresh` never has to know which of the two shapes it is re-stating.
    const refreshers = renderMode === ModalCommandsRenderMode.Buttons
      ? this.renderButtons(target, scope)
      : this.renderInstructions(target, scope);

    const modalCommands: ModalCommands = {
      refresh: () => {
        for (const refreshControl of refreshers) {
          refreshControl();
        }
      }
    };
    modalCommands.refresh();
    return modalCommands;
  }

  private buildCommandText(command: CommandBase): string {
    let commandText = KEYS_MAP.get(command.key) ?? command.key;

    for (const modifier of command.modifiers ?? []) {
      commandText = `${this.getModifierString(modifier)} ${commandText}`;
    }

    return commandText;
  }

  private getModifierString(modifier: Modifier): string {
    switch (modifier) {
      case 'Alt': {
        return 'alt';
      }
      case 'Ctrl': {
        return 'ctrl';
      }
      case 'Meta': {
        return Platform.isMacOS ? 'cmd' : 'win';
      }
      case 'Mod': {
        return Platform.isMacOS ? 'cmd' : 'ctrl';
      }
      case 'Shift': {
        return 'shift';
      }
      default: {
        return modifier;
      }
    }
  }

  /**
   * Resolves the element a self-created strip is appended to.
   *
   * A {@link Modal} carries both `modalEl` and a `containerEl` that is the OUTER `.modal-container`, so
   * `modalEl` has to win — otherwise the strip lands outside the modal frame. Discriminated with `in`
   * rather than a property read, because tests hand `build` a `strictProxy` mock whose `get` trap throws
   * on unmocked members.
   *
   * @param target - The build target.
   * @returns The element to append the strip to.
   */
  private getStripContainerEl(target: ModalCommandsTarget): HTMLElement {
    return 'modalEl' in target ? target.modalEl : target.containerEl;
  }

  private renderButtons(target: ModalCommandsTarget, scope: Scope): RefreshControl[] {
    const stripEl = this.getStripContainerEl(target).createDiv();
    addPluginCssClasses(stripEl, CssClass.ModalCommands);

    const refreshers: RefreshControl[] = [];

    for (const entry of this.entries) {
      if (entry.isDropDown) {
        throw new Error(`Cannot render dropdown command "${entry.purpose}" as a button: a control that cycles has no button form.`);
      }

      if (!entry.initButton) {
        // Hint-only and keyboard-only commands have no pointer route, and a button nobody can press is
        // Worse than no button. Their scope handlers are already registered.
        continue;
      }

      const buttonEl = stripEl.createEl('button', { type: 'button' });
      addPluginCssClasses(buttonEl, CssClass.ModalCommand);
      buttonEl.createSpan({ text: entry.purpose });

      // The hotkey is shown only where one can be pressed. On a phone there is no modifier key to offer,
      // And the button IS the only way in — which is why the strip exists.
      if (!Platform.isMobile) {
        const hotkeyEl = buttonEl.createSpan({ text: entry.commandText });
        addPluginCssClasses(hotkeyEl, CssClass.ModalCommandHotkey);
      }

      // The input keeps focus: a modal that filters as you type would end its search mid-word if a click
      // Stole focus.
      buttonEl.addEventListener('mousedown', ($event) => {
        $event.preventDefault();
      });

      const buttonControl = entry.initButton(buttonEl, scope);
      const checkIsAvailable = entry.checkIsAvailable;
      refreshers.push(() => {
        if (checkIsAvailable) {
          buttonControl.setDisabled(!checkIsAvailable());
        }
        const isOn = buttonControl.checkIsOn();
        buttonEl.toggleClass(CssClass.IsActive, isOn);
        buttonEl.setAttribute('aria-pressed', String(isOn));
      });
    }

    return refreshers;
  }

  private renderInstructions(target: ModalCommandsTarget, scope: Scope): RefreshControl[] {
    const instructions: InstructionEx[] = this.entries.map((entry) => ({
      command: entry.commandText,
      entry,
      purpose: entry.purpose
    }));

    const purposeEls = 'setInstructions' in target
      ? this.renderNativeInstructions(target, instructions)
      : this.renderOwnInstructions(this.getStripContainerEl(target), instructions);

    const refreshers: RefreshControl[] = [];
    for (const [index, instruction] of instructions.entries()) {
      const purposeEl = purposeEls[index];
      // A host may render fewer purpose elements than there are instructions; skip rather than throw.
      if (!purposeEl) {
        continue;
      }

      const instructionControl = instruction.entry.initInstruction?.(purposeEl, scope);
      const checkIsAvailable = instruction.entry.checkIsAvailable;
      // A control shows its own pressed state here, so availability is the only thing left to re-state —
      // And a command that declares none needs no refresher at all.
      if (instructionControl && checkIsAvailable) {
        refreshers.push(() => {
          instructionControl.setDisabled(!checkIsAvailable());
        });
      }
    }

    return refreshers;
  }

  /**
   * Renders through Obsidian's own instruction bar, the way every {@link SuggestModal} consumer has always
   * had it.
   *
   * @param modal - The suggest modal.
   * @param instructions - The instructions to render.
   * @returns The purpose element of each rendered instruction.
   */
  private renderNativeInstructions(modal: SuggestModal<unknown>, instructions: InstructionEx[]): HTMLSpanElement[] {
    modal.setInstructions(instructions);
    return [...modal.instructionsEl.findAll('.prompt-instruction > span:nth-child(2)')] as HTMLSpanElement[];
  }

  /**
   * Renders an instruction bar of the builder's own, for a host that has none.
   *
   * The markup mirrors what `setInstructions` produces, so Obsidian's own styling applies unchanged.
   *
   * @param containerEl - The element to append the bar to.
   * @param instructions - The instructions to render.
   * @returns The purpose element of each rendered instruction.
   */
  private renderOwnInstructions(containerEl: HTMLElement, instructions: InstructionEx[]): HTMLSpanElement[] {
    const instructionsEl = containerEl.createDiv(CssClass.PromptInstructions);
    addPluginCssClasses(instructionsEl, CssClass.ModalCommands);

    return instructions.map((instruction) => {
      const instructionEl = instructionsEl.createDiv(CssClass.PromptInstruction);
      instructionEl.createSpan({ text: instruction.command });
      return instructionEl.createSpan({ text: instruction.purpose });
    });
  }
}

/**
 * Flips a checkbox and announces it, unless it is disabled.
 *
 * Shared by the shortcut and the button so the two routes cannot drift — including the disabled guard,
 * which is the half most easily forgotten on one of them.
 *
 * @param checkboxEl - The checkbox to toggle.
 */
function toggleCheckbox(checkboxEl: HTMLInputElement): void {
  if (checkboxEl.disabled) {
    return;
  }
  checkboxEl.checked = !checkboxEl.checked;
  checkboxEl.trigger('change');
}
