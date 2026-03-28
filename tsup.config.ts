import { defineConfig } from "tsup";

export default defineConfig([
  // Main library and SDK
  {
    entry: {
      index: "src/index.ts",
      "sdk/index": "src/sdk/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node20",
    shims: true,
  },
  // CLI (needs shebang banner)
  {
    entry: {
      "cli/index": "src/cli/index.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    target: "node20",
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
