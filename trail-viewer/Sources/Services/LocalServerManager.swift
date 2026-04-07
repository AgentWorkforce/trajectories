//
//  LocalServerManager.swift
//  Trail Viewer
//
//  Manages the lifecycle of the local Node.js trajectory server process.
//  Handles starting, stopping, and monitoring the embedded HTTP server
//  that serves trajectory data to the SwiftUI frontend.
//

import Foundation
import SwiftUI

// MARK: - ServerState

/// Represents the current state of the local trajectory server.
enum ServerState: String {
    case stopped
    case starting
    case running
    case error
}

// MARK: - LocalServerManager

/// Manages the embedded Node.js server process that serves trajectory data.
///
/// This class handles spawning an `npx tsx` process to run the server,
/// monitoring its stdout/stderr for startup confirmation, and tearing
/// it down gracefully when no longer needed.
@Observable
final class LocalServerManager {

    // MARK: - Published Properties

    /// Current state of the server process.
    private(set) var state: ServerState = .stopped

    /// Human-readable error message when state is `.error`.
    private(set) var errorMessage: String?

    /// Port the server listens on.
    private(set) var port: Int = 3847

    // MARK: - Private Properties

    /// The running server process, if any.
    private var serverProcess: Process?

    /// Pipe capturing the server's standard output.
    private var outputPipe: Pipe?

    /// Pipe capturing the server's standard error.
    private var errorPipe: Pipe?

    /// Task that monitors startup timeout.
    private var startupTask: Task<Void, Never>?

    // MARK: - Computed Properties

    /// Whether the server is currently running and accepting connections.
    var isRunning: Bool {
        state == .running
    }

    /// Human-readable description of the current server state.
    var statusDescription: String {
        switch state {
        case .stopped:
            return "Server stopped"
        case .starting:
            return "Server starting…"
        case .running:
            return "Server running on port \(port)"
        case .error:
            if let errorMessage {
                return "Server error: \(errorMessage)"
            }
            return "Server error"
        }
    }

    // MARK: - Lifecycle

    deinit {
        if serverProcess != nil {
            stopSync()
        }
    }

    // MARK: - Start

    /// Starts the local trajectory server.
    ///
    /// - Parameter trajectoryPath: Optional path to the trajectories data directory.
    ///   If provided, the server will serve data from this directory.
    func start(trajectoryPath: String? = nil) {
        guard state == .stopped || state == .error else { return }

        state = .starting
        errorMessage = nil

        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()

        // Configure executable — use /usr/bin/env to resolve npx from PATH
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["npx", "tsx", "src/server.ts"]

        // Resolve server directory relative to the app bundle or working directory
        let serverDirectory = resolveServerDirectory()
        process.currentDirectoryURL = URL(fileURLWithPath: serverDirectory)

        // Build environment with trajectory path and port
        var environment = ProcessInfo.processInfo.environment
        environment["PORT"] = String(port)
        if let trajectoryPath {
            environment["TRAJECTORIES_DATA_DIR"] = trajectoryPath
        }
        process.environment = environment

        // Attach pipes
        process.standardOutput = stdout
        process.standardError = stderr

        self.outputPipe = stdout
        self.errorPipe = stderr
        self.serverProcess = process

        // Monitor stdout for startup confirmation
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty,
                  let output = String(data: data, encoding: .utf8) else { return }

            let lowercased = output.lowercased()
            if lowercased.contains("listening") || lowercased.contains("started") {
                Task { @MainActor [weak self] in
                    guard let self, self.state == .starting else { return }
                    self.state = .running
                    self.startupTask?.cancel()
                }
            }
        }

        // Monitor stderr for error output
        stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty,
                  let output = String(data: data, encoding: .utf8) else { return }

            Task { @MainActor [weak self] in
                guard let self else { return }
                if self.state == .starting || self.state == .running {
                    // Log stderr but don't immediately fail — some tools write warnings to stderr
                    #if DEBUG
                    print("[Server stderr]: \(output)")
                    #endif
                }
            }
        }

        // Set termination handler
        process.terminationHandler = { [weak self] terminatedProcess in
            Task { @MainActor [weak self] in
                guard let self else { return }
                // Only treat as error if we didn't intentionally stop
                if self.state != .stopped {
                    let exitCode = terminatedProcess.terminationStatus
                    let reason = terminatedProcess.terminationReason
                    self.state = .error
                    self.errorMessage = "Server exited unexpectedly (code: \(exitCode), reason: \(reason == .exit ? "exit" : "signal"))"
                }
                self.cleanupPipes()
            }
        }

        // Launch the process
        do {
            try process.run()
        } catch {
            state = .error
            errorMessage = "Failed to launch server: \(error.localizedDescription)"
            serverProcess = nil
            cleanupPipes()
            return
        }

        // Set startup timeout
        startupTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(AppConfiguration.serverStartupTimeout))

            guard !Task.isCancelled else { return }

            await MainActor.run { [weak self] in
                guard let self, self.state == .starting else { return }
                self.state = .error
                self.errorMessage = "Server failed to start within \(Int(AppConfiguration.serverStartupTimeout)) seconds"
                self.stopSync()
            }
        }
    }

    // MARK: - Stop

    /// Stops the running server process.
    func stop() {
        startupTask?.cancel()
        startupTask = nil

        guard let process = serverProcess else { return }

        process.terminate()
        process.waitUntilExit()

        serverProcess = nil
        state = .stopped
        errorMessage = nil
        cleanupPipes()
    }

    // MARK: - Restart

    /// Restarts the server, optionally with a new trajectory path.
    ///
    /// - Parameter trajectoryPath: Optional path to the trajectories data directory.
    func restart(trajectoryPath: String? = nil) {
        stop()

        Task {
            try? await Task.sleep(for: .milliseconds(500))
            await MainActor.run { [weak self] in
                self?.start(trajectoryPath: trajectoryPath)
            }
        }
    }

    // MARK: - Private Helpers

    /// Synchronous stop for use in deinit.
    private func stopSync() {
        startupTask?.cancel()
        startupTask = nil

        guard let process = serverProcess else { return }
        process.terminate()
        process.waitUntilExit()
        serverProcess = nil
        cleanupPipes()
    }

    /// Removes readability handlers and releases pipe references.
    private func cleanupPipes() {
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        errorPipe?.fileHandleForReading.readabilityHandler = nil
        outputPipe = nil
        errorPipe = nil
    }

    /// Resolves the server directory path.
    ///
    /// Looks for the server directory in the following order:
    /// 1. Inside the app bundle's Resources
    /// 2. Relative to the current working directory
    ///
    /// - Returns: The absolute path to the server directory.
    private func resolveServerDirectory() -> String {
        // Check app bundle first
        if let bundledPath = Bundle.main.resourceURL?
            .appendingPathComponent("server")
            .path,
           FileManager.default.fileExists(atPath: bundledPath) {
            return bundledPath
        }

        // Fall back to working directory — useful during development
        let workingDir = FileManager.default.currentDirectoryPath
        let devPath = (workingDir as NSString).appendingPathComponent("server")
        if FileManager.default.fileExists(atPath: devPath) {
            return devPath
        }

        // Last resort: return working directory itself
        return workingDir
    }
}
