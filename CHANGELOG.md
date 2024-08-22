# CHANGELOG

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
