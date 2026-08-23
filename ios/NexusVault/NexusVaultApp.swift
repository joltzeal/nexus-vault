import SwiftUI
import Foundation

@main
struct NexusVaultApp: App {
    @StateObject private var appModel = AppModel()

    init() {
        URLCache.shared = URLCache(
            memoryCapacity: 64 * 1024 * 1024,
            diskCapacity: 512 * 1024 * 1024,
            diskPath: "NexusVaultMedia"
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .preferredColorScheme(.dark)
                .tint(NexusPalette.jade)
        }
    }
}
