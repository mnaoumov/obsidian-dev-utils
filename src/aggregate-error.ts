/**
 * @file
 *
 * Contains a utility function for building an `AggregateError` that names what failed.
 */

/**
 * Builds an `AggregateError` over collected errors, giving it a message that names what failed.
 *
 * `AggregateError`'s own message is optional, and omitting it is lossy in a way that only shows up
 * outside this library. {@link error!errorToString} walks `errors` and prints the whole tree, so the
 * console is fine; everything that reads `message` is not. Obsidian's own plugin-load failure report, a
 * `Notice` built from an error, and a consumer's `rejects.toThrow(message)` all see an empty string and
 * read it as "nothing was thrown". Nesting compounds it: an aggregate holding one aggregate puts two empty
 * layers above the only sentence that says what went wrong.
 *
 * A single collected error therefore lends its own message to the aggregate, which makes a one-cause
 * chain read identically at every level. Several become a count, with the detail one level down where
 * {@link error!errorToString} already prints it.
 *
 * @param errors - The collected errors to aggregate.
 * @returns An `AggregateError` holding every collected error, with a non-empty message.
 */
export function createAggregateError(errors: readonly unknown[]): AggregateError {
  return new AggregateError(errors, getAggregateErrorMessage(errors));
}

function getAggregateErrorMessage(errors: readonly unknown[]): string {
  const [singleError] = errors;
  // A lone failure lends its own message, which is what makes a one-cause chain read identically at every
  // Level of nesting. Anything else is a count, because picking one of several messages to promote would
  // Describe the failure as if the others had not happened.
  if (errors.length === 1 && singleError instanceof Error && singleError.message !== '') {
    return singleError.message;
  }

  return `${String(errors.length)} error(s) occurred`;
}
