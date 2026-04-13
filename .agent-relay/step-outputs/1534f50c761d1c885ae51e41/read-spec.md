# CLIDetector.swift — Full File Contents

```swift
import Foundation

// MARK: - CLIDetector

/// Detects installed CLI tools on the system by searching PATH and known directories.
enum CLIDetector {

    // MARK: - Known CLIs & Paths

    static let knownCLIs: [String] = [
        "claude", "codex", "opencode", "gemini", "aider", "droid"
    ]

    static let defaultPathEntries: [String] = [
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/usr/bin",
        "~/.local/bin",
        "~/.cargo/bin",
        "~/.npm-global/bin"
    ]

    // MARK: - Public API

    /// Detect all known CLIs concurrently, returning info for each one found.
    static func detectAll() async ->  LIInfo] {
        await withTaskGroup(of: CLIInfo?.self, returning:  LIInfo].self) { group in
            for cli in knownCLIs {
                group.addTask {
                    guard let path = resolveOnPath(named: cli) else { return nil }
                    let version = detectVersion(at: path)
                    return CLIInfo(name: cli, path: path, version: version, isAvailable: true)
                }
            }

            var results:  LIInfo] = []
            for await result in group {
                if let info = result {
                    results.append(info)
                }
            }
            return results.sorted { $0.name < $1.name }
        }
    }

    // MARK: - Path Resolution

    /// Resolve a CLI name to its absolute path using `which` first, then manual search.
    static func resolveOnPath(named name: String) -> String? {
        // First try /usr/bin/which
        if let whichResult = runProcess(
            executablePath: "/usr/bin/which",
            arguments: [name]
        ), !whichResult.isEmpty {
            let path = whichResult.trimmingCharacters(in: .whitespacesAndNewlines)
            if FileManager.default.isExecutableFile(atPath: path) {
                return path
            }
        }

        // Fall back to checking default path entries manually
        let fileManager = FileManager.default
        for entry in defaultPathEntries {
            let expanded = (entry as NSString).expandingTildeInPath
            let fullPath = (expanded as NSString).appendingPathComponent(name)
            if fileManager.isExecutableFile(atPath: fullPath) {
                return fullPath
            }
        }

        return nil
    }

    // MARK: - Version Detection

    /// Detect the version of a CLI at the given path by trying common version flags.
    static func detectVersion(at path: String) -> String? {
        let strategies: [[String]] = [
            ["--version"],
            ["-v"],
            ["version"]
        ]

        for args in strategies {
            if let output = runProcess(executablePath: path, arguments: args, timeout: 5.0),
               !output.isEmpty {
                if let version = extractVersion(from: output) {
                    return version
                }
            }
        }

        return nil
    }

    // MARK: - Private Helpers

    /// Run a process and capture its stdout, with a configurable timeout.
    private static func runProcess(
        executablePath: String,
        arguments: [String],
        timeout: TimeInterval = 5.0
    ) -> String? {
        let process = Process()
        let pipe = Pipe()

        process.executableURL = URL(fileURLWithPath: executablePath)
        process.arguments = arguments
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
        } catch {
            return nil
        }

        // Wait with timeout
        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }

        if process.isRunning {
            process.terminate()
            return nil
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let output = String(data: data, encoding: .utf8) else { return nil }
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Extract a semver-like version string from CLI output.
    private static func extractVersion(from output: String) -> String? {
        // Match semver-like patterns: 1.2.3, 0.10.1-beta, 2.0.0-rc.1, etc.
        let pattern = #"(\d+\.\d+\.\d+(?:[-\.][a-zA-Z0-9.]+)*)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(
                  in: output,
                  range: NSRange(output.startIndex..., in: output)
              ) else {
            return nil
        }

        guard let range = Range(match.range(at: 1), in: output) else { return nil }
        return String(output[range])
    }
}
```
