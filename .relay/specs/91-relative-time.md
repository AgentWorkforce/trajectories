# RelativeTimeFormatter.swift

```swift
import Foundation

struct RelativeTimeFormatter {

    // MARK: - Standard Format

    static func format(_ date: Date) -> String {
        let seconds = abs(Date().timeIntervalSince(date))

        if seconds < 60 {
            return "just now"
        } else if seconds < 120 {
            return "1m ago"
        } else if seconds < 3600 {
            let minutes = Int(seconds / 60)
            return "\(minutes)m ago"
        } else if seconds < 7200 {
            return "1h ago"
        } else if seconds < 86400 {
            let hours = Int(seconds / 3600)
            return "\(hours)h ago"
        } else if seconds < 172800 {
            return "yesterday"
        } else if seconds < 604800 {
            let days = Int(seconds / 86400)
            return "\(days) days ago"
        } else if seconds < 31536000 {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM yyyy"
            return formatter.string(from: date)
        }
    }

    // MARK: - Compact Format

    static func formatCompact(_ date: Date) -> String {
        let seconds = abs(Date().timeIntervalSince(date))

        if seconds < 60 {
            return "now"
        } else if seconds < 3600 {
            let minutes = Int(seconds / 60)
            return "\(minutes)m"
        } else if seconds < 86400 {
            let hours = Int(seconds / 3600)
            return "\(hours)h"
        } else if seconds < 604800 {
            let days = Int(seconds / 86400)
            return "\(days)d"
        } else if seconds < 31536000 {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM yy"
            return formatter.string(from: date)
        }
    }

    // MARK: - Verbose Format

    static func formatVerbose(_ date: Date) -> String {
        let seconds = abs(Date().timeIntervalSince(date))

        if seconds < 60 {
            return "just now"
        } else if seconds < 3600 {
            let minutes = Int(seconds / 60)
            return minutes == 1 ? "1 minute ago" : "\(minutes) minutes ago"
        } else if seconds < 86400 {
            let hours = Int(seconds / 3600)
            return hours == 1 ? "1 hour ago" : "\(hours) hours ago"
        } else if seconds < 604800 {
            let days = Int(seconds / 86400)
            if days == 1 {
                return "yesterday"
            }
            return "\(days) days ago"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMMM d, yyyy"
            return formatter.string(from: date)
        }
    }
}
```
