# CHANGELOG

## 3.8.0

- Implement getAvailablePathForAttachments without patching mkdir

## 3.7.1

- Ensure folders are created

## 3.7.0

- Handle defaultOptionsFn

## 3.6.0

- Force tags
- Allow empty commit
- Add placeholder to prompt

## 3.5.0

- Don't change aliases for markdown links
- Make generateMarkdownLink work for deleted TFile

## 3.4.1

- Use cancelButtonText

## 3.4.0

- Refactor all modals

## 3.3.0

- Add Confirm modal

## 3.2.0

- Reload plugin settings before updating

## 3.1.0

- Proper check to handle mobile

## 3.0.4

- Proper exclude files prop

## 3.0.3

- Don't fail on failed linting
- Skip linting if no files
- Lint only explicit patterns

## 3.0.2

- Update package-lock
- Fix localforage dep

## 3.0.1

- Fix cli path

## 3.0.0

- Refactor ESLint rules
- Avoid using node: modules

## 2.27.0

- ensureMetadataCacheReady in getBacklinksForFileSafe

## 2.26.3

- Fix return type for isNote

## 2.26.2

- Handle removed parent folder case

## 2.26.1

- Prevent double patching

## 2.26.0

- Handle fake attachment folder

## 2.25.2

- Register file in uniqueFileLookup

## 2.25.1

- Clarify forceRelativePath

## 2.25.0

- Export all internal types

## 2.24.0

- Extend generateMarkdownLink

## 2.23.3

- Fix options merging

## 2.23.2

- Disable removeFolderSafe notice by default

## 2.23.1

- Fix removeEmptyFolderHierarchy

## 2.23.0

- registerFileInVault

## 2.22.1

- Add missing init

## 2.22.0

- Create temp file and folders

## 2.21.2

- Make createFolderSafe boolean

## 2.21.1

- Fix parameter type

## 2.21.0

- Handle default setting

## 2.20.0

- Pass plugin instead of tab

## 2.19.0

- Refactor UIComponent

## 2.18.0

- Export getAlias

## 2.17.1

- Make dependency for build purpose

## 2.17.0

- Update tsdocs
- Allow custom configs to Linter

## 2.16.0

- Add FrontMatter types

## 2.15.0

- getFrontMatterSafe
- Allow unchanged links

## 2.14.0

- editLinks

## 2.13.0

- Refactor Vault
- Refactor FrontMatter

## 2.12.0

- Sort lint results by path
- Switch to PathOrFile
- Missing export

## 2.11.0

- More Dataview functions

## 2.10.0

- Refactor cli

## 2.9.0

- Insert empty token to ensure it doesn't break sourceMappingURL in other plugins

## 2.8.0

- If .d.ts required, skip it

## 2.7.0

- Ensure copyToObsidianPluginFolder is the last step
- insertCodeBlock

## 2.6.1

- Add missing package

## 2.6.0

- Dataview - update deps

## 2.5.0

- Add getApp

## 2.4.0

- Move Dataview generics to methods

## 2.3.0

- Add proper dependency to fix import resolution

## 2.2.0

- Force brackets in lambdas
- Add DocumentFragment
- Allow passing custom pluginSettings

## 2.1.0

- Pass customEsbuildPlugins to ObsidianPlugin

## 2.0.0

- Proper update in `package-lock.json`
- Inline `obsidian-dataview` types

## 1.8.0

- Don't skip ESM modules from bundling
- Report spellcheck error without stack

## 1.7.7

- Replace .ts to .cjs
- Remove generation dependencies
- Switch all to dependencies

## 1.7.6

- Mark esbuild/eslint as externals

## 1.7.5

- Don't use getDependenciesToSkip in plugin build
- Remove old path dep

## 1.7.4

- Don't exit on `npm run dev`

## 1.7.3

- Switch to var as it what esbuild converts const to

## 1.7.2

- Avoid second definition of the const
- Allow MaybePromise for overrides
- Move typings to deps

## 1.7.1

- Make proper `bindValueComponent` overloads

## 1.7.0

- Allow convert plugin setting values

## 1.6.0

- Serialize JSON with functions
- Add more String functions
- Rename invokeEsbuild
- Switch to path-browserify
- Improve tsdoc

## 1.5.1

- Auto commit package-lock.json

## 1.5.0

- Add tsdoc
- Edit package-lock.json
- Fix lint for missing folder

## 1.4.0

- Switch to lint:fix

## 1.3.2

- Stop build if exports changed

## 1.3.1

- Spellcheck

## 1.3.0

- Fix Dataview typings

## 1.2.0

- Lint only src and scripts
- Add build:clean, build:static commands

## 1.1.1

- copyUpdatedManifest only for plugin

## 1.1.0

- Simplify generics
- Make version scripts for plugin and not

## 1.0.2

- Fix eslint/cspell commands
- Make release files same as npm
- Exclude dist.zip from npm

## 1.0.1

- Add PluginBase
- Fixes

## 1.0.0

- Initial version
