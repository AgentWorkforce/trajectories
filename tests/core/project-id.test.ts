import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Project ID resolution", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-project-id-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("normalizes common hosted repository URL formats", async () => {
    const { normalizeRepositoryId } = await import(
      "../../src/core/project-id.js"
    );

    expect(
      normalizeRepositoryId(
        "https://github.com/AgentWorkforce/trajectories.git",
      ),
    ).toBe("AgentWorkforce/trajectories");
    expect(
      normalizeRepositoryId(
        "git+ssh://git@github.com/AgentWorkforce/trajectories.git",
      ),
    ).toBe("AgentWorkforce/trajectories");
    expect(
      normalizeRepositoryId(
        "git+ssh://git@github.com:AgentWorkforce/trajectories.git",
      ),
    ).toBe("AgentWorkforce/trajectories");
    expect(
      normalizeRepositoryId("git@github.com:AgentWorkforce/trajectories.git"),
    ).toBe("AgentWorkforce/trajectories");
    expect(normalizeRepositoryId("github:AgentWorkforce/trajectories")).toBe(
      "AgentWorkforce/trajectories",
    );
  });

  it("uses package repository metadata before package name", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "agent-trajectories",
        repository: {
          type: "git",
          url: "https://github.com/AgentWorkforce/trajectories.git",
        },
      }),
    );

    expect(resolveDefaultProjectId(tempDir)).toBe(
      "AgentWorkforce/trajectories",
    );
  });

  it("includes repo-relative package directory metadata", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        repository: {
          type: "git",
          url: "https://github.com/AgentWorkforce/trajectories.git",
          directory: "trail-viewer/server",
        },
      }),
    );

    expect(resolveDefaultProjectId(tempDir)).toBe(
      "AgentWorkforce/trajectories//trail-viewer/server",
    );
  });

  it("ignores malformed package files while walking to parent directories", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    const childDir = join(tempDir, "packages", "broken");
    await mkdir(childDir, { recursive: true });
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        repository: "https://github.com/AgentWorkforce/trajectories.git",
      }),
    );
    await writeFile(join(childDir, "package.json"), "{not valid json");

    expect(resolveDefaultProjectId(childDir)).toBe(
      "AgentWorkforce/trajectories",
    );
  });

  it("ignores array package files and keeps walking to parent directories", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    const childDir = join(tempDir, "packages", "array-package");
    await mkdir(childDir, { recursive: true });
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        repository: "https://github.com/AgentWorkforce/trajectories.git",
      }),
    );
    await writeFile(join(childDir, "package.json"), JSON.stringify([]));

    expect(resolveDefaultProjectId(childDir)).toBe(
      "AgentWorkforce/trajectories",
    );
  });

  it("ignores absolute repository directory metadata", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        repository: {
          type: "git",
          url: "https://github.com/AgentWorkforce/trajectories.git",
          directory: "C:\\Users\\will\\private",
        },
      }),
    );

    expect(resolveDefaultProjectId(tempDir)).toBe(
      "AgentWorkforce/trajectories",
    );

    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        repository: {
          type: "git",
          url: "https://github.com/AgentWorkforce/trajectories.git",
          directory: "\\Users\\will\\private",
        },
      }),
    );

    expect(resolveDefaultProjectId(tempDir)).toBe(
      "AgentWorkforce/trajectories",
    );
  });

  it("uses upstream git remote before origin when package metadata is absent", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "ignore" });
    execFileSync(
      "git",
      ["remote", "add", "origin", "git@github.com:will/local-fork.git"],
      { cwd: tempDir, stdio: "ignore" },
    );
    execFileSync(
      "git",
      [
        "remote",
        "add",
        "upstream",
        "git@github.com:AgentWorkforce/trajectories.git",
      ],
      { cwd: tempDir, stdio: "ignore" },
    );

    expect(resolveDefaultProjectId(tempDir)).toBe(
      "AgentWorkforce/trajectories",
    );
  });

  it("falls back to package name when no repository is available", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "agent-trajectories" }),
    );

    expect(resolveDefaultProjectId(tempDir)).toBe("agent-trajectories");
  });

  it("does not turn local filesystem remotes into project IDs", async () => {
    const { resolveDefaultProjectId } = await import(
      "../../src/core/project-id.js"
    );
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "ignore" });
    execFileSync(
      "git",
      ["remote", "add", "origin", "/Users/will/private/repo.git"],
      { cwd: tempDir, stdio: "ignore" },
    );

    expect(resolveDefaultProjectId(tempDir)).toBeUndefined();
  });

  it("honors explicit and environment project IDs before repo defaults", async () => {
    const { resolveProjectId } = await import("../../src/core/project-id.js");
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        repository: "https://github.com/AgentWorkforce/trajectories.git",
      }),
    );

    expect(resolveProjectId("manual-project", { cwd: tempDir })).toBe(
      "manual-project",
    );
    expect(
      resolveProjectId(undefined, {
        cwd: tempDir,
        env: { TRAJECTORIES_PROJECT: "env-project" },
      }),
    ).toBe("env-project");
  });
});
