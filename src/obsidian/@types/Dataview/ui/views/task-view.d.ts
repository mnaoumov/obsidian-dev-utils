import { SListItem, STask } from "../../data-model/serialized/markdown.js";
import { Grouping } from "../../data-model/value.js";
import { MarkdownRenderChild, Vault } from "obsidian";
import { h } from "preact";
import { Query } from "../../query/query.js";
import { DataviewInit } from "../../ui/markdown.js";
export type TaskViewState = {
    state: "loading";
} | {
    state: "error";
    error: string;
} | {
    state: "ready";
    items: Grouping<SListItem>;
};
/**
 * Pure view over (potentially grouped) tasks and list items which allows for checking/unchecking tasks and manipulating
 * the task view.
 */
export declare function TaskView({ query, sourcePath }: {
    query: Query;
    sourcePath: string;
}): h.JSX.Element;
export declare function createTaskView(init: DataviewInit, query: Query, sourcePath: string): MarkdownRenderChild;
export declare function createFixedTaskView(init: DataviewInit, items: Grouping<SListItem>, sourcePath: string): MarkdownRenderChild;
/**
 * Removes tasks from a list if they are already present by being a child of another task. Fixes child pointers.
 * Retains original order of input list.
 */
export declare function nestItems(raw: SListItem[]): [SListItem[], Set<string>];
/**
 * Recursively removes tasks from each subgroup if they are already present by being a child of another task.
 * Fixes child pointers. Retains original order of input list.
 */
export declare function nestGroups(raw: Grouping<SListItem>): Grouping<SListItem>;
/** Set the task completion key on check. */
export declare function setTaskCompletion(originalText: string, useEmojiShorthand: boolean, completionKey: string, completionDateFormat: string, complete: boolean): string;
/** Rewrite a task with the given completion status and new text. */
export declare function rewriteTask(vault: Vault, task: STask, desiredStatus: string, desiredText?: string): Promise<void>;
