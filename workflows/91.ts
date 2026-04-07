import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("91-relative-time-formatter")
  .description(
    "Create trail-viewer/Sources/Services/RelativeTimeFormatter.swift — human-readable relative date formatting",
  )
  .pattern("pipeline")
  .channel("wf-91-relative-time")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift utility designer for date formatting",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a Swift file: RelativeTimeFormatter.swift for the Trail Viewer macOS app.

Requirements:
- Import Foundation

- Define struct RelativeTimeFormatter (not a class — lightweight value type)

- static func format(_ date: Date) -> String:
  - Calculate the time interval from date to now: Date().timeIntervalSince(date)
  - Use absolute value for seconds (handle future dates gracefully)
  - Return based on elapsed time:
    - < 60 seconds: "just now"
    - < 120 seconds: "1m ago"
    - < 3600 seconds (60 min): "{minutes}m ago" (e.g. "2m ago", "45m ago")
    - < 7200 seconds (2 hours): "1h ago"
    - < 86400 seconds (24 hours): "{hours}h ago" (e.g. "3h ago", "23h ago")
    - < 172800 seconds (2 days): "yesterday"
    - < 604800 seconds (7 days): "{days} days ago" (e.g. "2 days ago", "6 days ago")
    - < 31536000 seconds (365 days): formatted as "Jan 15" (month abbreviation + day)
    - >= 365 days: formatted as "Jan 2025" (month abbreviation + year)

  - Use DateFormatter for the "Jan 15" and "Jan 2025" formats:
    - For month+day: dateFormat = "MMM d"
    - For month+year: dateFormat = "MMM yyyy"

- static func formatCompact(_ date: Date) -> String:
  - Even shorter version for tight spaces:
    - < 60s: "now"
    - < 3600s: "{m}m" (e.g. "5m")
    - < 86400s: "{h}h" (e.g. "3h")
    - < 604800s: "{d}d" (e.g. "2d")
    - < 31536000s: "MMM d" format
    - else: "MMM yy" format (short year)

- static func formatVerbose(_ date: Date) -> String:
  - Longer, more readable version:
    - < 60s: "just now"
    - < 3600s: "{minutes} minutes ago" (or "1 minute ago" for singular)
    - < 86400s: "{hours} hours ago" (or "1 hour ago")
    - < 604800s: "{days} days ago" (or "1 day ago" / "yesterday")
    - else: full date "January 15, 2025" using dateFormat "MMMM d, yyyy"

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/91-relative-time.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/91-relative-time.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/91-relative-time.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Services/RelativeTimeFormatter.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Services/RelativeTimeFormatter.swift.
Create the directory trail-viewer/Sources/Services/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/RelativeTimeFormatter.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Services/RelativeTimeFormatter.swift && git commit -m "feat: add RelativeTimeFormatter — human-readable relative date formatting"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("91-relative-time-formatter:", result.status);
