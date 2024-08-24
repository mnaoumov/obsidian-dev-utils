import { lint } from "../src/bin/ESLint/ESLint.ts";
import { wrapCliTask } from "../src/cli.ts";
import process from "node:process";
import eslintPluginTsdoc from "eslint-plugin-tsdoc";

await wrapCliTask(async () => {
  const fix = process.argv[2] === "fix";
  return await lint(fix, [{
    plugins: {
      "tsdoc": eslintPluginTsdoc
    },
    rules: {
      "tsdoc/syntax": "error"
    }
  }]);
});
