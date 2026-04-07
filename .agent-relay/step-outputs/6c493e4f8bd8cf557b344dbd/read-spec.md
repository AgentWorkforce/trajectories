# Health Endpoint Specification

## File: `src/server/health.ts`

```typescript
/**
 * Health check endpoint configuration and handler for the Trail Viewer local server.
 * Provides runtime status, uptime, and environment configuration.
 */

/**
 * Server configuration derived from environment variables with sensible defaults.
 *
 * @property port - HTTP port (default: 3847, override via PORT env var)
 * @property host - Bind address (default: 127.0.0.1, override via HOST env var)
 * @property trajectoryPath - Directory containing trajectory data files
 *   (default: "./data", override via TRAJECTORIES_DATA_DIR env var)
 */
export const config = {
  port: parseInt(process.env.PORT || "3847", 10),
  host: process.env.HOST || "127.0.0.1",
  trajectoryPath: process.env.TRAJECTORIES_DATA_DIR || "./data",
};

const startedAt = Date.now();

/**
 * Returns a health check response object with server status and diagnostics.
 *
 * @returns Health status including pid, port, uptime in seconds,
 *   trajectory data path, version, and current ISO timestamp.
 */
export function healthHandler() {
  return {
    status: "ok" as const,
    pid: process.pid,
    port: config.port,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    trajectoryPath: config.trajectoryPath,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };
}

export type HealthResponse = ReturnType<typeof healthHandler>;
```

## Notes
- Pure ESM module — no `require`, uses `import`/`export`
- Zero external dependencies
- `startedAt` captured at module load time for accurate uptime tracking
- `config` is a plain object (not frozen) to allow test overrides if needed
- `HealthResponse` type is derived from the handler return, keeping them always in sync
