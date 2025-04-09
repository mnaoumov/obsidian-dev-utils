/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a time.
 */

import type { Duration } from 'moment';

import {
  duration,
  utc
} from 'moment';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../../SettingEx.ts';

import { CssClass } from '../../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

/**
 * A component that displays and edits a time.
 *
 * You can add this component using {@link SettingEx.addTime}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class TimeComponent extends TypedRangeTextComponent<Duration> {
  /**
   * Creates a new time component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'time', CssClass.TimeComponent);
  }

  /**
   * Converts a string to a time.
   *
   * @param str - The string to convert.
   * @returns The date.
   */
  public override valueFromString(str: string): Duration {
    return duration(str);
  }

  /**
   * Converts a time to a string.
   *
   * @param value - The time to convert.
   * @returns The string.
   */
  public override valueToString(value: Duration): string {
    let format: string;
    if (value.milliseconds() > 0) {
      format = 'HH:mm:ss.SSS';
    } else if (value.seconds() > 0) {
      format = 'HH:mm:ss';
    } else {
      format = 'HH:mm';
    }

    return utc(value.asMilliseconds()).format(format);
  }
}
