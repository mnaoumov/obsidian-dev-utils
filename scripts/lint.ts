import { lint } from "../src/bin/ESLint/ESLint.ts";
import { wrapCliTask } from "../src/cli.ts";
import process from "node:process";
import eslintPluginTsdoc from "eslint-plugin-tsdoc";
import eslintPluginVerifyTsdoc from "eslint-plugin-verify-tsdoc";

await wrapCliTask(async () => {
  const fix = process.argv[2] === "fix";
  return await lint(fix, [{
    plugins: {
      "tsdoc": eslintPluginTsdoc,
      "verify-tsdoc": eslintPluginVerifyTsdoc
    },
    rules: {
      "tsdoc/syntax": "error",
      //"verify-tsdoc/tsdoc-comments-required": "error",
      "verify-tsdoc/verify-tsdoc-params": "error"
    }
  }]);
});
