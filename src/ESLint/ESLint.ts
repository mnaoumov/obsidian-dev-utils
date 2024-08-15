import {
  loadESLint
} from "eslint";
import { configs } from "./eslint.config.ts";
import {
  dirname,
  join
} from "node:path/posix";
import { packageDirectory } from "pkg-dir";
import { fileURLToPath } from "node:url";
import { toRelativeFromRoot } from "../Root.ts";

if (typeof __filename === "undefined") {
  globalThis.__filename = fileURLToPath(import.meta.url);
  globalThis.__dirname = dirname(__filename);
}

export async function lint(fix?: boolean): Promise<void> {
  fix ??= false;
  const packageDir = await packageDirectory({ cwd: __dirname });
  if (!packageDir) {
    throw new Error("Could not find package directory.");
  }
  const ignorePatterns = configs.flatMap((config) => config.ignores ?? []);

  const FlatESLint = await loadESLint({ useFlatConfig: true });
  const eslint = new FlatESLint({
    fix,
    overrideConfigFile: join(packageDir, "dist/eslint.config.empty.cjs"),
    overrideConfig: configs,
    ignorePatterns
  });
  const lintResults = await eslint.lintFiles(["."]);

  let hasErrors = false;

  for (const lintResult of lintResults) {
    if (lintResult.errorCount > 0 || lintResult.fatalErrorCount > 0 || lintResult.fixableErrorCount > 0) {
      hasErrors = true;
    }

    if (lintResult.output) {
      console.log(`${toRelativeFromRoot(lintResult.filePath)} - had some issues that were fixed automatically.`);
      hasErrors = true;
    }

    for (const message of lintResult.messages) {
      const canAutoFix = message.fix !== undefined;
      console.log(`${toRelativeFromRoot(lintResult.filePath)}:${message.line}:${message.column} - ${message.message} [rule ${message.ruleId}]${canAutoFix ? " (auto-fixable)" : ""}`);
    }
  }

  process.exit(hasErrors ? 1 : 0)
}
