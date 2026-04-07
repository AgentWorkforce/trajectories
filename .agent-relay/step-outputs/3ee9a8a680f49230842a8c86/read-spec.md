# Animations.swift — Complete File Contents

```swift
import SwiftUI

// MARK: - Animation & Transition Constants

enum Animations {

    // MARK: Animation Constants

    static let easeIn: Animation = .easeIn(duration: 0.15)
    static let easeOut: Animation = .easeOut(duration: 0.2)
    static let spring: Animation = .spring(response: 0.3, dampingFraction: 0.8)
    static let collapse: Animation = .easeInOut(duration: 0.25)
    static let shimmer: Animation = .linear(duration: 1.5).repeatForever(autoreverses: false)
    static let gentleBounce: Animation = .spring(response: 0.4, dampingFraction: 0.7)
    static let quickFade: Animation = .easeOut(duration: 0.12)

    // MARK: Transition Helpers

    static let slideIn: AnyTransition = .move(edge: .trailing).combined(with: .opacity)
    static let slideOut: AnyTransition = .move(edge: .leading).combined(with: .opacity)
    static let fadeScale: AnyTransition = .opacity.combined(with: .scale(scale: 0.95))
    static let cardAppear: AnyTransition = .opacity.combined(with: .offset(y: 8))
}

// MARK: - Shimmer Effect

struct ShimmerEffect: ViewModifier {
    @State private var isAnimating = false

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    gradient: Gradient(colors: [
                        .clear,
                        Color.white.opacity(0.3),
                        .clear
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: isAnimating ? 200 : -200)
                .animation(Animations.shimmer, value: isAnimating)
            )
            .clipped()
            .onAppear {
                isAnimating = true
            }
    }
}

// MARK: - View Extension

extension View {
    func shimmer() -> some View {
        modifier(ShimmerEffect())
    }
}
```
