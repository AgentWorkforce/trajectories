import SwiftUI

// MARK: - Status Filter Enum

enum StatusFilter: String, CaseIterable {
    case all
    case active
    case completed
    case abandoned

    var displayName: String {
        rawValue.capitalized
    }

    var color: Color {
        switch self {
        case .all:        return Theme.blue
        case .active:     return Theme.green
        case .completed:  return Theme.blue
        case .abandoned:  return Theme.textTertiary
        }
    }
}

// MARK: - FilterBar View

struct FilterBar: View {
    @Binding var searchText: String
    @Binding var statusFilter: StatusFilter

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            // Search field
            HStack(spacing: Theme.spacingSM) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(Theme.textTertiary)

                TextField("Search trajectories...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(Typography.body)
                    .foregroundColor(Theme.textPrimary)
            }
            .padding(Theme.spacingSM)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Theme.cardBg)
            )

            // Status pills row
            HStack(spacing: Theme.spacingSM) {
                ForEach(StatusFilter.allCases, id: \.self) { filter in
                    statusPill(for: filter)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Theme.spacingLG)
    }

    // MARK: - Status Pill

    @ViewBuilder
    private func statusPill(for filter: StatusFilter) -> some View {
        let isSelected = statusFilter == filter

        Text(filter.displayName)
            .font(Typography.caption)
            .foregroundColor(isSelected ? .white : Theme.textSecondary)
            .padding(.horizontal, Theme.spacingSM)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(isSelected ? filter.color : Theme.cardBg)
            )
            .contentShape(Capsule())
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.2)) {
                    statusFilter = filter
                }
            }
    }
}

// MARK: - Preview

struct FilterBar_Previews: PreviewProvider {
    static var previews: some View {
        FilterBar(
            searchText: .constant(""),
            statusFilter: .constant(.all)
        )
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
