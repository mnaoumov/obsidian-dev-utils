import { lint } from "cspell";
import { toRelativeFromRoot } from "./Root.ts";
import { fileURLToPath } from "node:url";

export async function spellcheck(): Promise<void> {
  let hasErrors = false;

  await lint(["."], {}, {
    issue: (issue) => {
      if (!issue.uri) {
        return;
      }

      const path = fileURLToPath(issue.uri);
      const relativePath = toRelativeFromRoot(path);
      console.error(`${relativePath}:${issue.row}:${issue.col} - ${issue.text}`);
      hasErrors = true;
    }
  });

  process.exit(hasErrors ? 1 : 0);
}
