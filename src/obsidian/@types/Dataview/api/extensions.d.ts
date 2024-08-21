import { STask } from "../data-model/serialized/markdown.js";
/** A general function for deciding how to check a task given it's current state. */
export type TaskStatusSelector = (task: STask) => Promise<string>;
/**
 * A dataview extension; allows for registering new functions, altering views, and altering some more
 * advanced dataview behavior.
 **/
export declare class Extension {
    plugin: string;
    /** All registered task status selectors for this extension. */
    taskStatusSelectors: Record<string, TaskStatusSelector>;
    constructor(plugin: string);
    /** Register a task status selector under the given name. */
    taskStatusSelector(name: string, selector: TaskStatusSelector): Extension;
}
