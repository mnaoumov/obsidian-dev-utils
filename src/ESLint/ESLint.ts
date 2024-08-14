import {
  Linter,
  loadESLint
} from "eslint";
import { configs } from "./eslint.config.ts";

export async function lintAndFix(config?: Linter.Config | Linter.Config[]): Promise<void> {
  config ??= configs;
  const FlatESLint = await loadESLint({ useFlatConfig: true });
  const eslint = new FlatESLint({
    fix: true,
    overrideConfigFile: "./eslint.config.empty.mjs",
    overrideConfig: config
  });
  const results = await eslint.lintFiles(["."]);
  await FlatESLint.outputFixes(results);

  const formatter = await eslint.loadFormatter("stylish");
  const str = await formatter.format(results, { cwd: process.cwd(), rulesMeta: {} });
  console.log(str);
}
