import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

interface PackageJson {
  name?: unknown;
  repository?: unknown;
}

interface RepositoryObject {
  type?: unknown;
  url?: unknown;
  directory?: unknown;
}

export interface ResolveProjectIdOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveProjectId(
  explicitProjectId?: string,
  options: ResolveProjectIdOptions = {},
): string | undefined {
  return (
    readString(explicitProjectId) ??
    readString((options.env ?? process.env).TRAJECTORIES_PROJECT) ??
    resolveDefaultProjectId(options.cwd)
  );
}

export function resolveDefaultProjectId(
  cwd = process.cwd(),
): string | undefined {
  const packageJson = readNearestPackageJson(cwd);

  return (
    resolvePackageRepositoryId(packageJson) ??
    resolveGitRemoteProjectId(cwd) ??
    resolvePackageName(packageJson)
  );
}

export function normalizeRepositoryId(value: string): string | undefined {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }

  const withoutGitPrefix = raw.replace(/^git\+/, "");
  const shorthand = withoutGitPrefix.match(
    /^(?:github|gitlab|bitbucket):([^/]+\/[^/]+(?:\/[^/]+)*)$/,
  );
  if (shorthand) {
    return cleanRepositoryPath(shorthand[1]);
  }

  const ownerRepo = withoutGitPrefix.match(
    /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/,
  );
  if (ownerRepo) {
    return cleanRepositoryPath(ownerRepo[1]);
  }

  const sshUrlScpLike = withoutGitPrefix.match(
    /^ssh:\/\/[^@/\s]+@[^:/\s]+:(.+)$/i,
  );
  if (sshUrlScpLike) {
    return cleanRepositoryPath(sshUrlScpLike[1]);
  }

  const scpLike = withoutGitPrefix.match(/^[^@/\s]+@[^:/\s]+:(.+)$/);
  if (scpLike) {
    return cleanRepositoryPath(scpLike[1]);
  }

  let parsed: URL;
  try {
    parsed = new URL(withoutGitPrefix);
  } catch {
    return undefined;
  }

  if (!["https:", "http:", "ssh:", "git:"].includes(parsed.protocol)) {
    return undefined;
  }

  return cleanRepositoryPath(parsed.pathname);
}

function resolvePackageRepositoryId(
  packageJson: PackageJson | undefined,
): string | undefined {
  if (!packageJson) {
    return undefined;
  }

  const repository = packageJson.repository;
  if (typeof repository === "string") {
    return normalizeRepositoryId(repository);
  }

  if (isRepositoryObject(repository) && typeof repository.url === "string") {
    const projectId = normalizeRepositoryId(repository.url);
    const directory = cleanRepositoryDirectory(repository.directory);
    return directory && projectId ? `${projectId}//${directory}` : projectId;
  }

  return undefined;
}

function resolvePackageName(
  packageJson: PackageJson | undefined,
): string | undefined {
  return readString(packageJson?.name);
}

function resolveGitRemoteProjectId(cwd: string): string | undefined {
  for (const remote of ["upstream", "origin"]) {
    const remoteUrl = getGitRemoteUrl(cwd, remote);
    if (!remoteUrl) {
      continue;
    }

    const projectId = normalizeRepositoryId(remoteUrl);
    if (projectId) {
      return projectId;
    }
  }

  return undefined;
}

function getGitRemoteUrl(cwd: string, remote: string): string | undefined {
  try {
    return readString(
      execFileSync("git", ["config", "--get", `remote.${remote}.url`], {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return undefined;
  }
}

function readNearestPackageJson(cwd: string): PackageJson | undefined {
  let current = resolve(cwd);

  while (true) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, "utf-8")) as unknown;
        if (isPackageJson(parsed)) {
          return parsed;
        }
      } catch {
        // Ignore malformed package files and keep walking toward repo roots.
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

function cleanRepositoryPath(path: string): string | undefined {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? "";
  const withoutSlashes = withoutQuery.replace(/^\/+|\/+$/g, "");
  const withoutGitSuffix = withoutSlashes.replace(/\.git$/i, "");
  const parts = withoutGitSuffix
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return undefined;
  }

  return parts.join("/");
}

function cleanRepositoryDirectory(directory: unknown): string | undefined {
  const raw = readString(directory);
  if (
    !raw ||
    raw.startsWith("/") ||
    raw.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(raw)
  ) {
    return undefined;
  }

  const parts = raw
    .split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    parts.length === 0 ||
    parts.some((part) => part === "." || part === "..")
  ) {
    return undefined;
  }

  return parts.join("/");
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isPackageJson(value: unknown): value is PackageJson {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRepositoryObject(value: unknown): value is RepositoryObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
