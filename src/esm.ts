import { register } from "tsx/cjs/api";

export function requireEsm<Module>(identifier: string): Module {
  const namespaceRequire = register({ namespace: "tsx" });
  try {
    return namespaceRequire.require(identifier, import.meta.url) as Module
  } finally {
    namespaceRequire.unregister();
  }
}
