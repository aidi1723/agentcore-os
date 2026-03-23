import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LOADER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(LOADER_DIR, "..");
const SRC_ROOT = path.join(PROJECT_ROOT, "src");

function resolveAliasPath(specifier) {
  if (!specifier.startsWith("@/")) return null;
  return path.join(SRC_ROOT, specifier.slice(2));
}

function findExistingModulePath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  const aliasPath = resolveAliasPath(specifier);
  if (!aliasPath) {
    return defaultResolve(specifier, context, defaultResolve);
  }

  const resolved = findExistingModulePath(aliasPath);
  if (!resolved) {
    throw new Error(`Unable to resolve alias ${specifier}`);
  }

  return {
    shortCircuit: true,
    url: pathToFileURL(resolved).href,
  };
}
