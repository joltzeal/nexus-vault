import SwiftUI

enum NexusPalette {
    static let ink900 = Color(red: 12 / 255, green: 17 / 255, blue: 22 / 255)
    static let ink850 = Color(red: 15 / 255, green: 22 / 255, blue: 29 / 255)
    static let ink800 = Color(red: 19 / 255, green: 28 / 255, blue: 36 / 255)
    static let ink700 = Color(red: 31 / 255, green: 44 / 255, blue: 56 / 255)
    static let line = Color(red: 38 / 255, green: 54 / 255, blue: 66 / 255)
    static let foreground = Color(red: 230 / 255, green: 237 / 255, blue: 243 / 255)
    static let muted = Color(red: 155 / 255, green: 176 / 255, blue: 192 / 255)
    static let dim = Color(red: 95 / 255, green: 117 / 255, blue: 133 / 255)
    static let jade = Color(red: 63 / 255, green: 216 / 255, blue: 176 / 255)
    static let jadeInk = Color(red: 4 / 255, green: 20 / 255, blue: 15 / 255)
    static let vaultColors: [Color] = [
        jade,
        Color(red: 92 / 255, green: 185 / 255, blue: 240 / 255),
        Color(red: 155 / 255, green: 140 / 255, blue: 255 / 255),
        Color(red: 232 / 255, green: 179 / 255, blue: 74 / 255),
        Color(red: 240 / 255, green: 105 / 255, blue: 122 / 255),
    ]

    static func accent(for index: Int) -> Color {
        vaultColors[index % vaultColors.count]
    }
}

struct NexusBackground: View {
    var body: some View {
        ZStack {
            NexusPalette.ink900
            RadialGradient(
                colors: [NexusPalette.jade.opacity(0.14), .clear],
                center: .topTrailing,
                startRadius: 20,
                endRadius: 420
            )
            RadialGradient(
                colors: [Color.blue.opacity(0.07), .clear],
                center: .bottomLeading,
                startRadius: 10,
                endRadius: 350
            )
        }
        .ignoresSafeArea()
    }
}

struct RootView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        switch appModel.sessionState {
        case .checking:
            ProgressView("正在连接 Nexus Vault")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(NexusPalette.muted)
                .background(NexusBackground())
        case .signedOut:
            LoginView()
        case .signedIn:
            MainTabView()
        }
    }
}

private struct MainTabView: View {
    var body: some View {
        TabView {
            VaultListView()
                .tabItem {
                    Label("Vault", systemImage: "archivebox")
                }

            StarredResourcesView()
                .tabItem {
                    Label("收藏", systemImage: "star")
                }

            ReadLaterResourcesView()
                .tabItem {
                    Label("稍后", systemImage: "clock")
                }

            SettingsView()
                .tabItem {
                    Label("设置", systemImage: "gearshape")
                }
        }
        .tint(NexusPalette.jade)
        .toolbarBackground(NexusPalette.ink850, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}
