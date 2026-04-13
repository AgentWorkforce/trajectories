# Test API Script — Complete TypeScript File

Write this to `src/test-api.ts`:

```typescript
/**
 * REST API test script for the Trail Viewer server.
 * Run with: npx tsx src/test-api.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3847";

interface TestResult {
  endpoint: string;
  passed: boolean;
  error?: string;
  status?: number;
}

async function testEndpoint(
  name: string,
  url: string,
  options?: RequestInit
): Promise<TestResult> {
  try {
    const response = await fetch(url, options);
    if (response.ok) {
      return { endpoint: name, passed: true, status: response.status };
    }
    return {
      endpoint: name,
      passed: false,
      status: response.status,
      error: `Expected 2xx, got ${response.status}`,
    };
  } catch (err) {
    return {
      endpoint: name,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const results: TestResult[] = [];

  // 1. GET /health
  {
    const res = await fetch(`${BASE_URL}/health`);
    const body = await res.json();
    const passed = res.status === 200 && body.status === "ok";
    results.push({
      endpoint: "GET /health",
      passed,
      status: res.status,
      error: passed ? undefined : `status=${res.status}, body=${JSON.stringify(body)}`,
    });
  }

  // 2. GET /api/trajectories
  {
    const res = await fetch(`${BASE_URL}/api/trajectories`);
    const body = await res.json();
    const passed = res.status === 200 && Array.isArray(body);
    results.push({
      endpoint: "GET /api/trajectories",
      passed,
      status: res.status,
      error: passed ? undefined : `Expected array, got ${typeof body}`,
    });
  }

  // 3. GET /api/trajectories/:id
  {
    const res = await fetch(`${BASE_URL}/api/trajectories/traj-jwt-auth-001`);
    const body = await res.json();
    const passed =
      res.status === 200 &&
      body.id !== undefined &&
      body.title !== undefined &&
      body.status !== undefined;
    results.push({
      endpoint: "GET /api/trajectories/:id",
      passed,
      status: res.status,
      error: passed
        ? undefined
        : `Missing fields: id=${body.id}, title=${body.title}, status=${body.status}`,
    });
  }

  // 4. GET /api/trajectories/:id (not found)
  {
    const res = await fetch(`${BASE_URL}/api/trajectories/nonexistent-id`);
    const passed = res.status === 404;
    results.push({
      endpoint: "GET /api/trajectories/:id (not found)",
      passed,
      status: res.status,
      error: passed ? undefined : `Expected 404, got ${res.status}`,
    });
  }

  // 5. GET /api/stats
  {
    const res = await fetch(`${BASE_URL}/api/stats`);
    const body = await res.json();
    const passed =
      res.status === 200 &&
      body.total !== undefined &&
      body.active !== undefined &&
      body.completed !== undefined &&
      body.abandoned !== undefined;
    results.push({
      endpoint: "GET /api/stats",
      passed,
      status: res.status,
      error: passed
        ? undefined
        : `Missing stats fields in ${JSON.stringify(body)}`,
    });
  }

  // 6. GET /api/trajectories/:id/markdown
  {
    const res = await fetch(
      `${BASE_URL}/api/trajectories/traj-jwt-auth-001/markdown`
    );
    const contentType = res.headers.get("content-type") || "";
    const body = await res.text();
    const passed =
      res.status === 200 &&
      contentType.includes("text/plain") &&
      body.length > 0;
    results.push({
      endpoint: "GET /api/trajectories/:id/markdown",
      passed,
      status: res.status,
      error: passed
        ? undefined
        : `contentType=${contentType}, bodyLength=${body.length}`,
    });
  }

  // 7. GET /api/trajectories/:id/timeline
  {
    const result = await testEndpoint(
      "GET /api/trajectories/:id/timeline",
      `${BASE_URL}/api/trajectories/traj-jwt-auth-001/timeline`
    );
    results.push(result);
  }

  // 8. GET /api/trajectories/:id/json
  {
    const res = await fetch(
      `${BASE_URL}/api/trajectories/traj-jwt-auth-001/json`
    );
    const contentType = res.headers.get("content-type") || "";
    const passed =
      res.status === 200 && contentType.includes("application/json");
    results.push({
      endpoint: "GET /api/trajectories/:id/json",
      passed,
      status: res.status,
      error: passed ? undefined : `contentType=${contentType}`,
    });
  }

  // 9. GET /api/personas
  {
    const res = await fetch(`${BASE_URL}/api/personas`);
    const body = await res.json();
    const passed =
      res.status === 200 && Array.isArray(body) && body.length >= 1;
    results.push({
      endpoint: "GET /api/personas",
      passed,
      status: res.status,
      error: passed
        ? undefined
        : `Expected non-empty array, got ${JSON.stringify(body).slice(0, 100)}`,
    });
  }

  // Print results
  console.log("\n=== Trail Viewer API Test Results ===\n");
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`[PASS] ${r.endpoint} (${r.status})`);
    } else {
      console.log(
        `[FAIL] ${r.endpoint}${r.status ? ` (${r.status})` : ""} — ${r.error}`
      );
    }
  }

  console.log(`\n${passCount}/${results.length} endpoints passed\n`);
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
```

OWNER_DECISION: COMPLETE
REASON: Complete TypeScript test script spec covering all 9 endpoint test cases with result tracking and summary output.
