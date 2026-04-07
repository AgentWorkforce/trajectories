import SwiftUI

// MARK: - SectionHeader

struct SectionHeader: View {
    let title: String
    var icon: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack(spacing: 6) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14))
                        .foregroundColor(Theme.blue)
                }
                Text(title)
                    .sectionTitle()
            }
            RuleLine()
        }
        .padding(.bottom, Theme.spacingSM)
    }
}

// MARK: - RuleLine

struct RuleLine: View {
    var body: some View {
        Rectangle()
            .fill(Theme.borderLight)
            .frame(maxWidth: .infinity)
            .frame(height: 0.5)
    }
}

// MARK: - OrnamentDivider

struct OrnamentDivider: View {
    var body: some View {
        HStack(spacing: 12) {
            RuleLine()
            Text("\u{25C6}")
                .font(.system(size: 10))
                .foregroundColor(Theme.textTertiary)
            RuleLine()
        }
        .padding(.vertical, Theme.spacingMD)
    }
}

// MARK: - Previews

#Preview("SectionHeader") {
    VStack(spacing: 20) {
        SectionHeader(title: "Overview", icon: "doc.text")
        SectionHeader(title: "Steps")
    }
    .padding()
    .frame(width: 400)
}

#Preview("OrnamentDivider") {
    VStack {
        Text("Above")
        OrnamentDivider()
        Text("Below")
    }
    .padding()
    .frame(width: 400)
}
