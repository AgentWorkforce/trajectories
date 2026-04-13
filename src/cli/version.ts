import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findPackageJson(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find package.json");
}

function resolveCliVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = findPackageJson(here);
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8"),
    ) as { version?: string };
    return packageJson.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const VERSION = resolveCliVersion();
