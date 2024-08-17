import { cli } from "../src/bin/cli.ts";

cli(["version", process.argv[2] ?? ""]);
