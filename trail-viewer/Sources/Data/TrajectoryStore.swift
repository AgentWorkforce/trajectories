import Foundation
import SwiftUI

@Observable
class TrajectoryStore {

    // MARK: - Properties

    private(set) var trajectories: [TrajectorySummary] = []
    var selectedTrajectory: Trajectory? = nil
    private(set) var stats: TrajectoryStats = .empty
    private(set) var isLoading: Bool = false
    private(set) var isLoadingDetail: Bool = false
    private(set) var error: APIError? = nil
    var searchText: String = ""
    var statusFilter: TrajectoryStatus? = nil
    var selectedTags: Set<String> = []

    private let apiClient: APIClient

    // MARK: - Initializer

    init(apiClient: APIClient = APIClient()) {
        self.apiClient = apiClient
    }

    // MARK: - Computed Properties

    var filteredTrajectories: [TrajectorySummary] {
        var result = trajectories

        if !searchText.isEmpty {
            result = result.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
        }

        if let statusFilter {
            result = result.filter { $0.status == statusFilter }
        }

        if !selectedTags.isEmpty {
            result = result.filter { !selectedTags.isDisjoint(with: $0.tags) }
        }

        return result
    }

    var allTags: [String] {
        let tagSet = trajectories.reduce(into: Set<String>()) { result, trajectory in
            result.formUnion(trajectory.tags)
        }
        return tagSet.sorted()
    }

    // MARK: - Methods

    func loadTrajectories() async {
        isLoading = true
        error = nil

        do {
            trajectories = try await apiClient.listTrajectories(
                status: statusFilter,
                search: searchText.isEmpty ? nil : searchText,
                tags: selectedTags.isEmpty ? nil : Array(selectedTags)
            )
            stats = try await apiClient.getStats()
        } catch let apiError as APIError {
            error = apiError
        } catch {
            self.error = .networkError(error)
        }

        isLoading = false
    }

    func selectTrajectory(id: String) async {
        isLoadingDetail = true

        do {
            selectedTrajectory = try await apiClient.getTrajectory(id: id)
        } catch let apiError as APIError {
            error = apiError
        } catch {
            self.error = .networkError(error)
        }

        isLoadingDetail = false
    }

    func clearSelection() {
        selectedTrajectory = nil
    }

    func refreshStats() async {
        do {
            stats = try await apiClient.getStats()
        } catch {
            // Silently ignore stats refresh errors
        }
    }
}
