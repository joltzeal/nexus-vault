import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("nexus-vault.show-media-content") private var showsMediaContent = true
    @State private var isSigningOut = false
    @State private var isPickingDefaultVault = false

    var body: some View {
        NavigationStack {
            ZStack {
                NexusBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        SettingsAccountHeader()

                        SettingsGroup(title: "保存") {
                            Button {
                                isPickingDefaultVault = true
                            } label: {
                                SettingsNavigationRow(
                                    title: "默认 Vault",
                                    detail: appModel.selectedVaultTitle ?? "未选择",
                                    systemImage: "archivebox.fill",
                                    color: NexusPalette.jade,
                                    showsChevron: true
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        SettingsGroup(title: "显示与内容") {
                            HStack(spacing: 12) {
                                SettingsRowLabel(
                                    title: "显示媒体内容",
                                    detail: "在资源列表中展示图片和视频预览",
                                    systemImage: "play.rectangle.fill",
                                    color: Color(red: 92 / 255, green: 185 / 255, blue: 240 / 255)
                                )
                                Spacer(minLength: 8)
                                Toggle("显示媒体内容", isOn: $showsMediaContent)
                                    .labelsHidden()
                                    .tint(NexusPalette.jade)
                            }
                            .padding(.horizontal, 12)
                            .frame(minHeight: 68)
                        }

                        SettingsGroup(title: "连接") {
                            SettingsNavigationRow(
                                title: "服务器",
                                detail: AppGroup.productionBaseURL.host ?? "nexus-vault.stacklabs.space",
                                systemImage: "network",
                                color: Color(red: 155 / 255, green: 140 / 255, blue: 255 / 255),
                                showsChevron: false
                            )
                        }

                        Button(role: .destructive) {
                            isSigningOut = true
                            Task {
                                await appModel.signOut()
                                isSigningOut = false
                            }
                        } label: {
                            HStack {
                                Spacer()
                                if isSigningOut {
                                    ProgressView()
                                        .tint(.red)
                                }
                                Text("退出登录")
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                            }
                            .frame(height: 46)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.red.opacity(0.9))
                        .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .stroke(.red.opacity(0.24), lineWidth: 1)
                        }
                        .disabled(isSigningOut)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $isPickingDefaultVault) {
                DefaultVaultPicker()
                    .environmentObject(appModel)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
        .background(NexusBackground())
    }
}

private struct SettingsAccountHeader: View {
    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: "archivebox.fill")
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(NexusPalette.jade)
                .frame(width: 48, height: 48)
                .background(NexusPalette.jade.opacity(0.13), in: RoundedRectangle(cornerRadius: 9, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text("Nexus Vault")
                    .font(.headline)
                    .foregroundStyle(NexusPalette.foreground)
                Text("你的私有知识空间")
                    .font(.subheadline)
                    .foregroundStyle(NexusPalette.muted)
            }
            Spacer()
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.white.opacity(0.1), lineWidth: 1)
        }
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(NexusPalette.dim)
                .textCase(.uppercase)
                .padding(.leading, 5)

            VStack(spacing: 0) {
                content
            }
            .background(NexusPalette.ink800.opacity(0.86), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(NexusPalette.line.opacity(0.72), lineWidth: 1)
            }
        }
    }
}

private struct SettingsNavigationRow: View {
    let title: String
    let detail: String
    let systemImage: String
    let color: Color
    let showsChevron: Bool

    var body: some View {
        HStack(spacing: 11) {
            SettingsRowLabel(title: title, detail: detail, systemImage: systemImage, color: color)
            Spacer(minLength: 8)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NexusPalette.dim)
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 61)
    }
}

private struct DefaultVaultPicker: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(appModel.vaults) { vault in
                Button {
                    appModel.selectVault(vault)
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "archivebox.fill")
                            .foregroundStyle(NexusPalette.jade)
                            .frame(width: 30, height: 30)
                            .background(NexusPalette.jade.opacity(0.13), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(vault.title)
                                .foregroundStyle(NexusPalette.foreground)
                            Text("\(vault.resourceCount) 项资源")
                                .font(.caption)
                                .foregroundStyle(NexusPalette.dim)
                        }
                        Spacer()
                        if appModel.selectedVaultID == vault.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(NexusPalette.jade)
                        }
                    }
                }
                .buttonStyle(.plain)
                .listRowBackground(NexusPalette.ink800)
            }
            .scrollContentBackground(.hidden)
            .background(NexusBackground())
            .navigationTitle("默认 Vault")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                        .foregroundStyle(NexusPalette.jade)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct SettingsRowLabel: View {
    let title: String
    let detail: String
    let systemImage: String
    let color: Color

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 30, height: 30)
                .background(color.opacity(0.13), in: RoundedRectangle(cornerRadius: 7, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(NexusPalette.foreground)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(NexusPalette.dim)
                    .lineLimit(1)
            }
        }
    }
}
