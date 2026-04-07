import AppKit
import CoreSpotlight
import Foundation
import UniformTypeIdentifiers

final class SpotlightRegistration {

    private static let domainIdentifier = "com.trailviewer.trajectories"

    private static let fileDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private init() {}

    static func indexTrajectory(_ trajectory: Trajectory, at fileURL: URL) {
        let document = SpotlightDocument(
            id: trajectory.id,
            title: trajectory.title,
            description: trajectory.description ?? trajectory.retrospective?.summary,
            status: trajectory.status.rawValue,
            keywords: (trajectory.tags ?? []) + (trajectory.agents?.map(\.agentName) ?? []),
            authors: trajectory.agents?.map(\.agentName) ?? [],
            textContent: buildTextContent(
                decisionEntries: decisionEntries(from: trajectory),
                retrospectiveSummary: trajectory.retrospective?.summary,
                learnings: trajectory.retrospective?.learnings ?? [],
                chapterTitles: trajectory.chapters.map(\.title)
            )
        )

        let item = searchableItem(for: document, fileURL: fileURL)
        CSSearchableIndex.default().indexSearchableItems([item]) { error in
            guard let error else { return }
            #if DEBUG
            print("Spotlight indexing failed for \(trajectory.id): \(error.localizedDescription)")
            #endif
        }
    }

    static func indexAllTrajectories(from directory: URL) async {
        let rootURL = resolveIndexRoot(from: directory)
        let fileURLs = trajectoryFileURLs(in: rootURL)
        var items: [CSSearchableItem] = []

        for fileURL in fileURLs {
            do {
                if let item = try searchableItem(from: fileURL) {
                    items.append(item)
                }
            } catch {
                #if DEBUG
                print("Spotlight indexing skipped \(fileURL.lastPathComponent): \(error.localizedDescription)")
                #endif
            }
        }

        guard !items.isEmpty else {
            #if DEBUG
            print("Spotlight indexed 0 trajectories")
            #endif
            return
        }

        do {
            try await index(items: items)
            #if DEBUG
            print("Spotlight indexed \(items.count) trajectories")
            #endif
        } catch {
            #if DEBUG
            print("Spotlight batch indexing failed: \(error.localizedDescription)")
            #endif
        }
    }

    static func removeTrajectory(_ id: String) {
        CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: [id]) { error in
            guard let error else { return }
            #if DEBUG
            print("Spotlight removal failed for \(id): \(error.localizedDescription)")
            #endif
        }
    }

    static func removeAllTrajectories() {
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domainIdentifier]) { error in
            guard let error else { return }
            #if DEBUG
            print("Spotlight reset failed: \(error.localizedDescription)")
            #endif
        }
    }

    static func handleSpotlightActivity(_ userActivity: NSUserActivity) -> String? {
        guard userActivity.activityType == CSSearchableItemActionType else {
            return nil
        }

        if let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
           !identifier.isEmpty {
            return identifier
        }

        if let identifier = userActivity.targetContentIdentifier,
           !identifier.isEmpty {
            return identifier
        }

        return nil
    }

    private static func searchableItem(from fileURL: URL) throws -> CSSearchableItem? {
        let data = try Data(contentsOf: fileURL)

        if let trajectory = try? fileDecoder.decode(Trajectory.self, from: data) {
            let document = SpotlightDocument(
                id: trajectory.id,
                title: trajectory.title,
                description: trajectory.description ?? trajectory.retrospective?.summary,
                status: trajectory.status.rawValue,
                keywords: (trajectory.tags ?? []) + (trajectory.agents?.map(\.agentName) ?? []),
                authors: trajectory.agents?.map(\.agentName) ?? [],
                textContent: buildTextContent(
                    decisionEntries: decisionEntries(from: trajectory),
                    retrospectiveSummary: trajectory.retrospective?.summary,
                    learnings: trajectory.retrospective?.learnings ?? [],
                    chapterTitles: trajectory.chapters.map(\.title)
                )
            )

            return searchableItem(for: document, fileURL: fileURL)
        }

        let diskTrajectory = try JSONDecoder().decode(DiskTrajectory.self, from: data)
        let document = SpotlightDocument(
            id: diskTrajectory.id,
            title: diskTrajectory.task.title,
            description: diskTrajectory.task.description ?? diskTrajectory.retrospective?.summary,
            status: diskTrajectory.status,
            keywords: (diskTrajectory.tags ?? []) + diskTrajectory.agentNames,
            authors: diskTrajectory.agentNames,
            textContent: buildTextContent(
                decisionEntries: diskTrajectory.decisionEntries,
                retrospectiveSummary: diskTrajectory.retrospective?.summary,
                learnings: diskTrajectory.retrospective?.learnings ?? [],
                chapterTitles: diskTrajectory.chapters.map(\.title)
            )
        )

        return searchableItem(for: document, fileURL: fileURL)
    }

    private static func searchableItem(for document: SpotlightDocument, fileURL: URL) -> CSSearchableItem {
        let attributeSet = CSSearchableItemAttributeSet(contentType: .json)
        attributeSet.title = document.title
        attributeSet.contentDescription = document.description
        attributeSet.keywords = uniqueStrings(from: document.keywords)
        attributeSet.authorNames = uniqueStrings(from: document.authors)
        attributeSet.textContent = joinSearchText(document.textContent)
        attributeSet.relatedUniqueIdentifier = document.id
        attributeSet.contentURL = fileURL
        attributeSet.kind = document.status.capitalized
        attributeSet.thumbnailData = makeThumbnailData(title: document.title, status: document.status)

        return CSSearchableItem(
            uniqueIdentifier: document.id,
            domainIdentifier: domainIdentifier,
            attributeSet: attributeSet
        )
    }

    private static func index(items: [CSSearchableItem]) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            CSSearchableIndex.default().indexSearchableItems(items) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    private static func resolveIndexRoot(from directory: URL) -> URL {
        if directory.lastPathComponent == ".trajectories" {
            return directory
        }

        let nested = directory.appendingPathComponent(".trajectories", isDirectory: true)
        if FileManager.default.fileExists(atPath: nested.path) {
            return nested
        }

        return directory
    }

    private static func trajectoryFileURLs(in directory: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsPackageDescendants]
        ) else {
            #if DEBUG
            print("Spotlight indexing skipped: unable to enumerate \(directory.path)")
            #endif
            return []
        }

        var fileURLs: [URL] = []

        for case let fileURL as URL in enumerator {
            guard fileURL.pathExtension.lowercased() == "json" else { continue }
            fileURLs.append(fileURL)
        }

        return fileURLs
    }

    private static func decisionEntries(from trajectory: Trajectory) -> [String] {
        let explicitDecisions = (trajectory.decisions ?? []).flatMap { decision -> [String] in
            [
                decision.question,
                decision.chosen,
                decision.reasoning
            ].compactMap { value -> String? in
                guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    return nil
                }
                return value
            }
        }

        if !explicitDecisions.isEmpty {
            return explicitDecisions
        }

        return trajectory.chapters
            .flatMap(\.events)
            .filter { $0.type == .decision }
            .map(\.content)
    }

    private static func buildTextContent(
        decisionEntries: [String],
        retrospectiveSummary: String?,
        learnings: [String],
        chapterTitles: [String]
    ) -> [String] {
        var text: [String] = []
        text.append(contentsOf: decisionEntries)

        if let retrospectiveSummary,
           !retrospectiveSummary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            text.append(retrospectiveSummary)
        }

        text.append(contentsOf: learnings)
        text.append(contentsOf: chapterTitles)
        return text
    }

    private static func joinSearchText(_ values: [String]) -> String {
        uniqueStrings(from: values).joined(separator: "\n")
    }

    private static func uniqueStrings(from values: [String]) -> [String] {
        var seen = Set<String>()

        return values.compactMap { value in
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }

            let normalized = trimmed.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            guard seen.insert(normalized).inserted else { return nil }
            return trimmed
        }
    }

    private static func makeThumbnailData(title: String, status: String) -> Data? {
        let size = NSSize(width: 96, height: 96)
        let image = NSImage(size: size)

        image.lockFocus()
        defer { image.unlockFocus() }

        let rect = NSRect(origin: .zero, size: size)
        NSColor.windowBackgroundColor.setFill()
        rect.fill()

        let insetRect = rect.insetBy(dx: 10, dy: 10)
        let badgePath = NSBezierPath(roundedRect: insetRect, xRadius: 18, yRadius: 18)
        color(for: status).setFill()
        badgePath.fill()

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center

        let initials = String(title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1)).uppercased()
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 42, weight: .semibold),
            .foregroundColor: NSColor.white,
            .paragraphStyle: paragraphStyle
        ]

        initials.draw(
            in: rect.insetBy(dx: 0, dy: 22),
            withAttributes: attributes
        )

        guard let tiffData = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData) else {
            return nil
        }

        return bitmap.representation(using: .png, properties: [:])
    }

    private static func color(for status: String) -> NSColor {
        switch status.lowercased() {
        case "completed":
            return NSColor.systemGreen
        case "active":
            return NSColor.systemBlue
        case "abandoned":
            return NSColor.systemOrange
        default:
            return NSColor.systemGray
        }
    }
}

private struct SpotlightDocument {
    let id: String
    let title: String
    let description: String?
    let status: String
    let keywords: [String]
    let authors: [String]
    let textContent: [String]
}

private struct DiskTrajectory: Decodable {
    let id: String
    let task: Task
    let status: String
    let tags: [String]?
    let agents: [Agent]?
    let chapters: [Chapter]
    let retrospective: Retrospective?

    var agentNames: [String] {
        (agents ?? []).compactMap(\.spotlightName)
    }

    var decisionEntries: [String] {
        let retrospectiveDecisions = (retrospective?.decisions ?? []).flatMap(\.searchText)
        let chapterDecisions = chapters.flatMap(\.decisionEntries)
        return retrospectiveDecisions + chapterDecisions
    }

    struct Task: Decodable {
        let title: String
        let description: String?
    }

    struct Agent: Decodable {
        let name: String?
        let agentName: String?

        var spotlightName: String? {
            name ?? agentName
        }
    }

    struct Chapter: Decodable {
        let title: String
        let events: [Event]

        var decisionEntries: [String] {
            events
                .filter { $0.type == "decision" }
                .flatMap(\.searchText)
        }
    }

    struct Event: Decodable {
        let type: String
        let content: String?
        let raw: DecisionPayload?

        var searchText: [String] {
            if let raw {
                let values = raw.searchText
                if !values.isEmpty {
                    return values
                }
            }

            if let content,
               !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return [content]
            }

            return []
        }
    }

    struct Retrospective: Decodable {
        let summary: String?
        let learnings: [String]?
        let decisions: [DecisionPayload]?
    }

    struct DecisionPayload: Decodable {
        let question: String?
        let chosen: String?
        let reasoning: String?

        var searchText: [String] {
            [question, chosen, reasoning].compactMap { value in
                guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    return nil
                }
                return value
            }
        }
    }
}
