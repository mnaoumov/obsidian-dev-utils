import { lint } from "cspell";
import { getRootDir } from "./Root.ts";
import { fileURLToPath } from "node:url";
import { relative } from "node:path/posix";

export async function spellcheck(): Promise<void> {
  const rootDir = toPosixPath(await getRootDir());

  let hasErrors = false;

  await lint(["."], {}, {
    issue: (issue) => {
      if (!issue.uri) {
        return;
      }

      const path = toPosixPath(fileURLToPath(issue.uri));
      const relativePath = relative(rootDir, path);
      console.error(`${relativePath}:${issue.row}:${issue.col} - ${issue.text}`);
      hasErrors = true;
    }
  });

  process.exit(hasErrors ? 1 : 0);
}

function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}
