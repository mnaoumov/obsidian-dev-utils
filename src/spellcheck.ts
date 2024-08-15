import { lint } from "cspell";
import { toRelativeFromRoot } from "./Root.ts";
import { fileURLToPath } from "node:url";
import { TaskResult } from "./TaskResult.ts";

export async function spellcheck(): Promise<TaskResult> {
  let isSuccess = true;

  await lint(["."], {}, {
    issue: (issue) => {
      if (!issue.uri) {
        return;
      }

      const path = fileURLToPath(issue.uri);
      const relativePath = toRelativeFromRoot(path);
      console.error(`${relativePath}:${issue.row}:${issue.col} - ${issue.text}`);
      isSuccess = false;
    }
  });

  return TaskResult.CreateSuccessResult(isSuccess);
}
