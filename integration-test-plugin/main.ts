/**
 * @file
 *
 * Integration test harness plugin.
 *
 * Imports the entire `obsidian-dev-utils` library and exposes it as a strongly
 * typed namespace on `window.__obsidianDevUtilsModule__`. This allows
 * `evalInObsidian` callbacks to access any part of the library.
 */

/// <reference path="./global.d.ts" />

// eslint-disable-next-line import-x/no-namespace -- Need entire module.
import * as obsidianDevUtils from '../src/index.ts';

import { Plugin } from 'obsidian';

/**
 * Minimal plugin that exposes the entire obsidian-dev-utils library for integration testing.
 */
export default class IntegrationTestPlugin extends Plugin {
  public override onload(): void {
    window.__obsidianDevUtilsModule__ = obsidianDevUtils;
  }

  public override onunload(): void {
    delete window.__obsidianDevUtilsModule__;
  }
}
