 80 |     private init() {}
    |             `- note: found this candidate 
 81 | 
 82 |     func show(message: String, style: ToastStyle = .info) {

/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Services/ClipboardService.swift:23:7: note: found this candidate 
21 | // MARK: - Toast Manager
22 | 
23 | class ToastManager: ObservableObject {
   |       `- note: found this candidate 
24 |     static let shared = ToastManager()
25 |     @Published var message: String?

/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/TrailViewerApp.swift:128:33: error: cannot infer contextual base in reference to member 'success'
126 |                     ToastManager.shared.show(
127 |                         message: "AI assistant set to \(cli.name)",
128 |                         style: .success
    |                                 `- error: cannot infer contextual base in reference to member 'success'
129 |                     )
130 |                 } label: {
