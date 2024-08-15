import { Notice } from "obsidian";

export function showError(error: unknown): void {
  printError(error);
  new Notice("An unhandled error occurred. Please check the console for more information.");
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
