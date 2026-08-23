import Foundation
import SwiftUI
@preconcurrency import AVKit
import UIKit
import Photos
import ImageIO
import Combine
import CryptoKit
import UniformTypeIdentifiers

enum VaultResourceViewMode: String, CaseIterable {
    case masonry
    case list

    var title: String {
        switch self {
        case .masonry: "瀑布流"
        case .list: "列表"
        }
    }

    var systemImage: String {
        switch self {
        case .masonry: "rectangle.grid.2x2"
        case .list: "list.bullet"
        }
    }
}

struct ResourceFlow: View {
    let resources: [VaultResource]
    let mode: VaultResourceViewMode
    let showsMediaContent: Bool

    private var masonryColumns: [[VaultResource]] {
        var columns = Array(repeating: [VaultResource](), count: 2)
        for (index, resource) in resources.enumerated() {
            columns[index % 2].append(resource)
        }
        return columns
    }

    var body: some View {
        Group {
            if mode == .masonry {
                HStack(alignment: .top, spacing: 8) {
                    ForEach(masonryColumns.indices, id: \.self) { columnIndex in
                        LazyVStack(alignment: .leading, spacing: 8) {
                            ForEach(masonryColumns[columnIndex]) { resource in
                                VaultResourceCard(
                                    resource: resource,
                                    showsMediaContent: showsMediaContent,
                                    isList: false
                                )
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(resources) { resource in
                        VaultResourceCard(resource: resource, showsMediaContent: showsMediaContent, isList: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

struct VaultPreviewRail: View {
    let spaces: [VaultSpace]
    @Binding var selectedSpaceID: String?
    let onCommit: (String) -> Void
    @State private var isDragging = false
    @State private var dragOriginIndex = 0
    @State private var showsSpaceName = false

    private var selectedIndex: Int {
        guard let selectedSpaceID,
              let index = spaces.firstIndex(where: { $0.id == selectedSpaceID }) else {
            return 0
        }
        return index
    }

    private var selectedSpace: VaultSpace? {
        guard spaces.indices.contains(selectedIndex) else { return nil }
        return spaces[selectedIndex]
    }

    private var visibleSpaceIndices: [Int] {
        guard !spaces.isEmpty else { return [] }
        let lowerBound = max(0, selectedIndex - 2)
        let upperBound = min(spaces.count - 1, selectedIndex + 2)
        return Array(lowerBound...upperBound)
    }

    var body: some View {
        HStack(spacing: 7) {
            if showsSpaceName, let selectedSpace {
                Text(selectedSpace.name)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NexusPalette.foreground)
                    .lineLimit(1)
                    .padding(.horizontal, 9)
                    .frame(maxWidth: 132)
                    .frame(height: 32)
                    .background(NexusPalette.ink800.opacity(0.96), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .stroke(NexusPalette.line.opacity(0.8), lineWidth: 1)
                    }
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }

            VStack(spacing: 6) {
                Image(systemName: "rectangle.stack.fill")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(NexusPalette.jade.opacity(0.8))
                    .padding(.bottom, 2)

                if spaces.isEmpty {
                    ForEach(0..<4, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(index == 1 ? NexusPalette.jade.opacity(0.38) : NexusPalette.line.opacity(0.7))
                            .frame(width: 22, height: index == 1 ? 34 : 16)
                    }
                } else {
                    ForEach(visibleSpaceIndices, id: \.self) { index in
                        let isSelected = index == selectedIndex
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(isSelected ? NexusPalette.jade : NexusPalette.line.opacity(0.75))
                            .frame(width: 22, height: isSelected ? 32 : 10)
                            .scaleEffect(isSelected ? 1 : 0.86)
                            .animation(.snappy(duration: 0.18), value: selectedIndex)
                    }
                }
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 6)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay {
                Capsule()
                    .stroke(NexusPalette.line.opacity(0.75), lineWidth: 1)
            }
        }
        .shadow(color: .black.opacity(0.22), radius: 9, y: 4)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    guard !spaces.isEmpty else { return }
                    if !isDragging {
                        isDragging = true
                        dragOriginIndex = selectedIndex
                        withAnimation(.snappy(duration: 0.16)) {
                            showsSpaceName = true
                        }
                    }
                    let offset = Int((value.translation.height / 28).rounded())
                    let nextIndex = min(max(dragOriginIndex + offset, 0), spaces.count - 1)
                    selectedSpaceID = spaces[nextIndex].id
                }
                .onEnded { _ in
                    isDragging = false
                    guard let selectedSpaceID else { return }
                    onCommit(selectedSpaceID)
                    withAnimation(.easeOut(duration: 0.16)) {
                        showsSpaceName = false
                    }
                }
        )
        .accessibilityLabel(selectedSpace?.name ?? "Space 导航")
        .accessibilityHint("上下拖动选择 Space，松开后跳转")
        .onAppear {
            if selectedSpaceID == nil {
                selectedSpaceID = spaces.first?.id
            }
        }
        .onChange(of: spaces.map(\.id)) { _, spaceIDs in
            if selectedSpaceID == nil || !spaceIDs.contains(selectedSpaceID ?? "") {
                selectedSpaceID = spaceIDs.first
            }
        }
    }
}

struct StarredResourcesView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("nexus-vault.show-media-content") private var showsMediaContent = true

    var body: some View {
        NavigationStack {
            ZStack {
                NexusBackground()

                if appModel.starredResources.isEmpty && !appModel.isLoadingStarredResources {
                    ContentUnavailableView(
                        "还没有收藏资源",
                        systemImage: "star",
                        description: Text("在任意 Resource 中收藏的内容会出现在这里。")
                    )
                    .foregroundStyle(NexusPalette.muted)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            SavedResourcesHeader(
                                eyebrow: "STAR",
                                title: "收藏",
                                detail: "你标记为重要的 Resource",
                                count: appModel.starredResources.count,
                                systemImage: "star.fill"
                            )

                            ResourceFlow(
                                resources: appModel.starredResources.map(\.resource),
                                mode: .list,
                                showsMediaContent: showsMediaContent
                            )
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 14)
                        .padding(.bottom, 32)
                    }
                    .refreshable {
                        try? await appModel.loadStarredResources()
                    }
                }
            }
            .navigationTitle("收藏")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { try? await appModel.loadStarredResources() }
                    } label: {
                        Image(systemName: appModel.isLoadingStarredResources ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                    }
                    .disabled(appModel.isLoadingStarredResources)
                    .accessibilityLabel("刷新收藏")
                }
            }
            .overlay {
                if appModel.isLoadingStarredResources && appModel.starredResources.isEmpty {
                    ProgressView().tint(NexusPalette.jade)
                }
            }
        }
        .background(NexusBackground())
        .task {
            if appModel.starredResources.isEmpty {
                try? await appModel.loadStarredResources()
            }
        }
    }
}

struct ReadLaterResourcesView: View {
    @EnvironmentObject private var appModel: AppModel
    @AppStorage("nexus-vault.show-media-content") private var showsMediaContent = true

    var body: some View {
        NavigationStack {
            ZStack {
                NexusBackground()

                if appModel.readLaterResources.isEmpty && !appModel.isLoadingReadLaterResources {
                    ContentUnavailableView(
                        "还没有稍后查看的资源",
                        systemImage: "clock",
                        description: Text("稍后查看的 Resource 会在这里按保存顺序排列。")
                    )
                    .foregroundStyle(NexusPalette.muted)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            SavedResourcesHeader(
                                eyebrow: "WATCH LATER",
                                title: "稍后查看",
                                detail: "暂存待处理的 Resource",
                                count: appModel.readLaterResources.count,
                                systemImage: "clock.badge.checkmark"
                            )

                            LazyVStack(alignment: .leading, spacing: 12) {
                                ForEach(appModel.readLaterResources) { item in
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text("\(item.vaultName) / \(item.spaceName)")
                                            .font(.caption2.monospaced())
                                            .foregroundStyle(NexusPalette.dim)
                                            .lineLimit(1)
                                        VaultResourceCard(
                                            resource: item.resource,
                                            showsMediaContent: showsMediaContent,
                                            isList: true
                                        )
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 14)
                        .padding(.bottom, 32)
                    }
                    .refreshable {
                        try? await appModel.loadReadLaterResources()
                    }
                }
            }
            .navigationTitle("稍后查看")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { try? await appModel.loadReadLaterResources() }
                    } label: {
                        Image(systemName: appModel.isLoadingReadLaterResources ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                    }
                    .disabled(appModel.isLoadingReadLaterResources)
                    .accessibilityLabel("刷新稍后查看")
                }
            }
            .overlay {
                if appModel.isLoadingReadLaterResources && appModel.readLaterResources.isEmpty {
                    ProgressView().tint(NexusPalette.jade)
                }
            }
        }
        .background(NexusBackground())
        .task {
            if appModel.readLaterResources.isEmpty {
                try? await appModel.loadReadLaterResources()
            }
        }
    }
}

private struct SavedResourcesHeader: View {
    let eyebrow: String
    let title: String
    let detail: String
    let count: Int
    let systemImage: String

    var body: some View {
        HStack(alignment: .bottom, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow)
                    .font(.caption2.monospaced())
                    .foregroundStyle(NexusPalette.dim)
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(NexusPalette.foreground)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(NexusPalette.muted)
            }
            Spacer()
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NexusPalette.jade)
                Text("\(count)")
                    .font(.caption.monospaced())
                    .foregroundStyle(NexusPalette.foreground)
            }
            .frame(width: 44, height: 48)
            .background(NexusPalette.jade.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(NexusPalette.line.opacity(0.7))
                .frame(height: 1)
        }
    }
}

struct VaultSpaceResourceSection: View {
    let space: VaultSpace
    let resources: [VaultResource]
    let mode: VaultResourceViewMode
    let showsMediaContent: Bool
    let color: Color
    @Binding var isCollapsed: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.snappy(duration: 0.28)) {
                    isCollapsed.toggle()
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: systemImage)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(color)
                        .frame(width: 31, height: 31)
                        .background(color.opacity(0.13), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(space.name)
                            .font(.headline)
                            .foregroundStyle(NexusPalette.foreground)
                    }
                    Spacer()
                    Text("\(resources.count)")
                        .font(.caption.monospaced())
                        .foregroundStyle(NexusPalette.dim)
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(NexusPalette.dim)
                        .rotationEffect(.degrees(isCollapsed ? -90 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if !isCollapsed {
                if let description = space.description, !description.isEmpty {
                    MarkdownText(description)
                        .font(.caption)
                        .foregroundStyle(NexusPalette.muted)
                        .padding(.leading, 41)
                }

                if resources.isEmpty {
                    ContentUnavailableView(
                        "这个 Space 还没有资源",
                        systemImage: "tray",
                        description: Text("从系统分享面板保存的内容会显示在这里。")
                    )
                    .foregroundStyle(NexusPalette.dim)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(NexusPalette.ink800.opacity(0.55), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                } else {
                    ResourceFlow(resources: resources, mode: mode, showsMediaContent: showsMediaContent)
                }
            }
        }
        .padding(12)
        .background(NexusPalette.ink900.opacity(0.36), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(NexusPalette.line.opacity(0.8), lineWidth: 1)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var systemImage: String {
        switch space.icon {
        case "tv": "rectangle.stack.fill"
        case "book": "book.closed.fill"
        case "sparkles": "sparkles"
        default: "folder.fill"
        }
    }
}

struct VaultResourceCard: View {
    let resource: VaultResource
    let showsMediaContent: Bool
    let isList: Bool
    @State private var isPresentingDetails = false

    var body: some View {
        Button {
            isPresentingDetails = true
        } label: {
            if isList {
                listCard
            } else {
                masonryCard
            }
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $isPresentingDetails) {
            ResourceDetailsSheet(resource: resource, showsMediaContent: showsMediaContent)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private var masonryCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            if showsMediaContent, let media = resource.primaryMedia {
                ResourceMediaPreview(media: media)
            }

            VStack(alignment: .leading, spacing: 8) {
                ResourceCardHeader(resource: resource)
                Text(resource.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NexusPalette.foreground)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                if !resource.displayDescription.isEmpty {
                    Text(resource.displayDescription)
                        .font(.caption)
                        .foregroundStyle(NexusPalette.muted)
                        .lineLimit(resource.previewKind == "x_post" ? 5 : 3)
                        .multilineTextAlignment(.leading)
                }

                ResourceAttributePills(resource: resource, maximumCount: 2)
                ResourceCardMetrics(resource: resource)
                ResourceAnnotationSummary(annotation: resource.annotation)
            }
            .padding(10)
        }
        .resourceCardSurface()
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var listCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                if showsMediaContent, let media = resource.primaryMedia {
                    ResourceMediaPreview(media: media)
                        .frame(width: 104, alignment: .topLeading)
                } else {
                    ResourceTypeGlyph(resource: resource)
                }

                VStack(alignment: .leading, spacing: 6) {
                    ResourceCardHeader(resource: resource)
                    Text(resource.displayTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(NexusPalette.foreground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if !resource.displayDescription.isEmpty {
                        Text(resource.displayDescription)
                            .font(.caption)
                            .foregroundStyle(NexusPalette.dim)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    ResourceCardMetrics(resource: resource)
                    ResourceAnnotationSummary(annotation: resource.annotation)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            ResourceAttributePills(
                resource: resource,
                maximumCount: 4,
                alignment: .trailing
            )
        }
        .padding(10)
        .resourceCardSurface()
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ResourceCardHeader: View {
    let resource: VaultResource

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: resource.platformSystemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(resource.platformColor)
            Text(resource.platformLabel)
                .font(.caption2.monospaced())
                .foregroundStyle(resource.platformColor)
                .lineLimit(1)
            Spacer(minLength: 0)
            if resource.isReadLater {
                Image(systemName: "bookmark.fill")
                    .font(.caption2)
                    .foregroundStyle(NexusPalette.dim)
            }
            if resource.isStarred {
                Image(systemName: "star.fill")
                    .font(.caption2)
                    .foregroundStyle(Color(red: 232 / 255, green: 179 / 255, blue: 74 / 255))
            }
        }
    }
}

private struct ResourceCardMetrics: View {
    let resource: VaultResource

    var body: some View {
        let metrics = resource.previewMetrics
        if !metrics.isEmpty {
            HStack(spacing: 8) {
                ForEach(metrics) { metric in
                    Label(metric.value, systemImage: metric.systemImage)
                        .font(.caption2)
                        .foregroundStyle(NexusPalette.dim)
                        .lineLimit(1)
                }
            }
        }
    }
}

private struct ResourceAttributePills: View {
    let resource: VaultResource
    let maximumCount: Int
    let alignment: Alignment

    init(
        resource: VaultResource,
        maximumCount: Int,
        alignment: Alignment = .leading
    ) {
        self.resource = resource
        self.maximumCount = maximumCount
        self.alignment = alignment
    }

    var body: some View {
        let attributes = Array(resource.resourceAttributes.prefix(maximumCount))
        if !attributes.isEmpty {
            HStack(spacing: 6) {
                ForEach(attributes) { attribute in
                    Label(attribute.value, systemImage: attribute.systemImage)
                        .font(.caption2.monospaced())
                        .foregroundStyle(NexusPalette.dim)
                        .lineLimit(1)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: alignment)
            .clipped()
        }
    }
}

private struct ResourceAnnotationSummary: View {
    let annotation: ResourceAnnotation?

    var body: some View {
        if let annotation {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if annotation.checked {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(NexusPalette.jade)
                    }
                    if let rating = annotation.rating, rating > 0 {
                        Label("\(rating)/5", systemImage: "star.fill")
                            .foregroundStyle(Color(red: 232 / 255, green: 179 / 255, blue: 74 / 255))
                    }
                }
                .font(.caption2)

                if !annotation.comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(annotation.comment)
                        .font(.caption)
                        .foregroundStyle(NexusPalette.dim)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
        }
    }
}

private struct ResourceTypeGlyph: View {
    let resource: VaultResource

    var body: some View {
        Image(systemName: resource.platformSystemImage)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(resource.platformColor)
            .frame(width: 58, height: 58)
            .background(resource.platformColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

private struct ResourceMediaPreview: View {
    let media: ResourceMedia
    let fixedHeight: CGFloat?
    @State private var loadedImage: UIImage?
    @State private var measuredAspectRatio: CGFloat?
    @State private var isLoadingImage = true

    init(media: ResourceMedia, fixedHeight: CGFloat? = nil) {
        self.media = media
        self.fixedHeight = fixedHeight
    }

    var body: some View {
        Group {
            if let fixedHeight {
                previewContent
                    .frame(maxWidth: .infinity)
                    .frame(height: fixedHeight)
            } else {
                previewContent
                    .aspectRatio(previewAspectRatio, contentMode: .fit)
                    .frame(maxWidth: .infinity)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        .task(id: media.previewImageURL?.absoluteString) {
            await loadImage()
        }
    }

    private var previewAspectRatio: CGFloat {
        measuredAspectRatio ?? media.displayAspectRatio
    }

    private var previewContent: some View {
        Rectangle()
            .fill(NexusPalette.ink700)
            .overlay { mediaLayer }
            .overlay { videoOverlay }
    }

    @ViewBuilder
    private var mediaLayer: some View {
        if let loadedImage {
            Image(uiImage: loadedImage)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if isLoadingImage {
            Rectangle()
                .fill(NexusPalette.ink700)
                .overlay { ProgressView().tint(NexusPalette.jade) }
        } else {
            mediaPlaceholder
        }
    }

    @MainActor
    private func loadImage() async {
        guard let url = media.previewImageURL else {
            isLoadingImage = false
            return
        }

        loadedImage = nil
        measuredAspectRatio = nil
        isLoadingImage = true

        do {
            let (data, _) = try await URLSession.shared.data(from: MediaDiskCache.shared.preferredURL(for: url))
            guard !Task.isCancelled, let image = UIImage(data: data) else {
                if !Task.isCancelled { isLoadingImage = false }
                return
            }

            let size = image.size
            if size.width > 0, size.height > 0 {
                measuredAspectRatio = size.width / size.height
            }
            loadedImage = image
        } catch {
            guard !Task.isCancelled else { return }
        }

        if !Task.isCancelled {
            isLoadingImage = false
        }
    }

    @ViewBuilder
    private var videoOverlay: some View {
        if media.contentKind == .video {
            Image(systemName: "play.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 31, height: 31)
                .background(.black.opacity(0.48), in: Circle())
            if let duration = media.duration, !duration.isEmpty {
                Text(duration)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 3)
                    .background(.black.opacity(0.6), in: Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(6)
            }
        }
        if media.livePhotoVideoURL != nil {
            Label("Live", systemImage: "livephoto")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .background(.black.opacity(0.62), in: Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(6)
        }
    }

    private var mediaPlaceholder: some View {
        LinearGradient(
            colors: [NexusPalette.jade.opacity(0.28), NexusPalette.ink700],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay {
            Image(systemName: media.contentKind.placeholderSystemImage)
                .foregroundStyle(NexusPalette.jade.opacity(0.75))
        }
    }
}

private struct ResourceDetailsSheet: View {
    let resource: VaultResource
    let showsMediaContent: Bool
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appModel: AppModel
    @State private var selectedMedia: ResourceMedia?
    @StateObject private var photoSaver = MediaPhotoSaver()
    @State private var annotationChecked: Bool
    @State private var annotationRating: Int
    @State private var annotationComment: String
    @State private var isSavingAnnotation = false
    @State private var annotationError: String?

    init(resource: VaultResource, showsMediaContent: Bool) {
        self.resource = resource
        self.showsMediaContent = showsMediaContent
        _annotationChecked = State(initialValue: resource.annotation?.checked ?? false)
        _annotationRating = State(initialValue: resource.annotation?.rating ?? 0)
        _annotationComment = State(initialValue: resource.annotation?.comment ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if showsMediaContent, !resource.media.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(resource.media) { media in
                                    Button {
                                        selectedMedia = media
                                    } label: {
                                        ResourceMediaPreview(media: media, fixedHeight: 220)
                                            .frame(width: 280)
                                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("预览媒体")
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        ResourceCardHeader(resource: resource)
                        Text(resource.displayTitle)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(NexusPalette.foreground)
                        if !resource.displayDescription.isEmpty {
                            MarkdownText(resource.displayDescription)
                                .font(.body)
                                .foregroundStyle(NexusPalette.muted)
                        }
                        ResourceCardMetrics(resource: resource)
                    }
                    .padding(.horizontal, 16)

                    if !resource.downloadableMedia.isEmpty {
                        MediaSaveAction(media: resource.downloadableMedia, saver: photoSaver)
                            .padding(.horizontal, 16)
                    }

                    ResourceAnnotationEditor(
                        checked: $annotationChecked,
                        rating: $annotationRating,
                        comment: $annotationComment,
                        isSaving: isSavingAnnotation,
                        errorMessage: annotationError,
                        save: saveAnnotation
                    )
                    .padding(.horizontal, 16)

                    if let url = resource.destinationURL {
                        Link(destination: url) {
                            Label("打开原始链接", systemImage: "arrow.up.right.square")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                        }
                        .foregroundStyle(NexusPalette.jadeInk)
                        .background(NexusPalette.jade, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .padding(.horizontal, 16)
                    }
                }
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(NexusBackground())
            .navigationTitle(resource.platformLabel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                        .foregroundStyle(NexusPalette.jade)
                }
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: $selectedMedia) { media in
            MediaPreviewScreen(media: resource.media, initialMediaID: media.id)
        }
    }

    private func saveAnnotation() {
        isSavingAnnotation = true
        annotationError = nil
        let patch = ResourceAnnotationPatch(
            checked: annotationChecked,
            rating: annotationRating > 0 ? annotationRating : nil,
            comment: annotationComment.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        Task {
            do {
                let annotation = try await APIClient.shared.updateResourceAnnotation(resourceID: resource.id, patch: patch)
                appModel.applyAnnotation(annotation, to: resource.id)
                isSavingAnnotation = false
            } catch {
                annotationError = error.localizedDescription
                isSavingAnnotation = false
            }
        }
    }
}

private struct MediaSaveAction: View {
    let media: [ResourceMedia]
    @ObservedObject var saver: MediaPhotoSaver
    @State private var isPresentingChoices = false

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Button {
                if media.count == 1, let first = media.first {
                    saver.save(media: first)
                } else {
                    isPresentingChoices = true
                }
            } label: {
                Label(buttonTitle, systemImage: "square.and.arrow.down")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .disabled(saver.isDownloading)
            .foregroundStyle(NexusPalette.jadeInk)
            .background(NexusPalette.jade, in: RoundedRectangle(cornerRadius: 8, style: .continuous))

            if saver.isDownloading {
                ProgressView(value: saver.progress)
                    .tint(NexusPalette.jade)
                Text("\(Int(saver.progress * 100))%")
                    .font(.caption2.monospaced())
                    .foregroundStyle(NexusPalette.dim)
            } else if let message = saver.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(saver.didSucceed ? NexusPalette.jade : NexusPalette.muted)
            }
        }
        .confirmationDialog("选择要保存的媒体", isPresented: $isPresentingChoices, titleVisibility: .visible) {
            ForEach(Array(media.enumerated()), id: \.element.id) { item in
                Button("保存媒体 \(item.offset + 1) - \(item.element.downloadLabel)") {
                    saver.save(media: item.element)
                }
            }
            Button("保存全部 \(media.count) 个媒体") {
                saver.saveAll(media: media)
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("可选择单个媒体，或按顺序保存全部媒体到系统相册。")
        }
    }

    private var buttonTitle: String {
        if saver.isDownloading { return "正在下载媒体" }
        return media.count > 1 ? "保存 \(media.count) 个媒体到相册" : "存到相册"
    }
}

private struct ResourceAnnotationEditor: View {
    @Binding var checked: Bool
    @Binding var rating: Int
    @Binding var comment: String
    let isSaving: Bool
    let errorMessage: String?
    let save: () -> Void
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Button {
                withAnimation(.snappy(duration: 0.24)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "text.badge.checkmark")
                        .foregroundStyle(NexusPalette.jade)
                    Text("批注")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(NexusPalette.foreground)
                    if checked || rating > 0 || !comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(annotationSummary)
                            .font(.caption)
                            .foregroundStyle(NexusPalette.dim)
                            .lineLimit(1)
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(NexusPalette.dim)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                Toggle("已处理", isOn: $checked)
                    .font(.subheadline)
                    .tint(NexusPalette.jade)

                HStack(spacing: 4) {
                    ForEach(1...5, id: \.self) { value in
                        Button {
                            rating = rating == value ? 0 : value
                        } label: {
                            Image(systemName: value <= rating ? "star.fill" : "star")
                                .foregroundStyle(Color(red: 232 / 255, green: 179 / 255, blue: 74 / 255))
                                .frame(width: 27, height: 27)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(value) 星")
                    }
                    Spacer()
                }

                TextField("添加评论", text: $comment, axis: .vertical)
                    .font(.subheadline)
                    .foregroundStyle(NexusPalette.foreground)
                    .lineLimit(2...5)
                    .padding(10)
                    .background(NexusPalette.ink700, in: RoundedRectangle(cornerRadius: 7, style: .continuous))

                HStack {
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(.red.opacity(0.9))
                            .lineLimit(2)
                    }
                    Spacer()
                    Button("保存") { save() }
                        .buttonStyle(.bordered)
                        .tint(NexusPalette.jade)
                        .disabled(isSaving)
                }
            }
        }
        .padding(12)
        .background(NexusPalette.ink800.opacity(0.78), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
            .stroke(NexusPalette.line.opacity(0.82), lineWidth: 1)
        }
    }

    private var annotationSummary: String {
        var parts: [String] = []
        if checked { parts.append("已处理") }
        if rating > 0 { parts.append("\(rating) 星") }
        if !comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { parts.append("有评论") }
        return parts.joined(separator: " · ")
    }
}

private final class MediaPhotoSaver: NSObject, ObservableObject, URLSessionDownloadDelegate {
    @Published private(set) var progress: Double = 0
    @Published private(set) var isDownloading = false
    @Published private(set) var message: String?
    @Published private(set) var didSucceed = false

    private var queuedMedia: [ResourceMedia] = []
    private var completedCount = 0
    private var totalCount = 0
    private var currentMedia: ResourceMedia?
    private lazy var session: URLSession = URLSession(
        configuration: .default,
        delegate: self,
        delegateQueue: .main
    )

    func save(media: ResourceMedia) {
        saveAll(media: [media])
    }

    func saveAll(media: [ResourceMedia]) {
        let validMedia = media.filter { $0.photoLibraryDownloadURL != nil }
        guard !validMedia.isEmpty else { return }
        progress = 0
        message = nil
        didSucceed = false
        isDownloading = true
        queuedMedia = validMedia
        completedCount = 0
        totalCount = validMedia.count
        startNextDownload()
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard totalBytesExpectedToWrite > 0 else { return }
        let currentProgress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        progress = min(1, (Double(completedCount) + currentProgress) / Double(max(totalCount, 1)))
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let media = currentMedia else {
            finish("下载任务状态异常。", success: false)
            return
        }
        guard let response = downloadTask.response as? HTTPURLResponse,
              (200..<300).contains(response.statusCode) else {
            finishCurrent("媒体下载失败，服务器没有返回有效文件。", success: false)
            return
        }
        let mimeType = response.mimeType?.lowercased()
        if let mimeType, mimeType.hasPrefix("text/") || mimeType.contains("html") {
            finishCurrent("下载地址返回的不是媒体文件。", success: false)
            return
        }

        do {
            let importURL = try prepareImportURL(from: location, media: media, mimeType: mimeType)
            addToPhotoLibrary(importURL, media: media)
        } catch {
            finishCurrent(photoLibraryMessage(for: error), success: false)
            return
        }
    }

    private func addToPhotoLibrary(_ importURL: URL, media: ResourceMedia) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            guard let self else { return }
            guard status == .authorized || status == .limited else {
                try? FileManager.default.removeItem(at: importURL)
                self.finishCurrent("请允许 Nexus Vault 添加照片后重试。", success: false)
                return
            }
            PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(
                    with: media.contentKind == .video ? .video : .photo,
                    fileURL: importURL,
                    options: nil
                )
            } completionHandler: { success, error in
                try? FileManager.default.removeItem(at: importURL)
                self.finishCurrent(
                    success ? "已保存到相册" : self.photoLibraryMessage(for: error),
                    success: success
                )
            }
        }
    }

    private func saveLivePhoto(_ media: ResourceMedia) async {
        guard let photoURL = media.photoLibraryDownloadURL,
              let pairedVideoURL = media.livePhotoVideoURL else {
            finishCurrent("实况照片的图片或视频地址不可用。", success: false)
            return
        }

        do {
            let (photoTemporaryURL, photoResponse) = try await URLSession.shared.download(from: photoURL)
            let photoMIMEType = try validatedMediaMIMEType(photoResponse)
            let photoImportURL = try prepareImportURL(
                from: photoTemporaryURL,
                media: media,
                mimeType: photoMIMEType
            )
            DispatchQueue.main.async {
                self.progress = min(0.5, (Double(self.completedCount) + 0.5) / Double(max(self.totalCount, 1)))
                self.message = "正在准备实况照片的视频"
            }

            let (videoTemporaryURL, videoResponse) = try await URLSession.shared.download(from: pairedVideoURL)
            let videoMIMEType = try validatedMediaMIMEType(videoResponse)
            let videoImportURL = try prepareLivePhotoVideoImportURL(
                from: videoTemporaryURL,
                mimeType: videoMIMEType
            )
            addLivePhotoToPhotoLibrary(photoURL: photoImportURL, pairedVideoURL: videoImportURL)
        } catch {
            finishCurrent(photoLibraryMessage(for: error), success: false)
        }
    }

    private func addLivePhotoToPhotoLibrary(photoURL: URL, pairedVideoURL: URL) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            guard let self else { return }
            guard status == .authorized || status == .limited else {
                try? FileManager.default.removeItem(at: photoURL)
                try? FileManager.default.removeItem(at: pairedVideoURL)
                self.finishCurrent("请允许 Nexus Vault 添加照片后重试。", success: false)
                return
            }
            PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, fileURL: photoURL, options: nil)
                request.addResource(with: .pairedVideo, fileURL: pairedVideoURL, options: nil)
            } completionHandler: { success, error in
                if success {
                    try? FileManager.default.removeItem(at: photoURL)
                    try? FileManager.default.removeItem(at: pairedVideoURL)
                    self.finishCurrent("已作为实况照片保存到相册", success: true)
                } else {
                    self.saveLivePhotoComponents(
                        photoURL: photoURL,
                        videoURL: pairedVideoURL,
                        originalError: error
                    )
                }
            }
        }
    }

    private func saveLivePhotoComponents(photoURL: URL, videoURL: URL, originalError: Error?) {
        PHPhotoLibrary.shared().performChanges {
            let photoRequest = PHAssetCreationRequest.forAsset()
            photoRequest.addResource(with: .photo, fileURL: photoURL, options: nil)
            let videoRequest = PHAssetCreationRequest.forAsset()
            videoRequest.addResource(with: .video, fileURL: videoURL, options: nil)
        } completionHandler: { [weak self] success, error in
            try? FileManager.default.removeItem(at: photoURL)
            try? FileManager.default.removeItem(at: videoURL)
            guard let self else { return }
            if success {
                self.finishCurrent("源媒体不含可配对的 Live Photo 元数据，已分别保存照片和视频", success: true)
            } else {
                self.finishCurrent(
                    self.photoLibraryMessage(for: error ?? originalError),
                    success: false
                )
            }
        }
    }

    private func validatedMediaMIMEType(_ response: URLResponse) throws -> String? {
        guard let response = response as? HTTPURLResponse,
              (200..<300).contains(response.statusCode) else {
            throw MediaSaveError.invalidResponse
        }
        let mimeType = response.mimeType?.lowercased()
        if let mimeType, mimeType.hasPrefix("text/") || mimeType.contains("html") {
            throw MediaSaveError.nonMediaResponse
        }
        return mimeType
    }

    private func prepareLivePhotoVideoImportURL(
        from location: URL,
        mimeType: String?
    ) throws -> URL {
        let fileExtension = mimeType.flatMap { UTType(mimeType: $0)?.preferredFilenameExtension } ?? "mp4"
        let importURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("nexus-live-video-\(UUID().uuidString)")
            .appendingPathExtension(fileExtension)
        try FileManager.default.copyItem(at: location, to: importURL)
        return importURL
    }

    private func prepareImportURL(
        from location: URL,
        media: ResourceMedia,
        mimeType: String?
    ) throws -> URL {
        let fileManager = FileManager.default
        let shouldTranscode = media.requiresPhotoLibraryTranscode(receivedMIMEType: mimeType)
        let fileExtension = shouldTranscode
            ? "jpg"
            : media.photoLibraryFileExtension(receivedMIMEType: mimeType)
        let importURL = fileManager.temporaryDirectory
            .appendingPathComponent("nexus-export-\(UUID().uuidString)")
            .appendingPathExtension(fileExtension)

        if shouldTranscode {
            guard let image = UIImage(contentsOfFile: location.path),
                  let data = image.jpegData(compressionQuality: 0.94) else {
                throw MediaSaveError.unsupportedImageFormat
            }
            try data.write(to: importURL, options: .atomic)
            return importURL
        }

        if media.contentKind == .image, UIImage(contentsOfFile: location.path) == nil {
            throw MediaSaveError.invalidImageData
        }

        try fileManager.copyItem(at: location, to: importURL)
        return importURL
    }

    private func photoLibraryMessage(for error: Error?) -> String {
        guard let error else { return "无法保存到相册。" }
        let nsError = error as NSError
        if nsError.domain == "PHPhotoErrorDomain" || nsError.domain == "PHPhotosErrorDomain" {
            if nsError.code == 3302 {
                return "该文件格式或媒体数据不被系统相册接受，无法保存。"
            }
            return "系统相册无法导入此媒体（错误 \(nsError.code)）。"
        }
        if let saveError = error as? MediaSaveError {
            return saveError.localizedDescription
        }
        return error.localizedDescription
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        if let error { finishCurrent(error.localizedDescription, success: false) }
    }

    private func startNextDownload() {
        guard !queuedMedia.isEmpty else {
            finish("已保存 \(completedCount)/\(totalCount) 个媒体到相册", success: completedCount == totalCount)
            return
        }
        let media = queuedMedia.removeFirst()
        guard let url = media.photoLibraryDownloadURL else {
            finishCurrent("媒体地址不可用。", success: false)
            return
        }
        currentMedia = media
        message = totalCount > 1
            ? "正在保存第 \(completedCount + 1)/\(totalCount) 个\(media.downloadLabel)"
            : "正在保存\(media.downloadLabel)"
        if media.livePhotoVideoURL != nil {
            Task { [weak self] in
                await self?.saveLivePhoto(media)
            }
            return
        }
        session.downloadTask(with: url).resume()
    }

    private func finishCurrent(_ message: String, success: Bool) {
        DispatchQueue.main.async {
            guard self.isDownloading else { return }
            guard success else {
                self.queuedMedia = []
                self.currentMedia = nil
                self.finish(message, success: false)
                return
            }
            self.completedCount += 1
            self.currentMedia = nil
            self.startNextDownload()
        }
    }

    private func finish(_ message: String, success: Bool) {
        DispatchQueue.main.async {
            self.progress = success ? 1 : 0
            self.message = message
            self.didSucceed = success
            self.isDownloading = false
        }
    }
}

private enum MediaSaveError: LocalizedError {
    case unsupportedImageFormat
    case invalidImageData
    case invalidResponse
    case nonMediaResponse

    var errorDescription: String? {
        switch self {
        case .unsupportedImageFormat:
            "此图片格式无法转换为系统相册可用的 JPEG。"
        case .invalidImageData:
            "下载的内容不是可识别的图片文件。"
        case .invalidResponse:
            "媒体下载失败，服务器没有返回有效文件。"
        case .nonMediaResponse:
            "下载地址返回的不是媒体文件。"
        }
    }
}

private struct MediaPreviewScreen: View {
    let media: [ResourceMedia]
    let initialMediaID: String
    @Environment(\.dismiss) private var dismiss
    @State private var selectedMediaID: String
    @StateObject private var photoSaver = MediaPhotoSaver()

    init(media: [ResourceMedia], initialMediaID: String) {
        self.media = media
        self.initialMediaID = initialMediaID
        _selectedMediaID = State(initialValue: initialMediaID)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            TabView(selection: $selectedMediaID) {
                ForEach(media) { item in
                    MediaPreviewPage(
                        media: item,
                        isActive: item.id == selectedMediaID
                    )
                    .tag(item.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            previewToolbar

            VStack(spacing: 10) {
                Spacer()
                if media.count > 1 {
                    mediaFilmstrip
                }
                if selectedMedia?.contentKind != .video {
                    previewFooter
                }
            }
            .padding(.bottom, 12)
        }
        .preferredColorScheme(.dark)
        .onChange(of: selectedMediaID) { _, newValue in
            guard media.contains(where: { $0.id == newValue }) else {
                selectedMediaID = initialMediaID
                return
            }
        }
    }

    private var selectedMedia: ResourceMedia? {
        media.first { $0.id == selectedMediaID }
    }

    private var previewToolbar: some View {
        HStack(spacing: 9) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(.black.opacity(0.56), in: Circle())
            }

            if let selectedMedia, selectedMedia.photoLibraryDownloadURL != nil {
                Button {
                    photoSaver.save(media: selectedMedia)
                } label: {
                    Image(systemName: photoSaver.isDownloading ? "arrow.down.circle" : "square.and.arrow.down")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.black.opacity(0.56), in: Circle())
                }
                .disabled(photoSaver.isDownloading)
                .accessibilityLabel("保存到相册")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: selectedMedia?.contentKind == .video ? .topLeading : .topTrailing
        )
    }

    private var mediaFilmstrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(media) { item in
                    Button {
                        withAnimation(.snappy(duration: 0.22)) {
                            selectedMediaID = item.id
                        }
                    } label: {
                        MediaFilmstripItem(media: item, isSelected: item.id == selectedMediaID)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("查看媒体 \((media.firstIndex { $0.id == item.id } ?? 0) + 1)")
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private var previewFooter: some View {
        HStack(spacing: 10) {
            Text("\((media.firstIndex { $0.id == selectedMediaID } ?? 0) + 1) / \(media.count)")
                .font(.caption.monospaced().weight(.medium))
                .foregroundStyle(.white.opacity(0.88))

            Text(selectedMedia?.fileName ?? selectedMedia?.downloadLabel ?? "媒体预览")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.66))
                .lineLimit(1)

            Spacer(minLength: 0)

            if photoSaver.isDownloading {
                ProgressView(value: photoSaver.progress)
                    .tint(NexusPalette.jade)
                    .frame(width: 56)
            } else if let message = photoSaver.message {
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(photoSaver.didSucceed ? NexusPalette.jade : .white.opacity(0.72))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 13)
        .frame(height: 38)
        .background(.black.opacity(0.62), in: Capsule())
        .padding(.horizontal, 16)
    }
}

private struct MediaFilmstripItem: View {
    let media: ResourceMedia
    let isSelected: Bool

    var body: some View {
        ZStack {
            if let url = media.previewImageURL {
                AsyncImage(url: url) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Rectangle().fill(NexusPalette.ink700)
                    }
                }
            } else {
                Rectangle().fill(NexusPalette.ink700)
            }
            if media.contentKind != .image {
                Image(systemName: media.contentKind.placeholderSystemImage)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(5)
                    .background(.black.opacity(0.5), in: Circle())
            }
        }
        .frame(width: 54, height: 54)
        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .stroke(isSelected ? NexusPalette.jade : .white.opacity(0.24), lineWidth: isSelected ? 2 : 1)
        }
    }
}

private struct MediaPreviewPage: View {
    let media: ResourceMedia
    let isActive: Bool
    @State private var player: AVPlayer?
    @State private var isPlaying = false

    var body: some View {
        Group {
            switch media.contentKind {
            case .video:
                if let url = media.playbackURL {
                    VideoPlayer(player: player)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .task(id: isActive) {
                            guard isActive else {
                                player?.pause()
                                return
                            }
                            let item = AVPlayerItem(url: MediaDiskCache.shared.preferredURL(for: url))
                            item.preferredForwardBufferDuration = 3
                            let nextPlayer = AVPlayer(playerItem: item)
                            player = nextPlayer
                            nextPlayer.play()
                        }
                } else {
                    unavailableMedia
                }
            case .audio:
                audioPlayer
            case .image:
                if let videoURL = media.livePhotoVideoURL,
                   let photoURL = media.previewImageURL {
                    LivePhotoPreview(
                        photoURL: photoURL,
                        videoURL: videoURL,
                        isActive: isActive
                    )
                } else {
                    imagePreview
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onDisappear { player?.pause() }
    }

    private var imagePreview: some View {
        Group {
            if let url = media.displayURL {
                ZoomableRemoteImage(url: url)
            } else {
                unavailableMedia
            }
        }
        .padding(16)
    }

    private var audioPlayer: some View {
        VStack(spacing: 20) {
            Image(systemName: "waveform")
                .font(.system(size: 52, weight: .light))
                .foregroundStyle(NexusPalette.jade)
            Text(media.fileName ?? "音频文件")
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            Button {
                toggleAudioPlayback()
            } label: {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(NexusPalette.jadeInk)
                    .frame(width: 58, height: 58)
                    .background(NexusPalette.jade, in: Circle())
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task(id: isActive) {
            guard isActive else {
                player?.pause()
                isPlaying = false
                return
            }
            guard let url = media.displayURL else { return }
            let item = AVPlayerItem(url: url)
            item.preferredForwardBufferDuration = 3
            player = AVPlayer(playerItem: item)
        }
    }

    private var unavailableMedia: some View {
        ContentUnavailableView(
            "无法加载媒体",
            systemImage: "exclamationmark.triangle",
            description: Text("该媒体地址不可用或暂不支持预览。")
        )
        .foregroundStyle(NexusPalette.muted)
    }

    private func toggleAudioPlayback() {
        guard let player else { return }
        if isPlaying {
            player.pause()
        } else {
            player.play()
        }
        isPlaying.toggle()
    }
}

private struct ZoomableRemoteImage: View {
    let url: URL
    @State private var image: UIImage?
    @State private var failed = false
    @State private var scale: CGFloat = 1
    @State private var storedScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var storedOffset: CGSize = .zero

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(scale)
                        .offset(offset)
                        .gesture(zoomGesture)
                        .simultaneousGesture(
                            panGesture(in: proxy.size),
                            including: scale > 1 ? .all : .none
                        )
                        .onTapGesture(count: 2) {
                            withAnimation(.snappy(duration: 0.24)) {
                                if scale > 1 {
                                    resetZoom()
                                } else {
                                    scale = 2.5
                                    storedScale = 2.5
                                }
                            }
                        }
                } else if failed {
                    unavailableState
                } else {
                    ProgressView().tint(NexusPalette.jade)
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .task(id: url) {
            await loadImage()
        }
        .accessibilityHint("双击缩放图片，可双指缩放和拖动查看细节")
    }

    private var zoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                scale = min(max(storedScale * value, 1), 5)
            }
            .onEnded { _ in
                storedScale = scale
                if scale <= 1.02 {
                    withAnimation(.snappy(duration: 0.2)) { resetZoom() }
                }
            }
    }

    private func panGesture(in size: CGSize) -> some Gesture {
        DragGesture()
            .onChanged { value in
                guard scale > 1 else { return }
                let limitX = size.width * (scale - 1) / 2
                let limitY = size.height * (scale - 1) / 2
                offset = CGSize(
                    width: min(max(storedOffset.width + value.translation.width, -limitX), limitX),
                    height: min(max(storedOffset.height + value.translation.height, -limitY), limitY)
                )
            }
            .onEnded { _ in
                guard scale > 1 else { return }
                storedOffset = offset
            }
    }

    private var unavailableState: some View {
        ContentUnavailableView(
            "无法加载图片",
            systemImage: "exclamationmark.triangle",
            description: Text("该图片地址不可用或格式暂不支持。")
        )
        .foregroundStyle(NexusPalette.muted)
    }

    @MainActor
    private func loadImage() async {
        image = nil
        failed = false
        resetZoom()
        do {
            let cachedURL = MediaDiskCache.shared.preferredURL(for: url)
            let (data, _) = try await URLSession.shared.data(from: cachedURL)
            guard !Task.isCancelled, let loadedImage = UIImage(data: data) else {
                if !Task.isCancelled { failed = true }
                return
            }
            image = loadedImage
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }

    private func resetZoom() {
        scale = 1
        storedScale = 1
        offset = .zero
        storedOffset = .zero
    }
}

private struct LivePhotoPreview: View {
    let photoURL: URL
    let videoURL: URL
    let isActive: Bool
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var isPreparing = false

    var body: some View {
        ZStack {
            AsyncImage(url: photoURL) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().scaledToFit()
                case .failure:
                    Image(systemName: "photo")
                        .font(.largeTitle.weight(.light))
                        .foregroundStyle(NexusPalette.dim)
                default:
                    ProgressView().tint(NexusPalette.jade)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .opacity(isPlaying ? 0 : 1)

            if let player {
                PlayerLayerView(player: player) {
                    isPlaying = true
                    player.playImmediately(atRate: 1)
                }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .opacity(isPlaying ? 1 : 0)
            }

            Image(systemName: "livephoto")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(9)
                .background(.black.opacity(0.56), in: Circle())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(18)
        }
        .task(id: isActive) {
            guard isActive else {
                stopPlayback()
                return
            }
            await prepareAndPlay()
        }
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { notification in
            guard let item = notification.object as? AVPlayerItem,
                  item == player?.currentItem else { return }
            stopPlayback()
        }
        .onDisappear { stopPlayback() }
    }

    private func prepareAndPlay() async {
        guard !isPreparing else { return }
        isPreparing = true
        defer { isPreparing = false }

        do {
            let cachedURL = MediaDiskCache.shared.preferredURL(for: videoURL)
            let localURL: URL
            if cachedURL.isFileURL {
                localURL = cachedURL
            } else {
                let (temporaryURL, _) = try await URLSession.shared.download(from: videoURL)
                localURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent("nexus-live-\(UUID().uuidString).mp4")
                try FileManager.default.copyItem(at: temporaryURL, to: localURL)
            }
            guard !Task.isCancelled, isActive else { return }

            let item = AVPlayerItem(url: localURL)
            let nextPlayer = AVPlayer(playerItem: item)
            nextPlayer.isMuted = true
            player = nextPlayer
            isPlaying = false
        } catch {
            #if DEBUG
            print("[NexusVault] Live Photo video failed: \(videoURL.absoluteString) - \(error.localizedDescription)")
            #endif
        }
    }

    private func stopPlayback() {
        player?.pause()
        isPlaying = false
    }
}

private struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer
    let onReadyForDisplay: () -> Void

    func makeUIView(context: Context) -> PlayerLayerContainer {
        let view = PlayerLayerContainer()
        view.onReadyForDisplay = onReadyForDisplay
        view.playerLayer.player = player
        return view
    }

    func updateUIView(_ view: PlayerLayerContainer, context: Context) {
        view.playerLayer.player = player
        view.onReadyForDisplay = onReadyForDisplay
    }
}

private final class PlayerLayerContainer: UIView {
    var onReadyForDisplay: (() -> Void)?
    private var readinessObserver: NSKeyValueObservation?

    override class var layerClass: AnyClass { AVPlayerLayer.self }

    override init(frame: CGRect) {
        super.init(frame: frame)
        observeReadiness()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        observeReadiness()
    }

    var playerLayer: AVPlayerLayer {
        guard let layer = layer as? AVPlayerLayer else {
            fatalError("Expected AVPlayerLayer")
        }
        layer.videoGravity = .resizeAspect
        return layer
    }

    private func observeReadiness() {
        readinessObserver = playerLayer.observe(\.isReadyForDisplay, options: [.new]) { [weak self] layer, _ in
            guard layer.isReadyForDisplay else { return }
            DispatchQueue.main.async {
                self?.onReadyForDisplay?()
            }
        }
    }
}

private struct ResourceMetric: Identifiable {
    let label: String
    let value: String
    let systemImage: String

    var id: String { label }
}

private struct ResourceAttribute: Identifiable {
    let label: String
    let value: String
    let systemImage: String

    var id: String { label }
}

private struct MarkdownText: View {
    let markdown: String
    let lineLimit: Int?

    init(_ markdown: String, lineLimit: Int? = nil) {
        self.markdown = markdown
        self.lineLimit = lineLimit
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(MarkdownSegment.parse(markdown)) { segment in
                switch segment.content {
                case .text(let value):
                    Text(renderedMarkdown(value))
                        .lineLimit(lineLimit)
                        .multilineTextAlignment(.leading)
                case .image(let alt, let url):
                    MarkdownImage(alt: alt, url: url)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func renderedMarkdown(_ value: String) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
        return (try? AttributedString(markdown: value, options: options)) ?? AttributedString(value)
    }
}

private struct MarkdownSegment: Identifiable {
    enum Content {
        case text(String)
        case image(alt: String, url: String)
    }

    let id: String
    let content: Content

    static func parse(_ markdown: String) -> [MarkdownSegment] {
        let pattern = #"!\[([^\]]*)\]\((?:<([^>]+)>|([^\s\)]+))(?:\s+[\"'][^\"']*[\"'])?\)|<img\b[^>]*\bsrc\s*=\s*[\"']([^\"']+)[\"'][^>]*>"#
        guard let expression = try? NSRegularExpression(pattern: pattern) else {
            return [MarkdownSegment(id: "text-0", content: .text(markdown))]
        }

        let range = NSRange(markdown.startIndex..., in: markdown)
        let matches = expression.matches(in: markdown, range: range)
        guard !matches.isEmpty else {
            return [MarkdownSegment(id: "text-0", content: .text(markdown))]
        }

        var segments: [MarkdownSegment] = []
        var cursor = markdown.startIndex

        for (index, match) in matches.enumerated() {
            guard let wholeRange = Range(match.range, in: markdown) else {
                continue
            }

            if cursor < wholeRange.lowerBound {
                segments.append(
                    MarkdownSegment(
                        id: "text-\(index)",
                        content: .text(String(markdown[cursor..<wholeRange.lowerBound]))
                    )
                )
            }

            let markdownAlt = Range(match.range(at: 1), in: markdown).map { String(markdown[$0]) }
            let markdownURL = [2, 3]
                .compactMap { Range(match.range(at: $0), in: markdown) }
                .first
                .map { String(markdown[$0]) }
            let htmlURL = Range(match.range(at: 4), in: markdown).map { String(markdown[$0]) }
            guard let rawURL = (markdownURL ?? htmlURL)?
                .trimmingCharacters(in: CharacterSet(charactersIn: "<>")),
                !rawURL.isEmpty else {
                cursor = wholeRange.upperBound
                continue
            }
            segments.append(
                MarkdownSegment(
                    id: "image-\(index)-\(rawURL)",
                    content: .image(alt: markdownAlt ?? "", url: rawURL)
                )
            )
            cursor = wholeRange.upperBound
        }

        if cursor < markdown.endIndex {
            segments.append(
                MarkdownSegment(
                    id: "text-tail",
                    content: .text(String(markdown[cursor...]))
                )
            )
        }

        return segments
    }
}

private struct MarkdownImage: View {
    let alt: String
    let url: String

    var body: some View {
        Group {
            if let resolvedURL = resolveNexusURL(url) {
                if resolvedURL.isGIF {
                    AnimatedGIFImage(url: resolvedURL, alt: alt)
                } else {
                    AsyncImage(url: resolvedURL, transaction: Transaction(animation: .snappy(duration: 0.22))) { phase in
                        switch phase {
                        case let .success(image):
                            image
                                .resizable()
                                .scaledToFit()
                        case let .failure(error):
                            markdownImageFallback
                                .task(id: resolvedURL) {
                                    #if DEBUG
                                    print("[NexusVault] Markdown image failed: \(resolvedURL.absoluteString) - \(error.localizedDescription)")
                                    #endif
                                }
                        default:
                            Rectangle()
                                .fill(NexusPalette.ink700)
                                .overlay { ProgressView().tint(NexusPalette.jade) }
                        }
                    }
                }
            } else {
                markdownImageFallback
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 120)
        .layoutPriority(-1)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(NexusPalette.line.opacity(0.7), lineWidth: 1)
        }
    }

    private var markdownImageFallback: some View {
        VStack(spacing: 6) {
            Image(systemName: "photo")
            if !alt.isEmpty {
                Text(alt)
                    .font(.caption)
                    .lineLimit(2)
            }
        }
        .foregroundStyle(NexusPalette.dim)
        .frame(maxWidth: .infinity, minHeight: 120)
        .background(NexusPalette.ink700)
    }
}

private struct AnimatedGIFImage: View {
    let url: URL
    let alt: String
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                AnimatedUIImageView(image: image)
                    .frame(maxWidth: .infinity)
                    .layoutPriority(0)
            } else if failed {
                VStack(spacing: 6) {
                    Image(systemName: "photo")
                    if !alt.isEmpty {
                        Text(alt).font(.caption).lineLimit(2)
                    }
                }
                .foregroundStyle(NexusPalette.dim)
                .frame(maxWidth: .infinity, minHeight: 120)
                .background(NexusPalette.ink700)
            } else {
                Rectangle()
                    .fill(NexusPalette.ink700)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .overlay { ProgressView().tint(NexusPalette.jade) }
            }
        }
        .task(id: url) {
            await loadGIF()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipped()
    }

    @MainActor
    private func loadGIF() async {
        do {
            let (data, _) = try await URLSession.shared.data(from: MediaDiskCache.shared.preferredURL(for: url))
            image = animatedImage(from: data)
            failed = image == nil
        } catch {
            failed = true
            #if DEBUG
            print("[NexusVault] GIF image failed: \(url.absoluteString) - \(error.localizedDescription)")
            #endif
        }
    }

    private func animatedImage(from data: Data) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            return nil
        }
        let count = CGImageSourceGetCount(source)
        guard count > 1 else { return UIImage(data: data) }

        var frames: [UIImage] = []
        var duration: TimeInterval = 0
        for index in 0..<count {
            guard let image = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
            let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
            let gifProperties = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
            let delay = (gifProperties?[kCGImagePropertyGIFUnclampedDelayTime] as? NSNumber)?.doubleValue ??
                (gifProperties?[kCGImagePropertyGIFDelayTime] as? NSNumber)?.doubleValue ?? 0.1
            duration += max(delay, 0.02)
            frames.append(UIImage(cgImage: image))
        }
        return UIImage.animatedImage(with: frames, duration: duration)
    }
}

private struct AnimatedUIImageView: UIViewRepresentable {
    let image: UIImage

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UIImageView, context: Context) -> CGSize? {
        guard image.size.width > 0, image.size.height > 0 else { return nil }
        let width = proposal.width ?? min(image.size.width, 360)
        return CGSize(width: width, height: width * image.size.height / image.size.width)
    }

    func makeUIView(context: Context) -> UIImageView {
        let view = UIImageView()
        view.setContentHuggingPriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        view.contentMode = .scaleAspectFit
        view.clipsToBounds = true
        view.image = image
        view.startAnimating()
        return view
    }

    func updateUIView(_ view: UIImageView, context: Context) {
        view.image = image
        view.startAnimating()
    }
}

private extension VaultResource {
    var metadataData: ResourceMetadataData? { metadata?.data }

    var media: [ResourceMedia] {
        metadataData?.media?.filter { $0.displayURL != nil } ?? []
    }

    var primaryMedia: ResourceMedia? { media.first }

    var downloadableMedia: [ResourceMedia] {
        media.filter { $0.photoLibraryDownloadURL != nil }
    }

    var masonryMediaHeight: CGFloat {
        guard let media = primaryMedia,
              let width = media.width,
              let height = media.height,
              width > 0,
              height > 0 else {
            return previewKind == "social_video" ? 190 : 142
        }

        let aspectRatio = CGFloat(height) / CGFloat(width)
        return min(max(136 * aspectRatio, 112), 236)
    }

    func estimatedMasonryHeight(showsMediaContent: Bool) -> CGFloat {
        let titleLines = displayTitle.count > 30 ? 3 : (displayTitle.count > 16 ? 2 : 1)
        let descriptionLines = displayDescription.isEmpty ? 0 : (displayDescription.count > 44 ? 3 : 2)
        let mediaHeight = showsMediaContent && primaryMedia != nil ? masonryMediaHeight : 0
        return mediaHeight + CGFloat(64 + titleLines * 22 + descriptionLines * 16)
    }

    var previewKind: String? { metadataData?.preview?.kind }

    var displayTitle: String {
        let value = metadataData?.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value! : title
    }

    var displayDescription: String {
        let metadataDescription = metadataData?.description?.trimmingCharacters(in: .whitespacesAndNewlines)
        return metadataDescription?.isEmpty == false ? metadataDescription! : description
    }

    var resourceAttributes: [ResourceAttribute] {
        let data = metadataData
        var attributes: [ResourceAttribute] = []

        if let size = data?.size ?? primaryMedia?.size, size > 0 {
            attributes.append(ResourceAttribute(label: "大小", value: byteCount(size), systemImage: "internaldrive"))
        }
        if let fileCount = data?.fileCount, fileCount > 0 {
            attributes.append(ResourceAttribute(label: "文件", value: "\(fileCount)", systemImage: "doc.on.doc"))
        }
        if let fileType = data?.fileType, !fileType.isEmpty {
            attributes.append(ResourceAttribute(label: "格式", value: fileType.uppercased(), systemImage: "doc"))
        }
        if let duration = primaryMedia?.duration, !duration.isEmpty {
            attributes.append(ResourceAttribute(label: "时长", value: duration, systemImage: "timer"))
        }
        return attributes
    }

    var platformLabel: String {
        switch previewKind {
        case "x_post", "x_profile": "X"
        case "social_video": previewString("platform")?.uppercased() ?? "VIDEO"
        case "github_repository", "github_user", "github_release": "GITHUB"
        case "telegram_message": "TELEGRAM"
        default:
            switch type {
            case "twitter": "X"
            case "douyin": "DOUYIN"
            case "local_media": "MEDIA"
            case "magnet": "MAGNET"
            case "github": "GITHUB"
            default: "LINK"
            }
        }
    }

    var platformSystemImage: String {
        switch platformLabel {
        case "X": "text.bubble.fill"
        case "DOUYIN", "TIKTOK", "BILIBILI", "VIDEO": "play.rectangle.fill"
        case "GITHUB": "chevron.left.forwardslash.chevron.right"
        case "TELEGRAM": "paperplane.fill"
        case "MEDIA": "photo.on.rectangle.angled"
        case "MAGNET": "link"
        default: "link"
        }
    }

    var platformColor: Color {
        switch platformLabel {
        case "X": Color(red: 92 / 255, green: 185 / 255, blue: 240 / 255)
        case "DOUYIN", "TIKTOK", "BILIBILI", "VIDEO": Color(red: 240 / 255, green: 105 / 255, blue: 122 / 255)
        case "GITHUB": Color(red: 155 / 255, green: 140 / 255, blue: 255 / 255)
        case "TELEGRAM": Color(red: 92 / 255, green: 185 / 255, blue: 240 / 255)
        case "MAGNET": Color(red: 155 / 255, green: 140 / 255, blue: 255 / 255)
        default: NexusPalette.jade
        }
    }

    var previewMetrics: [ResourceMetric] {
        [
            ("likes", "heart"),
            ("views", "eye"),
            ("plays", "play"),
            ("comments", "bubble.left"),
            ("stars", "star"),
        ].compactMap { key, symbol in
            guard let value = previewNumber(key) else { return nil }
            return ResourceMetric(label: key, value: compactMetric(value), systemImage: symbol)
        }
    }

    var destinationURL: URL? {
        guard let value = url ?? metadataData?.source?.url else { return nil }
        return resolveNexusURL(value)
    }

    private func previewString(_ key: String) -> String? {
        metadataData?.preview?.data[key]?.stringValue
    }

    private func previewNumber(_ key: String) -> Double? {
        metadataData?.preview?.data[key]?.numberValue ??
            (metadataData?.preview?.data["metrics"]?.objectValue?[key]?.numberValue)
    }

    private func compactMetric(_ value: Double) -> String {
        if value >= 10_000 {
            return String(format: "%.1fK", value / 1_000)
        }
        return String(Int(value))
    }

    private func byteCount(_ value: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(value), countStyle: .file)
    }
}

private extension ResourceMedia {
    var livePhotoVideoURL: URL? {
        guard metadata?.mediaType == "live_photo",
              let value = metadata?.livePhoto?.url else { return nil }
        return socialVideoMediaURL(value) ?? resolveNexusURL(value)
    }

    var contentKind: ResourceMediaContentKind {
        let kind = kind.lowercased()
        let mimeType = mimeType?.lowercased() ?? ""
        let pathExtension = URL(string: url ?? "")?.pathExtension.lowercased() ?? ""

        if kind == "video" || mimeType.hasPrefix("video/") || ["mp4", "mov", "m4v", "webm"].contains(pathExtension) {
            return .video
        }
        if kind == "audio" || mimeType.hasPrefix("audio/") || ["mp3", "m4a", "aac", "wav", "aiff", "flac", "ogg"].contains(pathExtension) {
            return .audio
        }
        return .image
    }

    var displayURL: URL? {
        let candidates: [String?]
        switch contentKind {
        case .video, .audio:
            candidates = [url, previewURL, thumbnailURL]
        case .image:
            candidates = [previewURL, thumbnailURL, url]
        }

        return candidates
            .compactMap { $0 }
            .compactMap(resolveNexusURL)
            .first
    }

    var playbackURL: URL? {
        guard contentKind == .video else { return displayURL }
        guard shouldProxySocialVideo, let sourceURL = url else { return displayURL }
        return socialVideoMediaURL(sourceURL) ?? displayURL
    }

    var photoLibraryDownloadURL: URL? {
        if livePhotoVideoURL != nil {
            return url.flatMap(resolveNexusURL) ?? displayURL
        }
        switch contentKind {
        case .video:
            return playbackURL
        case .image:
            return displayURL
        case .audio:
            return nil
        }
    }

    func photoLibraryFileExtension(receivedMIMEType: String? = nil) -> String {
        if let receivedMIMEType,
           let fileExtension = Self.fileExtension(for: receivedMIMEType) {
            return fileExtension
        }
        if let fileName, let fileExtension = URL(fileURLWithPath: fileName).pathExtension.nilIfEmpty {
            return fileExtension.lowercased()
        }
        if let downloadExtension = photoLibraryDownloadURL?.pathExtension.nilIfEmpty {
            return downloadExtension.lowercased()
        }
        switch mimeType?.lowercased() {
        case "image/jpeg": return "jpg"
        case "image/png": return "png"
        case "image/gif": return "gif"
        case "image/webp": return "webp"
        case "image/heic", "image/heif": return "heic"
        case "video/mp4": return "mp4"
        case "video/quicktime": return "mov"
        case "video/webm": return "webm"
        default: return contentKind == .video ? "mp4" : "jpg"
        }
    }

    func requiresPhotoLibraryTranscode(receivedMIMEType: String?) -> Bool {
        guard contentKind == .image else { return false }
        let imageType = receivedMIMEType?.lowercased() ?? mimeType?.lowercased()
        return ["image/webp", "image/avif", "image/svg+xml"].contains(imageType)
    }

    private static func fileExtension(for mimeType: String) -> String? {
        switch mimeType.lowercased() {
        case "image/jpeg": "jpg"
        case "image/png": "png"
        case "image/gif": "gif"
        case "image/webp": "webp"
        case "image/heic", "image/heif": "heic"
        case "video/mp4": "mp4"
        case "video/quicktime": "mov"
        case "video/webm": "webm"
        default: UTType(mimeType: mimeType)?.preferredFilenameExtension
        }
    }

    var downloadLabel: String {
        if livePhotoVideoURL != nil { return "实况照片" }
        switch contentKind {
        case .image: return "图片"
        case .video: return "视频"
        case .audio: return "音频"
        }
    }

    var previewImageURL: URL? {
        let candidates: [String?]
        switch contentKind {
        case .video:
            candidates = [previewURL, thumbnailURL]
        case .audio:
            candidates = []
        case .image:
            candidates = [previewURL, thumbnailURL, url]
        }

        return candidates
            .compactMap { $0 }
            .compactMap(resolveNexusURL)
            .first
    }

    var displayAspectRatio: CGFloat {
        guard let width, let height, width > 0, height > 0 else {
            return contentKind == .video ? CGFloat(9) / 16 : CGFloat(4) / 3
        }
        return CGFloat(width) / CGFloat(height)
    }

    private var shouldProxySocialVideo: Bool {
        let provider = self.provider?.lowercased() ?? ""
        if ["douyin", "snapdouyin", "douyin-tiktok-download-api", "tiktok", "bilibili"].contains(provider) {
            return true
        }

        guard let host = URL(string: url ?? "")?.host?.lowercased() else { return false }
        return host.contains("douyin") ||
            host.contains("tiktok") ||
            host.contains("byteoversea") ||
            host.contains("bilibili") ||
            host.contains("hdslb")
    }
}

private func socialVideoMediaURL(_ source: String) -> URL? {
    guard let endpoint = URL(string: "api/v1/social-video/media", relativeTo: AppGroup.baseURL)?.absoluteURL else {
        return nil
    }
    var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)
    components?.queryItems = [URLQueryItem(name: "url", value: source)]
    return components?.url
}

private enum ResourceMediaContentKind: Equatable {
    case image
    case video
    case audio

    var placeholderSystemImage: String {
        switch self {
        case .image: "photo.fill"
        case .video: "film.fill"
        case .audio: "waveform"
        }
    }
}

private func resolveNexusURL(_ value: String) -> URL? {
    guard let url = URL(string: value) else { return nil }
    if let scheme = url.scheme {
        return ["http", "https"].contains(scheme.lowercased()) ? url : nil
    }
    return URL(string: value, relativeTo: AppGroup.baseURL)?.absoluteURL
}

private extension URL {
    var isGIF: Bool {
        pathExtension.caseInsensitiveCompare("gif") == .orderedSame
    }
}

private final class MediaDiskCache {
    static let shared = MediaDiskCache()

    private let directory: URL
    private let fileManager = FileManager.default

    private init() {
        directory = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("NexusVaultMedia", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func preferredURL(for remoteURL: URL) -> URL {
        guard remoteURL.isFileURL == false else { return remoteURL }
        let cachedURL = cacheURL(for: remoteURL)
        if fileManager.fileExists(atPath: cachedURL.path) {
            return cachedURL
        }
        cacheInBackground(remoteURL, destination: cachedURL)
        return remoteURL
    }

    private func cacheInBackground(_ remoteURL: URL, destination: URL) {
        Task.detached(priority: .utility) { [fileManager, directory] in
            guard !fileManager.fileExists(atPath: destination.path) else { return }
            do {
                try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
                let (temporaryURL, response) = try await URLSession.shared.download(from: remoteURL)
                guard let response = response as? HTTPURLResponse,
                      (200..<300).contains(response.statusCode),
                      !fileManager.fileExists(atPath: destination.path) else { return }
                try fileManager.moveItem(at: temporaryURL, to: destination)
            } catch {
                // Network cache misses fall back to the original remote URL.
            }
        }
    }

    private func cacheURL(for remoteURL: URL) -> URL {
        let digest = SHA256.hash(data: Data(remoteURL.absoluteString.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        let pathExtension = remoteURL.pathExtension.nilIfEmpty ?? "media"
        return directory.appendingPathComponent(digest).appendingPathExtension(pathExtension)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

private extension JSONValue {
    var objectValue: [String: JSONValue]? {
        guard case let .object(value) = self else { return nil }
        return value
    }
}

private extension View {
    func resourceCardSurface() -> some View {
        clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .background(NexusPalette.ink800.opacity(0.92), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(NexusPalette.line.opacity(0.78), lineWidth: 1)
            }
    }
}
