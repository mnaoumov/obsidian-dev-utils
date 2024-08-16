import { EventEmitter } from "node:events";

const ASYNC_ERROR_EVENT = "asyncError";

const asyncErrorEventEmitter = new EventEmitter();
asyncErrorEventEmitter.on(ASYNC_ERROR_EVENT, handleAsyncError);

function handleAsyncError(asyncError: unknown): void {
  printError(new Error("An unhandled error occurred executing async operation", { cause: asyncError }));
}

export function emitAsyncErrorEvent(asyncError: unknown): void {
  asyncErrorEventEmitter.emit(ASYNC_ERROR_EVENT, asyncError);
}

export function registerAsyncErrorEventHandler(handler: (asyncError: unknown) => void): () => void {
  asyncErrorEventEmitter.on(ASYNC_ERROR_EVENT, handler);
  return () => asyncErrorEventEmitter.off(ASYNC_ERROR_EVENT, handler);
}

type ErrorEntry = {
  level: number;
  message: string;
  shouldClearAnsiSequence?: boolean;
}

export function printError(error: unknown): void {
  const entries = parseErrorEntries(error);

  for (const entry of entries) {
    if (entry.shouldClearAnsiSequence) {
      console.error(`\x1b[0m${entry.message}\x1b[0m`);
    } else {
      console.error(entry.message);
    }
  }
}

export function errorToString(error: unknown): string {
  return parseErrorEntries(error).map(entry => "  ".repeat(entry.level) + entry.message).join("\n");
}

function parseErrorEntries(error: unknown, level: number = 0, entries: ErrorEntry[] = []): ErrorEntry[] {
  if (error === undefined) {
    return entries;
  }

  if (!(error instanceof Error)) {
    let str = "";

    if (error === null) {
      str = "(null)";
    } else if (typeof error === "string") {
      str = error;
    } else {
      str = JSON.stringify(error);
    }

    entries.push({ level, message: str });
    return entries;
  }

  const title = `${error.name}: ${error.message}`;
  entries.push({ level, message: title, shouldClearAnsiSequence: true });

  if (error.stack) {
    const restStack = error.stack.startsWith(title) ? error.stack.substring(title.length + 1) : error.stack;
    entries.push({ level, message: `Error stack:\n${restStack}` });
  }

  if (error.cause !== undefined) {
    entries.push({ level, message: "Caused by:" });
    parseErrorEntries(error.cause, level + 1, entries);
  }

  return entries;
}
