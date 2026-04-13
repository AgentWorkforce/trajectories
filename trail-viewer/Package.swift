// swift-tools-version: 5.9
// Package.swift - Trail Viewer Mac App
//
// A native macOS application for viewing and exploring
// agent workflow trajectories built with SwiftUI.

import PackageDescription

let package = Package(
    name: "TrailViewer",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [
        .package(url: "https://github.com/AgentWorkforce/relay.git", branch: "main")
    ],
    targets: [
        .executableTarget(
            name: "TrailViewer",
            dependencies: [
                .product(name: "AgentRelaySDK", package: "relay")
            ],
            path: "Sources",
            exclude: ["Info.plist"],
            linkerSettings: [
                .linkedFramework("CoreSpotlight")
            ]
        )
    ]
)
