// Trail Viewer — macOS app entry point

import SwiftUI

@main
struct TrailViewerApp: App {
    var body: some Scene {
        WindowGroup("Trail Viewer") {
            Text("Trail Viewer")
                .frame(minWidth: 900, minHeight: 600)
                .preferredColorScheme(.light)
        }
        .defaultSize(width: 1200, height: 800)
        .windowResizability(.contentMinSize)
    }
}
