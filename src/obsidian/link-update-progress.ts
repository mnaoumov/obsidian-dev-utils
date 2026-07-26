/**
 * @file
 *
 * Types describing the progress reported while links are updated across multiple files during a
 * rename/move link-update operation. A consumer (e.g. a plugin) can supply a
 * {@link LinkUpdateProgressReporter} to surface a persistent/updating "N of M links updated" notice.
 */

/**
 * A progress update emitted once per file whose links are updated during a multi-file rename/move
 * link-update operation.
 */
export interface LinkUpdateProgress {
  /**
   * The path of the file whose links were just updated.
   */
  readonly currentPath: string;

  /**
   * The number of files processed so far, including the current one.
   */
  readonly processed: number;

  /**
   * The total number of files whose links will be updated.
   */
  readonly total: number;
}

/**
 * A reporter invoked once per file whose links are updated during a multi-file rename/move
 * link-update operation. It is always optional: when it is not provided, no progress is reported and
 * behavior is otherwise unchanged.
 */
export type LinkUpdateProgressReporter = (this: void, progress: LinkUpdateProgress) => void;
