/**
 * @file
 *
 * Works out which platform-prefixed modules a same-named facade supersedes in the flat barrel.
 *
 * `AGENTS.md` **L5** makes a platform-only module carry a `desktop-` / `mobile-` filename prefix, and it
 * marks the *file*, not its exports — `desktop-trusted-input.ts` exports `pressKey`, not
 * `desktopPressKey`. **L6** then asks for a cross-platform facade over such a pair, and a facade that
 * hides the split has to export those very same names. In the flat barrel (`src/__merged.ts`) all three
 * land in one namespace, so the three copies of `pressKey` read as a name collision and fail the build —
 * a structural dead end, since neither rule can bend without losing what it is for.
 *
 * The way out is to notice that the collision is not real: the twins are *implementations* of the facade,
 * so the barrel should export the facade and skip them. `lib.pressKey` inside an `evalInObsidian` closure
 * then resolves to the platform-correct helper on either platform, and both published subpaths stay
 * importable for a caller making a deliberate platform commitment.
 *
 * The **superset invariant** is what keeps that from turning into silent loss: a facade may supersede its
 * twins only if it exports every value name they do. Without it, a twin that later grows an export the
 * facade lacks would simply vanish from the flat bag instead of failing the build.
 */

/**
 * An incomplete facade: a value export a superseded twin has and the facade does not.
 */
export interface IncompleteFacade {
  /**
   * The facade's module specifier.
   */
  facade: string;

  /**
   * The value export names the superseded module has that the facade does not, sorted.
   */
  missingNames: string[];

  /**
   * The superseded module's specifier.
   */
  supersededModule: string;
}

/**
 * A facade and the platform-prefixed twins it supersedes in the flat barrel.
 */
export interface ModuleSupersession {
  /**
   * The unprefixed facade's module specifier.
   */
  facade: string;

  /**
   * The specifiers of the `desktop-` / `mobile-` prefixed siblings it supersedes, sorted.
   */
  superseded: string[];
}

/**
 * The `AGENTS.md` L5 filename prefixes that mark a platform-only module.
 */
const PLATFORM_PREFIXES = [
  'desktop-',
  'mobile-'
];

/**
 * Finds the facades whose twins a superset check must cover, and reports every value export a facade is
 * missing.
 *
 * @param supersessions - The supersessions to check, as {@link findModuleSupersessions} returns them.
 * @param valueExportsByModule - Every module's value export names, superseded modules included.
 * @returns One entry per (facade, superseded module) pair that fails the superset invariant.
 */
export function findIncompleteFacades(supersessions: ModuleSupersession[], valueExportsByModule: Map<string, string[]>): IncompleteFacade[] {
  const incompleteFacades: IncompleteFacade[] = [];

  for (const supersession of supersessions) {
    const facadeNames = new Set(valueExportsByModule.get(supersession.facade));
    for (const supersededModule of supersession.superseded) {
      const supersededNames = valueExportsByModule.get(supersededModule) ?? [];
      const missingNames = supersededNames.filter((name) => !facadeNames.has(name)).sort();
      if (missingNames.length > 0) {
        incompleteFacades.push({ facade: supersession.facade, missingNames, supersededModule });
      }
    }
  }

  return incompleteFacades;
}

/**
 * Finds every unprefixed module that has at least one `desktop-` / `mobile-` prefixed sibling of the same
 * name in the same directory.
 *
 * A prefixed module with no such sibling supersedes nothing and is left alone — `desktop-demo-vault-opener.ts`,
 * whose `openDemoVault` has no facade, still reaches the flat barrel on its own.
 *
 * @param moduleSpecifiers - Every leaf module's specifier, e.g. `./obsidian/trusted-input.ts`.
 * @returns One entry per facade that supersedes at least one twin, sorted by facade specifier.
 */
export function findModuleSupersessions(moduleSpecifiers: string[]): ModuleSupersession[] {
  const knownSpecifiers = new Set(moduleSpecifiers);
  const supersededByFacade = new Map<string, string[]>();

  for (const moduleSpecifier of moduleSpecifiers) {
    const facade = toFacadeSpecifier(moduleSpecifier);
    if (facade === null || !knownSpecifiers.has(facade)) {
      continue;
    }

    const superseded = supersededByFacade.get(facade) ?? [];
    superseded.push(moduleSpecifier);
    supersededByFacade.set(facade, superseded);
  }

  return [...supersededByFacade]
    .map(([facade, superseded]) => ({ facade, superseded: [...superseded].sort() }))
    .sort((a, b) => a.facade.localeCompare(b.facade));
}

/**
 * Formats incomplete facades into a human-readable multi-line report.
 *
 * @param incompleteFacades - The incomplete facades to describe.
 * @returns One line per (facade, superseded module) pair.
 */
export function formatIncompleteFacades(incompleteFacades: IncompleteFacade[]): string {
  return incompleteFacades
    .map((incompleteFacade) => `  ${incompleteFacade.facade} does not re-export ${incompleteFacade.missingNames.join(', ')} from ${incompleteFacade.supersededModule}`)
    .join('\n');
}

/**
 * Collects the specifiers of every module some facade supersedes.
 *
 * @param supersessions - The supersessions to flatten, as {@link findModuleSupersessions} returns them.
 * @returns The superseded modules' specifiers, for a membership test while collecting exports.
 */
export function toSupersededModules(supersessions: ModuleSupersession[]): Set<string> {
  return new Set(supersessions.flatMap((supersession) => supersession.superseded));
}

function toFacadeSpecifier(moduleSpecifier: string): null | string {
  const separatorIndex = moduleSpecifier.lastIndexOf('/');
  const directory = moduleSpecifier.slice(0, separatorIndex + 1);
  const fileName = moduleSpecifier.slice(separatorIndex + 1);

  for (const platformPrefix of PLATFORM_PREFIXES) {
    if (fileName.startsWith(platformPrefix)) {
      return `${directory}${fileName.slice(platformPrefix.length)}`;
    }
  }

  return null;
}
