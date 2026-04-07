import Foundation
import SwiftUI

@Observable
class CLISettingsStore {

    // MARK: - Static

    static let supportedChatCLIs: [String] = ["claude", "codex", "opencode", "gemini", "aider"]
    private static let userDefaultsKey = "CLISettingsStore.preferredCLI"
    private static let detectedCLIsKey = "CLISettingsStore.detectedCLIs"

    // MARK: - Properties

    private(set) var detectedCLIs: [CLIInfo] = []

    var preferredCLI: String? {
        didSet { persistPreferredCLI() }
    }

    private(set) var isRefreshing: Bool = false

    // MARK: - Computed

    var detectedChatCLIs: [CLIInfo] {
        detectedCLIs.filter { Self.supportedChatCLIs.contains($0.name) }
    }

    var effectiveCLI: String? {
        if let preferred = preferredCLI,
           detectedChatCLIs.contains(where: { $0.name == preferred }) {
            return preferred
        }
        return detectedChatCLIs.first?.name
    }

    var effectiveCLILabel: String {
        if let cli = effectiveCLI {
            return String(cli.prefix(1)).uppercased() + cli.dropFirst()
        }
        return "None detected"
    }

    var availability: [CLIAvailability] {
        CLIDetector.knownCLIs.map { name in
            let info = detectedCLIs.first { $0.name == name }
            let isSupportedForChat = Self.supportedChatCLIs.contains(name)
            return CLIAvailability(
                name: name,
                info: info,
                isSupportedForChat: isSupportedForChat
            )
        }
    }

    // MARK: - Init

    init() {
        self.preferredCLI = UserDefaults.standard.string(forKey: Self.userDefaultsKey)
        self.detectedCLIs = loadCachedCLIs()
    }

    // MARK: - Methods

    func setPreferredCLI(_ cli: String?) {
        preferredCLI = cli
    }

    func refreshDetectedCLIs() async {
        isRefreshing = true
        let detected = await CLIDetector.detectAll()
        detectedCLIs = detected
        if let data = try? JSONEncoder().encode(detected) {
            UserDefaults.standard.set(data, forKey: Self.detectedCLIsKey)
        }
        if let preferred = preferredCLI,
           !detected.contains(where: { $0.name == preferred }) {
            preferredCLI = nil
        }
        isRefreshing = false
    }

    // MARK: - Private

    private func persistPreferredCLI() {
        if let cli = preferredCLI {
            UserDefaults.standard.set(cli, forKey: Self.userDefaultsKey)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.userDefaultsKey)
        }
    }

    private func loadCachedCLIs() -> [CLIInfo] {
        guard let data = UserDefaults.standard.data(forKey: Self.detectedCLIsKey) else {
            return []
        }
        return (try? JSONDecoder().decode([CLIInfo].self, from: data)) ?? []
    }
}
