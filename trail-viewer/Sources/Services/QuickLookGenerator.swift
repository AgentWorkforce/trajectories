import Foundation

/// Generates and locates HTML previews used for Finder Quick Look.
///
/// Server route to add on the Node side:
///
/// ```ts
/// // POST /api/previews/generate
/// // Body: { path: "/absolute/path/to/.agentworkforce/trajectories/completed" }
/// // Returns: { count: number }
/// //
/// // import { generatePreviewsForAll } from "./preview-generator.js"
/// //
/// // app.post("/api/previews/generate", async (c) => {
/// //   const { path } = await c.req.json<{ path: string }>()
/// //   const count = await generatePreviewsForAll(path)
/// //   return c.json({ count })
/// // })
/// ```
final class QuickLookGenerator {

    private struct GenerateRequest: Encodable {
        let path: String
    }

    private struct GenerateResponse: Decodable {
        let count: Int
    }

    private static let previewsEndpoint = "api/previews/generate"

    /// Requests HTML preview generation for all trajectory JSON files under the
    /// supplied completed-trajectories directory.
    static func generatePreviews(for trajectoryPath: String) async throws -> Int {
        let expandedPath = (trajectoryPath as NSString).expandingTildeInPath
        let endpoint = AppConfiguration.serverBaseURL.appendingPathComponent(previewsEndpoint)

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try JSONEncoder().encode(GenerateRequest(path: expandedPath))
        } catch {
            throw APIError.unknown("Failed to encode preview generation request: \(error.localizedDescription)")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown("Preview generation returned a non-HTTP response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8)
            throw APIError.serverError(httpResponse.statusCode, message)
        }

        do {
            return try JSONDecoder().decode(GenerateResponse.self, from: data).count
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Finds the generated HTML preview for a trajectory ID.
    ///
    /// Expected layout:
    /// `.agentworkforce/trajectories/completed/YYYY-MM/traj_xxx.html`
    static func previewURL(for trajectoryId: String, in directory: String) -> URL? {
        let fileManager = FileManager.default
        let rootURL = URL(fileURLWithPath: (directory as NSString).expandingTildeInPath)
        let expectedFilename = "\(trajectoryId).html"

        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: rootURL.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return nil
        }

        let directMatch = rootURL.appendingPathComponent(expectedFilename)
        if fileManager.fileExists(atPath: directMatch.path) {
            return directMatch
        }

        guard let enumerator = fileManager.enumerator(
            at: rootURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return nil
        }

        for case let candidate as URL in enumerator {
            guard candidate.lastPathComponent == expectedFilename else { continue }
            return candidate
        }

        return nil
    }
}
