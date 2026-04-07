import SwiftUI

// MARK: - DecisionCard

struct DecisionCard: View {
    let decision: Decision

    @State private var showAlternatives = false

    private var confidenceValue: Double {
        min(max(decision.confidence ?? 0, 0), 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RuleLine()

            HStack(alignment: .top, spacing: 0) {
                Rectangle()
                    .fill(Theme.yellow)
                    .frame(width: 3)

                VStack(alignment: .leading, spacing: Theme.spacingBase) {
                    Text("DECISION")
                        .trailLabel()
                        .foregroundColor(Theme.blue)

                    Text(decision.question)
                        .sectionTitle()
                        .foregroundColor(Theme.textPrimary)

                    BookCard(isHighlighted: true) {
                        HStack(spacing: Theme.spacingSM) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundColor(Theme.blue)

                            Text(decision.chosen)
                                .bodyStyle()
                                .foregroundColor(Theme.textPrimary)
                        }
                    }

                    if let reasoning = decision.reasoning {
                        Text(reasoning)
                            .bodyStyle()
                            .italic()
                            .foregroundColor(Theme.textSecondary)
                    }

                    if let alternatives = decision.alternatives, !alternatives.isEmpty {
                        VStack(alignment: .leading, spacing: Theme.spacingSM) {
                            Button {
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    showAlternatives.toggle()
                                }
                            } label: {
                                HStack(spacing: Theme.spacingXS) {
                                    Image(systemName: showAlternatives ? "chevron.down" : "chevron.right")
                                        .font(.system(size: 10, weight: .semibold))

                                    Text(
                                        showAlternatives
                                            ? "Hide alternatives"
                                            : "Show \(alternatives.count) alternative\(alternatives.count == 1 ? "" : "s")"
                                    )
                                    .bodySmall()
                                }
                                .foregroundColor(Theme.textTertiary)
                            }
                            .buttonStyle(.plain)

                            if showAlternatives {
                                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                                    ForEach(alternatives, id: \.option) { alt in
                                        HStack(alignment: .top, spacing: Theme.spacingSM) {
                                            Image(systemName: "circle.fill")
                                                .font(.system(size: 4))
                                                .foregroundColor(Theme.textTertiary)
                                                .padding(.top, 6)

                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(alt.option)
                                                    .bodyStyle()
                                                    .foregroundColor(Theme.textTertiary)

                                                if let prosOrCons = alt.prosOrCons {
                                                    Text(prosOrCons)
                                                        .bodySmall()
                                                        .foregroundColor(Theme.textTertiary)
                                                        .opacity(0.7)
                                                }
                                            }
                                        }
                                    }
                                }
                                .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                        }
                    }

                    if decision.confidence != nil {
                        VStack(alignment: .leading, spacing: Theme.spacingXS) {
                            HStack(alignment: .firstTextBaseline, spacing: Theme.spacingXS) {
                                Text("\(Int(confidenceValue * 100))%")
                                    .font(.system(size: 22, weight: .semibold, design: .serif))
                                    .foregroundColor(Theme.textPrimary)

                                Text("confident")
                                    .caption()
                                    .foregroundColor(Theme.textSecondary)
                            }

                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(Theme.borderLight)
                                        .frame(height: 6)

                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(
                                            LinearGradient(
                                                colors: [Theme.yellowLight, Theme.blue],
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                        .frame(width: geo.size.width * confidenceValue, height: 6)
                                }
                            }
                            .frame(height: 6)
                        }
                    }
                }
                .padding(Theme.spacingLG)
            }

            RuleLine()
        }
    }
}

// MARK: - Preview

#Preview("Decision Card") {
    ScrollView {
        DecisionCard(
            decision: Decision(
                id: "dec-001",
                question: "Which database should we use for the event store?",
                chosen: "PostgreSQL with JSONB columns for flexible event payloads",
                alternatives: [
                    Alternative(
                        option: "MongoDB for native document storage",
                        prosOrCons: "Good for unstructured data but adds operational complexity",
                        rejected: true
                    ),
                    Alternative(
                        option: "SQLite for simplicity",
                        prosOrCons: "Lightweight but lacks concurrent write support at scale",
                        rejected: true
                    ),
                    Alternative(
                        option: "DynamoDB for managed scaling",
                        prosOrCons: "Fully managed but vendor lock-in and higher cost",
                        rejected: true
                    ),
                ],
                confidence: 0.85,
                reasoning: "PostgreSQL provides the best balance of relational integrity and schema flexibility through JSONB, with a mature ecosystem and strong community support.",
                timestamp: Date()
            )
        )
        .padding(Theme.spacingLG)
    }
    .frame(width: 600, height: 600)
    .background(Theme.pageBg)
}
