type ModuleWithDefaultExport = {
  default: unknown;
}

export async function getModule(moduleName: string): Promise<unknown> {
  const module = await import(moduleName);
  return (module as ModuleWithDefaultExport).default ?? module;
}
