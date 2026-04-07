import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("70-server-scaffold")
  .description(
    "Create trail-viewer/server/package.json AND trail-viewer/server/tsconfig.json — Node.js server scaffold",
  )
  .pattern("pipeline")
  .channel("wf-70-server-scaffold")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Node.js project scaffold architect",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "TypeScript implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of TWO files for the Trail Viewer local server:

FILE 1: package.json
\`\`\`json
{
  "name": "trail-viewer-server",
  "version": "1.0.0",
  "description": "Local HTTP server for Trail Viewer macOS app — serves trajectory data and chat API",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "build": "tsc"
  },
  "dependencies": {
    "agent-trajectories": "file:../../",
    "@agent-relay/sdk": "*",
    "hono": "^4.0.0",
    "@hono/node-server": "^1.8.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
\`\`\`

FILE 2: tsconfig.json
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
\`\`\`

Output both files clearly labeled with their filenames.`,
    verification: { type: "output_contains", value: "trail-viewer-server" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create TWO files for the Trail Viewer server from this spec:

{{steps.plan.output}}

1. Create trail-viewer/server/package.json with the package.json content
2. Create trail-viewer/server/tsconfig.json with the tsconfig.json content

Create the directory trail-viewer/server/ and trail-viewer/server/src/ if they do not exist.
IMPORTANT: Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/package.json",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/package.json server/tsconfig.json && git commit -m "chore: add server scaffold — package.json and tsconfig.json for trail-viewer-server"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("70-server-scaffold:", result.status);
