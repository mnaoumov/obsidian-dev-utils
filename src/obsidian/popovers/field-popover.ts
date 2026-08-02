/**
 * @file
 *
 * Utility for editing a handful of named text fields in a popover anchored at a point.
 *
 * This is to {@link showPopover} what `modals/prompt.ts` is to `modals/modal.ts`: the common case
 * spelled declaratively, so a caller that only needs a few text fields never writes any DOM wiring.
 * Anything richer — a dropdown, a toggle, rendered markdown — goes through {@link showPopover}
 * directly.
 */

import {
  Setting,
  TextComponent
} from 'obsidian';

import type { PopoverAnchor } from './popover-anchor.ts';
import type { ShowPopoverParams } from './popover.ts';

import { normalizeOptionalProperties } from '../../object-utils.ts';
import { CssClass } from '../css-class.ts';
import { showPopover } from './popover.ts';

/**
 * Parameters for {@link editFieldsInPopover}.
 *
 * @typeParam Key - The union of the field keys, inferred from {@link EditFieldsInPopoverParams.fields}.
 */
export interface EditFieldsInPopoverParams<Key extends string> {
  /**
   * Where to place the popover.
   */
  readonly anchor: PopoverAnchor;

  /**
   * A text for the "Cancel" button.
   */
  readonly cancelButtonText?: string;

  /**
   * Additional CSS classes to apply to the popover.
   */
  readonly cssClasses?: string[];

  /**
   * The fields to edit, rendered top to bottom in the given order.
   */
  readonly fields: readonly PopoverField<Key>[];

  /**
   * A text for the "OK" button.
   */
  readonly okButtonText?: string;
}

/**
 * A single text field of a {@link editFieldsInPopover} popover.
 *
 * @typeParam Key - The key the field's value is returned under.
 */
export interface PopoverField<Key extends string> {
  /**
   * A value to pre-fill the field with.
   *
   * @default `''`
   */
  readonly defaultValue?: string;

  /**
   * The key the field's value is returned under.
   */
  readonly key: Key;

  /**
   * The label shown next to the field.
   */
  readonly name: string;

  /**
   * A placeholder text for the field.
   *
   * @default `''`
   */
  readonly placeholder?: string;
}

/**
 * Displays a popover with a text field per entry in `fields` and resolves with their values keyed by
 * {@link PopoverField.key}, or `null` if it was dismissed without confirming.
 *
 * @typeParam Key - The union of the field keys, inferred from the `fields` array.
 * @param params - The parameters for the popover.
 * @returns A {@link Promise} that resolves with the edited values, or `null` if dismissed.
 */
export async function editFieldsInPopover<Key extends string>(params: EditFieldsInPopoverParams<Key>): Promise<null | Record<Key, string>> {
  const {
    anchor,
    cancelButtonText,
    cssClasses,
    fields,
    okButtonText
  } = params;

  return await showPopover<Record<Key, string>>(normalizeOptionalProperties<ShowPopoverParams<Record<Key, string>>>({
    anchor,
    build({ contentEl }) {
      const editors = fields.map((field) => ({
        key: field.key,
        textComponent: addField(contentEl, field)
      }));

      return () => {
        // The record is accumulated key by key, so it is only complete — and only typed as such — once every field has been read.
        const values: Record<string, string> = {};
        for (const editor of editors) {
          values[editor.key] = editor.textComponent.getValue();
        }

        return values;
      };
    },
    cancelButtonText,
    cssClasses,
    okButtonText
  }));
}

/**
 * Adds a single labelled text field to the popover.
 *
 * @typeParam Key - The key the field's value is returned under.
 * @param containerElement - The element to add the field to.
 * @param field - The field to add.
 * @returns The field's text component.
 */
function addField<Key extends string>(containerElement: HTMLElement, field: PopoverField<Key>): TextComponent {
  const setting = new Setting(containerElement).setName(field.name);
  const textComponent = new TextComponent(setting.controlEl);
  textComponent.setValue(field.defaultValue ?? '');
  textComponent.setPlaceholder(field.placeholder ?? '');
  textComponent.inputEl.addClass(CssClass.TextBox);
  return textComponent;
}
