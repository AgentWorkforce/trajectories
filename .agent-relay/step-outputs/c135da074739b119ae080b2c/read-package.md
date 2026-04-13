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
    targets: [
        .executableTarget(
            name: "TrailViewer",
            path: "Sources"
        )
    ]
)
