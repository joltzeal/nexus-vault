import SwiftUI

struct VaultListView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var searchText = ""

    private var filteredVaults: [VaultSummary] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return appModel.vaults }
        return appModel.vaults.filter {
            $0.title.localizedCaseInsensitiveContains(query) ||
                $0.description.localizedCaseInsensitiveContains(query)
        }
    }

    private var featuredVaults: [(offset: Int, element: VaultSummary)] {
        Array(filteredVaults.prefix(6).enumerated())
    }

    private var atlasVaults: [(offset: Int, element: VaultSummary)] {
        Array(filteredVaults.enumerated())
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NexusBackground()

                if appModel.vaults.isEmpty && !appModel.isLoadingVaults {
                    ContentUnavailableView {
                        Label("还没有 Vault", systemImage: "archivebox")
                    } description: {
                        Text("请先在 Web 端创建一个 Vault。")
                    }
                    .foregroundStyle(NexusPalette.muted)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            VaultTitleHeader(count: appModel.vaults.count)
                                .padding(.horizontal, 17)
                                .padding(.top, 8)

                            if filteredVaults.isEmpty {
                                ContentUnavailableView.search(text: searchText)
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 90)
                            } else {
                                VaultSectionTitle(title: "继续整理", detail: "最近访问")
                                    .padding(.top, 20)

                                ScrollView(.horizontal, showsIndicators: false) {
                                    LazyHStack(spacing: 10) {
                                        ForEach(featuredVaults, id: \.element.id) { item in
                                            NavigationLink {
                                                VaultDetailView(vault: item.element)
                                            } label: {
                                                FeaturedVaultCard(vault: item.element, index: item.offset)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(.horizontal, 16)
                                }
                                .padding(.top, 9)

                                VaultSectionTitle(
                                    title: searchText.isEmpty ? "全部 Vault" : "搜索结果",
                                    detail: "按最近活动"
                                )
                                .padding(.top, 24)

                                LazyVGrid(
                                    columns: [
                                        GridItem(.flexible(), spacing: 9),
                                        GridItem(.flexible(), spacing: 9),
                                    ],
                                    spacing: 9
                                ) {
                                    ForEach(atlasVaults, id: \.element.id) { item in
                                        NavigationLink {
                                            VaultDetailView(vault: item.element)
                                        } label: {
                                            AtlasVaultCard(vault: item.element, index: item.offset)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.top, 9)
                            }
                        }
                        .padding(.bottom, 32)
                    }
                    .refreshable {
                        try? await appModel.loadVaults()
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { try? await appModel.loadVaults() }
                    } label: {
                        Image(systemName: appModel.isLoadingVaults ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                    }
                    .disabled(appModel.isLoadingVaults)
                    .accessibilityLabel("刷新 Vault")
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .searchable(text: $searchText, prompt: "搜索 Vault、Space 或资源")
            .overlay {
                if appModel.isLoadingVaults && appModel.vaults.isEmpty {
                    ProgressView()
                        .tint(NexusPalette.jade)
                }
            }
        }
        .background(NexusBackground())
    }
}

private struct VaultTitleHeader: View {
    let count: Int

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Vaults")
                    .font(.system(size: 31, weight: .bold, design: .rounded))
                    .foregroundStyle(NexusPalette.foreground)
                Text("\(count) 个知识空间")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(NexusPalette.dim)
            }
            Spacer()
            Image(systemName: "plus")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(NexusPalette.jadeInk)
                .frame(width: 37, height: 37)
                .background(NexusPalette.jade, in: Circle())
                .accessibilityLabel("新建 Vault")
        }
    }
}

private struct VaultSectionTitle: View {
    let title: String
    let detail: String

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NexusPalette.muted)
            Spacer()
            Text(detail)
                .font(.caption2.monospaced())
                .foregroundStyle(NexusPalette.dim)
        }
        .padding(.horizontal, 18)
    }
}

private struct FeaturedVaultCard: View {
    let vault: VaultSummary
    let index: Int

    private var accent: Color { NexusPalette.accent(for: index) }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [accent.opacity(0.38), NexusPalette.ink800, NexusPalette.ink850],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .overlay(alignment: .topTrailing) {
                Circle()
                    .stroke(accent.opacity(0.26), lineWidth: 1)
                    .frame(width: 122, height: 122)
                    .offset(x: 32, y: -32)
                    .overlay {
                        Circle()
                            .stroke(accent.opacity(0.1), lineWidth: 15)
                            .frame(width: 122, height: 122)
                            .offset(x: 32, y: -32)
                    }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(index == 0 ? "最近打开" : "精选 Vault")
                    .font(.caption2.monospaced())
                    .foregroundStyle(accent)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(NexusPalette.ink900.opacity(0.4), in: Capsule())

                Spacer()

                Text(vault.title)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(NexusPalette.foreground)
                    .lineLimit(2)
                Text(vault.description.isEmpty ? "尚未添加描述" : vault.description)
                    .font(.caption)
                    .foregroundStyle(NexusPalette.muted)
                    .lineLimit(1)
                Text("\(vault.resourceCount) 项资源")
                    .font(.caption2.monospaced())
                    .foregroundStyle(NexusPalette.dim)
            }
            .padding(15)
        }
        .frame(width: 235, height: 164)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.white.opacity(0.11), lineWidth: 1)
        }
    }
}

private struct AtlasVaultCard: View {
    let vault: VaultSummary
    let index: Int

    private var accent: Color { NexusPalette.accent(for: index) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(vault.title.prefix(1).uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(accent)
                    .frame(width: 31, height: 31)
                    .background(accent.opacity(0.13), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                Spacer()
                VaultActivityBars(color: accent)
            }

            Spacer(minLength: 19)

            Text(vault.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NexusPalette.foreground)
                .lineLimit(1)
            Text("\(vault.resourceCount) 项资源")
                .font(.caption2.monospaced())
                .foregroundStyle(NexusPalette.dim)
                .padding(.top, 4)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(LinearGradient(
                    colors: [accent.opacity(0.17), NexusPalette.ink800],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(NexusPalette.line.opacity(0.8), lineWidth: 1)
        }
    }
}

private struct VaultActivityBars: View {
    let color: Color
    private let heights: [CGFloat] = [5, 12, 8, 15, 10]

    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(Array(heights.enumerated()), id: \.offset) { item in
                Capsule()
                    .fill(color.opacity(0.62))
                    .frame(width: 3, height: item.element)
            }
        }
        .frame(height: 16, alignment: .bottom)
    }
}

private struct VaultDetailView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("nexus-vault.show-media-content") private var showsMediaContent = true
    @AppStorage("nexus-vault.resource-view-mode") private var resourceViewModeRaw = VaultResourceViewMode.masonry.rawValue
    @State private var collapsedSpaceIDs: Set<String> = []
    @State private var previewRailSpaceID: String?
    let vault: VaultSummary

    private var detail: VaultDetailPayload? {
        appModel.vaultDetail(for: vault.id)
    }

    private var resources: [VaultResource] {
        detail?.resources ?? []
    }

    private var resourceViewMode: VaultResourceViewMode {
        VaultResourceViewMode(rawValue: resourceViewModeRaw) ?? .masonry
    }

    private var orderedSpaces: [VaultSpace] {
        (detail?.spaces ?? []).sorted { ($0.position ?? 0) < ($1.position ?? 0) }
    }

    private var unassignedResources: [VaultResource] {
        let knownSpaceIDs = Set(orderedSpaces.map(\.id))
        return sortedResources(resources.filter { resource in
            guard let spaceID = resource.spaceId else { return true }
            return !knownSpaceIDs.contains(spaceID)
        })
    }

    var body: some View {
        ZStack {
            NexusBackground()

            ScrollViewReader { proxy in
                ZStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                    VaultDetailHero(
                        vault: vault,
                        resourceCount: detail?.vault.resourceCount ?? resources.count,
                        spaceCount: detail?.spaces.count ?? 0
                    )
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                    if let detail {
                        ResourceViewModeControl(mode: $resourceViewModeRaw)
                            .padding(.top, 24)

                        ForEach(Array(orderedSpaces.enumerated()), id: \.element.id) { item in
                            let space = item.element
                            VaultSpaceResourceSection(
                                space: space,
                                resources: sortedResources(resources.filter { $0.spaceId == space.id }),
                                mode: resourceViewMode,
                                showsMediaContent: showsMediaContent,
                                color: NexusPalette.accent(for: item.offset),
                                isCollapsed: Binding(
                                    get: { collapsedSpaceIDs.contains(space.id) },
                                    set: { isCollapsed in
                                        if isCollapsed {
                                            collapsedSpaceIDs.insert(space.id)
                                        } else {
                                            collapsedSpaceIDs.remove(space.id)
                                        }
                                    }
                                )
                            )
                            .padding(.top, 20)
                            .id(space.id)
                        }

                        if !unassignedResources.isEmpty {
                            VaultUnassignedResourceSection(
                                resources: unassignedResources,
                                mode: resourceViewMode,
                                showsMediaContent: showsMediaContent
                            )
                            .padding(.top, 20)
                        }

                        if detail.spaces.isEmpty && resources.isEmpty {
                            ContentUnavailableView(
                                "这个 Vault 还没有内容",
                                systemImage: "tray",
                                description: Text("请先从分享面板或 Web 端保存资源。")
                            )
                            .foregroundStyle(NexusPalette.muted)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 48)
                        }
                    } else {
                        ProgressView()
                            .tint(NexusPalette.jade)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 56)
                    }
                        }
                        .padding(.bottom, 32)
                        .scrollTargetLayout()
                    }
                    .scrollPosition(id: $previewRailSpaceID)
                    .refreshable {
                        try? await appModel.loadVaultDetail(for: vault.id)
                    }

                    VaultPreviewRail(
                        spaces: orderedSpaces,
                        selectedSpaceID: $previewRailSpaceID
                    ) { spaceID in
                        withAnimation(.snappy(duration: 0.34)) {
                            proxy.scrollTo(spaceID, anchor: .top)
                        }
                    }
                    .padding(.trailing, 7)
                    .padding(.top, 108)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
                }
            }
        }
        .navigationTitle(vault.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: vault.id) {
            appModel.selectVault(vault)
            if appModel.vaultDetail(for: vault.id) == nil {
                try? await appModel.loadVaultDetail(for: vault.id)
            }
        }
        .background(NexusBackground())
    }

    private func sortedResources(_ input: [VaultResource]) -> [VaultResource] {
        input.sorted {
            let leftPosition = $0.position ?? 0
            let rightPosition = $1.position ?? 0
            if leftPosition != rightPosition { return leftPosition < rightPosition }
            return $0.createdAt > $1.createdAt
        }
    }
}

private struct ResourceViewModeControl: View {
    @Binding var mode: String

    var body: some View {
        HStack {
            Text("资源")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NexusPalette.muted)
            Spacer()
            Picker("资源展示方式", selection: $mode) {
                ForEach(VaultResourceViewMode.allCases, id: \.rawValue) { item in
                    Label(item.title, systemImage: item.systemImage)
                        .tag(item.rawValue)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 174)
        }
        .padding(.horizontal, 18)
    }
}

private struct VaultUnassignedResourceSection: View {
    let resources: [VaultResource]
    let mode: VaultResourceViewMode
    let showsMediaContent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: "tray.fill")
                    .foregroundStyle(NexusPalette.dim)
                Text("未分类")
                    .font(.headline)
                    .foregroundStyle(NexusPalette.foreground)
                Text("\(resources.count)")
                    .font(.caption.monospaced())
                    .foregroundStyle(NexusPalette.dim)
                Spacer()
            }
            ResourceFlow(resources: resources, mode: mode, showsMediaContent: showsMediaContent)
        }
        .padding(.horizontal, 16)
    }
}

private struct VaultDetailHero: View {
    let vault: VaultSummary
    let resourceCount: Int
    let spaceCount: Int

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [NexusPalette.jade.opacity(0.23), NexusPalette.ink800, NexusPalette.ink850],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Circle()
                .stroke(NexusPalette.jade.opacity(0.25), lineWidth: 1)
                .frame(width: 176, height: 176)
                .offset(x: 112, y: -70)

            VStack(alignment: .leading, spacing: 8) {
                Text(vault.title)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(NexusPalette.foreground)
                    .lineLimit(2)
                if !vault.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(vault.description)
                        .font(.subheadline)
                        .foregroundStyle(NexusPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 23) {
                    VaultMetric(value: "\(resourceCount)", label: "资源")
                    VaultMetric(value: "\(spaceCount)", label: "Space")
                }
                .padding(.top, 9)
            }
            .padding(17)
        }
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .bottomLeading)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(NexusPalette.jade.opacity(0.25), lineWidth: 1)
        }
    }
}

private struct VaultMetric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(NexusPalette.jade)
            Text(label)
                .font(.caption2.monospaced())
                .foregroundStyle(NexusPalette.dim)
        }
    }
}
