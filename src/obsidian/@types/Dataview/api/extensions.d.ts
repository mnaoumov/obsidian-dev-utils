import type { STask } from "../data-model/serialized/markdown.d.ts";
/** A general function for deciding how to check a task given it's current state. */
export type TaskStatusSelector = (task: STask) => Promise<string>;
/**
 * A dataview extension; allows for registering new functions, altering views, and altering some more
 * advanced dataview behavior.
 **/
export declare class Extension {
  public plugin: string;
  /** All registered task status selectors for this extension. */
  public taskStatusSelectors: Record<string, TaskStatusSelector>;
  public constructor(plugin: string);
  /** Register a task status selector under the given name. */
  public taskStatusSelector(name: string, selector: TaskStatusSelector): Extension;
}
