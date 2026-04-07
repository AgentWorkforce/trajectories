import SwiftUI

// MARK: - Toast Style

enum ToastStyle {
    case info
    case success
    case error

    var color: Color {
        switch self {
        case .info:    return Theme.blue
        case .success: return Theme.success
        case .error:   return Theme.error
        }
    }

    var backgroundColor: Color {
        switch self {
        case .info:    return Theme.blueMuted
        case .success: return Theme.successBg
        case .error:   return Theme.errorBg
        }
    }

    var icon: String {
        switch self {
        case .info:    return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .error:   return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Toast Item

struct ToastItem: Identifiable {
    let id: UUID = UUID()
    let message: String
    let style: ToastStyle
}

// MARK: - Toast View

struct ToastView: View {
    let message: String
    let style: ToastStyle

    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: style.icon)
                .font(.system(size: 14))
                .foregroundColor(style.color)

            Text(message)
                .bodySmall()
                .foregroundColor(Theme.textPrimary)
        }
        .padding(.horizontal, Theme.spacingBase)
        .padding(.vertical, Theme.spacingSM)
        .background(style.backgroundColor)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .strokeBorder(style.color.opacity(0.3), lineWidth: 0.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 4)
        .transition(Animations.fadeScale)
    }
}

// MARK: - Toast Manager

@Observable
class ToastManager {
    static let shared = ToastManager()

    var toasts: [ToastItem] = []

    private init() {}

    func show(message: String, style: ToastStyle = .info) {
        let item = ToastItem(message: message, style: style)
        withAnimation(Animations.spring) {
            toasts.append(item)
        }
        scheduleDismiss(id: item.id)
    }

    func dismiss(_ id: UUID) {
        withAnimation(Animations.spring) {
            toasts.removeAll { $0.id == id }
        }
    }

    private func scheduleDismiss(id: UUID) {
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(3.5))
            dismiss(id)
        }
    }
}

// MARK: - Toast Container

struct ToastContainer: View {
    @State private var manager = ToastManager.shared

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            ForEach(manager.toasts) { toast in
                ToastView(message: toast.message, style: toast.style)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .padding(Theme.spacingMD)
        .animation(Animations.spring, value: manager.toasts.map(\.id))
        .allowsHitTesting(false)
    }
}

// MARK: - Preview

#Preview("Toast Styles") {
    ZStack {
        Color(Theme.pageBg).ignoresSafeArea()

        VStack(spacing: Theme.spacingSM) {
            ToastView(message: "Trajectory loaded successfully.", style: .info)
            ToastView(message: "Changes saved.", style: .success)
            ToastView(message: "Failed to parse trajectory file.", style: .error)
        }
        .padding(Theme.spacingLG)
    }
    .frame(width: 400, height: 300)
}
