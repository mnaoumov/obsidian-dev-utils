/**
 * @file
 *
 * CLI handler registrars.
 */

import type {
  CliData,
  CliFlags
} from 'obsidian';
import type { Promisable } from 'type-fest';

import { Plugin } from 'obsidian';

import { normalizePromisable } from '../async.ts';

/**
 * Registers CLI handlers.
 */
export interface CliHandlerRegistrar {
  /**
   * Registers a CLI handler.
   *
   * @param params - The parameters for the CLI handler registration.
   */
  registerCliHandler(params: CliHandlerRegistrarRegisterCliHandlerParams): void;
}

/**
 * Parameters for registering a CLI handler.
 */
export interface CliHandlerRegistrarRegisterCliHandlerParams {
  /**
   * The command to register the handler for.
   */
  readonly command: string;

  /**
   * The description of the command.
   */
  readonly description: string;

  /**
   * The flags for the command.
   */
  readonly flags: CliFlags | null;

  /**
   * The handler to register.
   *
   * @param cliData - The data passed to the handler.
   * @returns The result of the handler.
   */
  handler(cliData: CliData): Promisable<string>;
}

type PluginCliHandlerRegistrarRegisterCliHandlerParams = CliHandlerRegistrarRegisterCliHandlerParams;

/**
 * CLI handler registrar in an Obsidian plugin.
 */
export class PluginCliHandlerRegistrar implements CliHandlerRegistrar {
  /**
   * Creates a new instance of the {@link PluginCliHandlerRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(protected readonly plugin: Plugin) {}

  /**
   * Registers a CLI handler.
   *
   * @param params - The parameters for the CLI handler registration.
   */
  public registerCliHandler(params: PluginCliHandlerRegistrarRegisterCliHandlerParams): void {
    this.plugin.registerCliHandler(params.command, params.description, params.flags, (cliData) => normalizePromisable(params.handler(cliData)));
  }
}
