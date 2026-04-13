Created [FileDetailModal.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/FileDetailModal.swift).

Summary:
- Added the complete `FileDetailModal` SwiftUI implementation at `trail-viewer/Sources/Views/FileDetailModal.swift`.
- Included the `FileChange` model in the same file so the implementation is self-contained.
- Included the private `CodeContentView`, keyboard handling, helper methods, and preview data from the spec.

Verification:
- Confirmed the file exists on disk.
- `swift build` for the package currently fails due pre-existing unrelated project errors elsewhere (`Typography` references, `#Preview` macro/plugin issues, missing chat types), not because this file was missing.
