import {
  App,
  TFile
} from "obsidian";
import { resolveValue, type ValueProvider } from "../ValueProvider.ts";
import { processWithRetry } from "./Vault.ts";
import {
  DEFAULT_SCHEMA,
  Type,
  load,
  dump
} from "js-yaml";
import { getFile } from "./TFile.ts";

type FrontMatterWithAliases = {
  aliases?: string[];
};

const TIMESTAMP_TYPE = new Type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: (data: unknown): boolean => data != null,
  construct: (data: unknown): string => String(data),
  represent: (data: object): unknown => data
});

const NO_TIMESTAMPS_YAML_SCHEMA = DEFAULT_SCHEMA.extend({
  explicit: [TIMESTAMP_TYPE]
});

const FRONT_MATTER_REG_EXP = /^---\r?\n((?:.|\r?\n)*?)\r?\n?---(?:\r?\n|$)((?:.|\r?\n)*)/;

export async function processFrontMatter<FrontMatter>(app: App, pathOrFile: string | TFile, frontMatterFn: ValueProvider<void, [FrontMatter]>): Promise<void> {
  const file = getFile(app, pathOrFile);

  await processWithRetry(app, file, async (content) => {
    const match = content.match(FRONT_MATTER_REG_EXP);
    let frontMatterStr: string;
    let mainContent: string;
    if (match) {
      frontMatterStr = match[1]!;
      mainContent = match[2];
    } else {
      frontMatterStr = "";
      mainContent = content;
    }

    if (!mainContent) {
      mainContent = "\n";
    } else {
      mainContent = "\n" + mainContent.trim() + "\n";
    }

    const frontMatter = (load(frontMatterStr, { schema: NO_TIMESTAMPS_YAML_SCHEMA }) ?? {}) as FrontMatter;
    await resolveValue(frontMatterFn, frontMatter);
    let newFrontMatterStr = dump(frontMatter, {
      lineWidth: -1,
      quotingType: "\"",
      schema: NO_TIMESTAMPS_YAML_SCHEMA
    });
    if (newFrontMatterStr === "{}\n") {
      newFrontMatterStr = "";
    }

    const newContent = `---
${newFrontMatterStr}---
${mainContent}`;

    return newContent;
  });
}

export async function addAlias(app: App, pathOrFile: string | TFile, alias?: string): Promise<void> {
  if (!alias) {
    return;
  }

  const file = getFile(app, pathOrFile);
  if (alias === file.basename) {
    return;
  }

  await processFrontMatter(app, pathOrFile, (frontMatter: FrontMatterWithAliases) => {
    if (!frontMatter.aliases) {
      frontMatter.aliases = [];
    }

    if (!frontMatter.aliases.includes(alias)) {
      frontMatter.aliases.push(alias);
    }
  });
}

export async function removeAlias(app: App, pathOrFile: string | TFile, alias?: string): Promise<void> {
  if (!alias) {
    return;
  }

  await processFrontMatter(app, pathOrFile, (frontMatter: FrontMatterWithAliases) => {
    if (!frontMatter.aliases) {
      return;
    }

    frontMatter.aliases = frontMatter.aliases.filter(a => a != alias);

    if (frontMatter.aliases.length === 0) {
      delete frontMatter.aliases;
    }
  });
}

