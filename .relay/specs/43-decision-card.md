# DecisionCard.swift — Complete Implementation Spec

**Design direction**: "The Beautiful Notebook" — light mode, book-like reading experience.
**Location**: `trail-viewer/Sources/Views/Detail/Events/DecisionCard.swift`

## Complete Swift File

```swift
import SwiftUI

// MARK: - DecisionCard

struct DecisionCard: View {
    let decision: Decision

    @State private var showAlternatives: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RuleLine()

            HStack(alignment: .top, spacing: 0) {
                // Yellow left border
                Rectangle()
                    .fill(Theme.yellow)
                    .frame(width: 3)

                VStack(alignment: .leading, spacing: Theme.spacingBase) {

                    // 1. DECISION label
                    Text("DECISION")
                        .modifier(Typography.TrailLabel())
                        .foregroundColor(Theme.blue)

                    // 2. Question
                    Text(decision.question)
                        .modifier(Typography.SectionTitle())
                        .foregroundColor(Theme.textPrimary)

                    // 3. Chosen answer in highlighted BookCard
                    BookCard(isHighlighted: true) {
                        HStack(spacing: Theme.spacingSM) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Theme.blue)
                                .font(.system(size: 16))
                            Text(decision.chosen)
                                .modifier(Typography.BodyStyle())
                                .foregroundColor(Theme.textPrimary)
                        }
                    }

                    // 4. Reasoning (if present)
                    if let reasoning = decision.reasoning {
                        Text(reasoning)
                            .modifier(Typography.BodyStyle())
                            .italic()
                            .foregroundColor(Theme.textSecondary)
                    }

                    // 5. Alternatives (collapsible)
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
                                    Text(showAlternatives
                                         ? "Hide alternatives"
                                         : "Show \(alternatives.count) alternative\(alternatives.count == 1 ? "" : "s")")
                                        .modifier(Typography.BodySmall())
                                }
                                .foregroundColor(Theme.textTertiary)
                            }
                            .buttonStyle(.plain)

                            if showAlternatives {
                                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                                    ForEach(alternatives, id: \.option) { alt in
                                        HStack(alignment: .firstTextBaseline, spacing: Theme.spacingSM) {
                                            Image(systemName: "circle.fill")
                                                .font(.system(size: 4))
                                                .foregroundColor(Theme.textTertiary)
                                                .padding(.top, 5)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(alt.option)
                                                    .modifier(Typography.BodyStyle())
                                                    .foregroundColor(Theme.textTertiary)
                                                if let prosOrCons = alt.prosOrCons {
                                                    Text(prosOrCons)
                                                        .modifier(Typography.BodySmall())
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

                    // 6. Confidence bar
                    if let confidence = decision.confidence {
                        VStack(alignment: .leading, spacing: Theme.spacingXS) {
                            HStack(alignment: .firstTextBaseline, spacing: Theme.spacingXS) {
                                Text("\(Int(confidence * 100))%")
                                    .font(.system(size: 22, weight: .semibold, design: .serif))
                                    .foregroundColor(Theme.textPrimary)
                                Text("confident")
                                    .modifier(Typography.Caption())
                                    .foregroundColor(Theme.textSecondary)
                            }

                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    // Track
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(Theme.borderLight)
                                        .frame(height: 6)

                                    // Fill
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(
                                            LinearGradient(
                                                colors: [Theme.yellowLight, Theme.blue],
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                        .frame(width: geo.size.width * confidence, height: 6)
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
```

## Design Notes

- Uses actual `Decision` and `Alternative` models from `TrajectoryModels.swift`
- Uses existing `BookCard` component (isHighlighted: true for warm yellow background)
- Uses existing `RuleLine` from `SectionElements.swift`
- Yellow left border (3pt `Theme.yellow` / #f2d479) runs the full height of the card content
- Confidence bar uses `LinearGradient` from `Theme.yellowLight` to `Theme.blue`
- All spacing, colors, and typography reference existing Theme/Typography tokens
- Alternatives section animated with `.easeInOut(duration: 0.25)`
- Preview includes a rich mock with 3 alternatives, reasoning, and 85% confidence
- `BodySmall` typography modifier used for alternative pros/cons sub-text
- `Typography.TrailLabel` used for the "DECISION" label (10pt bold uppercase with tracking)
