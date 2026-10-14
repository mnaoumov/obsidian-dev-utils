/**
 * @file
 *
 * The former home of the `SuggestModal` instruction-bar builder.
 *
 * The builder is no longer tied to `SuggestModal` — it renders into a plain `Modal` and into a bare
 * element + `Scope` too — so it moved to `modal-command-builder.ts` under the honest name
 * {@link ModalCommandBuilder}. This module stays as a deprecated alias so existing importers keep working
 * unchanged; it re-exports the very same class, not a copy.
 */

import type { ModalCommandBuilderBuildOptions } from './modal-command-builder.ts';

import { ModalCommandBuilder } from './modal-command-builder.ts';

export type {
  CheckboxCommand,
  DropDownCommand,
  KeyboardCommand
} from './modal-command-builder.ts';

/**
 * Options for {@link SuggestModalCommandBuilder.build}.
 *
 * @deprecated Use {@link ModalCommandBuilderBuildOptions} from
 * `obsidian-dev-utils/obsidian/modals/modal-command-builder` instead.
 */
export type SuggestModalCommandBuilderBuildOptions = ModalCommandBuilderBuildOptions;

/**
 * Builds a `SuggestModal`'s instruction bar.
 *
 * @deprecated Use {@link ModalCommandBuilder} from
 * `obsidian-dev-utils/obsidian/modals/modal-command-builder` instead.
 */
export const SuggestModalCommandBuilder = ModalCommandBuilder;

/**
 * Builds a `SuggestModal`'s instruction bar.
 *
 * @deprecated Use {@link ModalCommandBuilder} from
 * `obsidian-dev-utils/obsidian/modals/modal-command-builder` instead.
 */
export type SuggestModalCommandBuilder = ModalCommandBuilder;
