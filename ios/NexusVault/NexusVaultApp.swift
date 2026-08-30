import SwiftUI

@main struct NexusVaultApp: App {
    @StateObject private var session = SessionStore()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(session).preferredColorScheme(.dark)
        }
    }
}
struct RootView: View {
    @EnvironmentObject var session: SessionStore
    var body: some View {
        Group {
            if session.isLoading {
                ProgressView("连接 Nexus Vault…")
            } else if session.isSignedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }.task { await session.restore() }.tint(NVTheme.accent).background(
            NVTheme.background.ignoresSafeArea()
        )
    }
}
enum NVTheme {
    static let background = Color(red: 0.047, green: 0.067, blue: 0.086)
    static let surface = Color(red: 0.075, green: 0.1, blue: 0.125)
    static let accent = Color(red: 0.247, green: 0.847, blue: 0.69)
}
struct LoginView: View {
    @EnvironmentObject var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    Spacer(minLength: 45)
                    Image(systemName: "square.stack.3d.up.fill").font(
                        .system(size: 48)
                    ).foregroundStyle(NVTheme.accent)
                    Text("Nexus Vault").font(
                        .system(.largeTitle, design: .rounded).bold()
                    )
                    Text("你的外部资源知识空间").foregroundStyle(.secondary)
                    VStack(spacing: 14) {
                        TextField("邮箱", text: $email).textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never).padding()
                            .background(NVTheme.surface).clipShape(
                                RoundedRectangle(cornerRadius: 8)
                            )
                        HStack {
                            Group {
                                if showPassword {
                                    TextField("密码", text: $password)
                                } else {
                                    SecureField("密码", text: $password)
                                }
                            }
                            Button {
                                showPassword.toggle()
                            } label: {
                                Image(
                                    systemName: showPassword
                                        ? "eye.slash" : "eye"
                                )
                            }
                        }.padding().background(NVTheme.surface).clipShape(
                            RoundedRectangle(cornerRadius: 8)
                        )
                    }.padding(.top, 12)
                    if let e = session.error {
                        Text(e).foregroundStyle(.red).frame(
                            maxWidth: .infinity,
                            alignment: .leading
                        )
                    }
                    Button {
                        Task {
                            _ = await session.signIn(
                                email: email,
                                password: password
                            )
                        }
                    } label: {
                        HStack {
                            if session.isLoading { ProgressView().tint(.black) }
                            Text("登录").fontWeight(.semibold)
                        }.frame(maxWidth: .infinity).padding()
                    }.buttonStyle(.borderedProminent).tint(NVTheme.accent)
                        .foregroundStyle(.black).disabled(
                            email.isEmpty || password.isEmpty
                                || session.isLoading
                        )
                    Text("使用生产 API · nexus-vault.stacklabs.space").font(
                        .caption
                    ).foregroundStyle(.tertiary)
                    Spacer(minLength: 30)
                }.padding(24)
            }.scrollDismissesKeyboard(.interactively)
        }.background(NVTheme.background)
    }
}
struct MainTabView: View {
    var body: some View {
        TabView {
            VaultListView().tabItem {
                Label("Vault", systemImage: "square.stack.3d.up")
            }
            ResourceListView(mode: .starred).tabItem {
                Label("收藏", systemImage: "star.fill")
            }
            ResourceListView(mode: .later).tabItem {
                Label("稍后", systemImage: "clock")
            }
            SettingsView().tabItem { Label("设置", systemImage: "gearshape") }
        }
    }
}
@MainActor final class VaultListModel: ObservableObject {
    @Published var vaults: [VaultSummary] = []
    @Published var loading = false
    @Published var error: String?
    func load(query: String? = nil) async {
        loading = true
        defer { loading = false }
        do {
            vaults = try await APIClient.shared.loadVaults(query: query)
            error = nil
        } catch let caughtError { self.error = caughtError.localizedDescription }
    }
}
struct VaultListView: View {
    @StateObject private var model = VaultListModel()
    @State private var search = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                if model.loading && model.vaults.isEmpty {
                    ProgressView().padding(50)
                } else if let e = model.error, model.vaults.isEmpty {
                    ErrorState(message: e) {
                        Task { await model.load(query: search) }
                    }
                } else if model.vaults.isEmpty {
                    EmptyState(title: "还没有 Vault", message: "创建或导入你的第一个知识空间")
                } else {
                    LazyVGrid(
                        columns: [
                            GridItem(.flexible()), GridItem(.flexible()),
                        ],
                        spacing: 12
                    ) {
                        ForEach(model.vaults) { vault in
                            NavigationLink {
                                VaultDetailView(vault: vault)
                            } label: {
                                VaultCard(vault: vault)
                            }.buttonStyle(.plain)
                        }
                    }.padding(16)
                }
            }.navigationTitle("Vaults · \(model.vaults.count)").searchable(
                text: $search,
                prompt: "搜索名称或描述"
            ).refreshable {
                await model.load(query: search.isEmpty ? nil : search)
            }.task { if model.vaults.isEmpty { await model.load() } }
        }
    }
}
struct VaultCard: View {
    let vault: VaultSummary
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            RoundedRectangle(cornerRadius: 5).fill(cardColor).frame(height: 7)
            Text(vault.title).font(.system(.headline, design: .rounded))
                .lineLimit(2)
            Text("\(vault.resourceCount ?? 0) resources").font(
                .caption.monospaced()
            ).foregroundStyle(.secondary)
            if let owner = vault.ownerName {
                Text(owner).font(.caption2).foregroundStyle(.tertiary)
            }
        }.padding(14).frame(minHeight: 126, alignment: .top).background(
            NVTheme.surface
        ).overlay(
            RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.08))
        ).clipShape(RoundedRectangle(cornerRadius: 8))
    }
    private var cardColor: Color {
        [.blue, .purple, .orange, NVTheme.accent][abs(vault.id.hashValue) % 4]
    }
}
struct VaultDetailView: View {
    let vault: VaultSummary
    @State private var detail: VaultDetailPayload?
    @State private var error: String?
    @State private var listMode = false
    var body: some View {
        ScrollView {
            if let d = detail {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(d.vault.title).font(
                            .system(.largeTitle, design: .rounded).bold()
                        )
                        if let desc = d.vault.description, !desc.isEmpty {
                            Text(desc).foregroundStyle(.secondary)
                        }
                        Text(
                            "\(d.resources.count) resources · \(d.spaces.count) spaces"
                        ).font(.caption.monospaced()).foregroundStyle(
                            NVTheme.accent
                        )
                    }.padding(.horizontal, 16)
                    Picker("视图", selection: $listMode) {
                        Text("瀑布流").tag(false)
                        Text("列表").tag(true)
                    }.pickerStyle(.segmented).padding(.horizontal, 16)
                    ForEach(d.spaces) { space in
                        SpaceSection(
                            space: space,
                            resources: d.resources.filter {
                                $0.spaceId == space.id
                            },
                            listMode: listMode
                        )
                    }
                    let unassigned = d.resources.filter { $0.spaceId == nil }
                    if !unassigned.isEmpty {
                        SpaceSection(
                            space: VaultSpace(
                                id: "none",
                                name: "未分类",
                                description: nil,
                                icon: "tray",
                                position: nil
                            ),
                            resources: unassigned,
                            listMode: listMode
                        )
                    }
                }.padding(.vertical, 16)
            } else if let e = error {
                ErrorState(message: e) { Task { await load() } }
            } else {
                ProgressView().padding(50)
            }
        }.navigationTitle(vault.title).navigationBarTitleDisplayMode(.inline)
            .task { await load() }.refreshable { await load() }
    }
    private func load() async {
        do {
            detail = try await APIClient.shared.loadVaultDetail(vault.id)
            error = nil
        } catch let caughtError { self.error = caughtError.localizedDescription }
    }
}
struct SpaceSection: View {
    let space: VaultSpace
    let resources: [VaultResource]
    let listMode: Bool
    @State private var expanded = true
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation { expanded.toggle() }
            } label: {
                HStack {
                    Image(systemName: space.icon ?? "folder")
                    Text(space.name).font(.headline)
                    Spacer()
                    Text("\(resources.count)").font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                    Image(
                        systemName: expanded ? "chevron.down" : "chevron.right"
                    )
                }
            }.buttonStyle(.plain).padding(.horizontal, 16)
            if expanded {
                if let desc = space.description, !desc.isEmpty {
                    Text(desc).font(.subheadline).foregroundStyle(.secondary)
                        .padding(.horizontal, 28)
                }
                if listMode {
                    LazyVStack(spacing: 8) {
                        ForEach(resources) { ResourceRow(resource: $0) }
                    }.padding(.horizontal, 16)
                } else {
                    MasonryResources(resources: resources).padding(
                        .horizontal,
                        16
                    )
                }
            }
        }.padding(.vertical, 8)
    }
}
struct MasonryResources: View {
    let resources: [VaultResource]
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            LazyVStack(spacing: 8) {
                ForEach(
                    Array(resources.enumerated().filter { $0.offset % 2 == 0 }),
                    id: \.element.id
                ) { ResourceCard(resource: $0.element) }
            }
            LazyVStack(spacing: 8) {
                ForEach(
                    Array(resources.enumerated().filter { $0.offset % 2 == 1 }),
                    id: \.element.id
                ) { ResourceCard(resource: $0.element) }
            }
        }
    }
}
struct ResourceCard: View {
    let resource: VaultResource
    @State private var showDetail = false
    var body: some View {
        Button {
            showDetail = true
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                MediaPreview(resource: resource)
                Text(resource.title).font(.subheadline.weight(.semibold))
                    .lineLimit(3)
                HStack {
                    Text(resource.displayProvider).font(.caption2.monospaced())
                        .foregroundStyle(NVTheme.accent)
                    Spacer()
                    if resource.isStarred == true {
                        Image(systemName: "star.fill").foregroundStyle(.yellow)
                    }
                }
            }.padding(10).background(NVTheme.surface).overlay(
                RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.08))
            ).clipShape(RoundedRectangle(cornerRadius: 8))
        }.buttonStyle(.plain).sheet(isPresented: $showDetail) {
            ResourceDetailView(resource: resource)
        }
    }
}
struct ResourceRow: View {
    let resource: VaultResource
    var body: some View {
        NavigationLink {
            ResourceDetailView(resource: resource)
        } label: {
            HStack(spacing: 12) {
                MediaPreview(resource: resource).frame(width: 76, height: 76)
                    .clipShape(RoundedRectangle(cornerRadius: 7))
                VStack(alignment: .leading, spacing: 5) {
                    Text(resource.title).font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                    Spacer()
                    HStack {
                        Text(resource.displayProvider).font(
                            .caption2.monospaced()
                        ).foregroundStyle(NVTheme.accent)
                        Spacer()
                        Text(resource.type).font(.caption2).foregroundStyle(
                            .secondary
                        )
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }.padding(10).background(NVTheme.surface).clipShape(
                RoundedRectangle(cornerRadius: 8)
            )
        }.buttonStyle(.plain)
    }
}
struct MediaPreview: View {
    let resource: VaultResource
    var body: some View {
        Group {
            if let s = resource.metadata?.data?.thumbnailURL ?? resource
                .metadata?.data?.previewURL ?? resource.url,
                let url = URL(string: s)
            {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFit()
                    case .failure: placeholder
                    default:
                        ProgressView().frame(maxWidth: .infinity, minHeight: 80)
                    }
                }
            } else {
                placeholder
            }
        }.frame(maxWidth: .infinity).background(Color.black.opacity(0.2))
    }
    private var placeholder: some View {
        Image(systemName: "link").font(.title2).foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 80)
    }
}
struct ResourceDetailView: View {
    let resource: VaultResource
    @Environment(\.dismiss) private var dismiss
    @State private var starred: Bool
    @State private var later: Bool
    @State private var checked: Bool
    @State private var rating: Int
    @State private var comment: String
    @State private var saving = false
    @State private var savingMedia = false
    init(resource: VaultResource) {
        self.resource = resource
        _starred = State(initialValue: resource.isStarred ?? false)
        _later = State(initialValue: resource.isReadLater ?? false)
        _checked = State(initialValue: resource.annotation?.checked ?? false)
        _rating = State(initialValue: resource.annotation?.rating ?? 0)
        _comment = State(initialValue: resource.annotation?.comment ?? "")
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !resource.media.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(resource.media) { media in
                                    if let s = media.url ?? media.previewURL,
                                        let url = URL(string: s)
                                    {
                                        AsyncImage(url: url) { phase in
                                            if case .success(let image) = phase
                                            {
                                                image.resizable().scaledToFit()
                                            } else {
                                                ProgressView()
                                            }
                                        }.frame(width: 180, height: 130)
                                            .clipShape(
                                                RoundedRectangle(
                                                    cornerRadius: 8
                                                )
                                            )
                                    }
                                }
                            }
                        }
                    }
                    Text(resource.title).font(.title2.bold())
                    HStack {
                        Text(resource.displayProvider).font(
                            .caption.monospaced()
                        ).foregroundStyle(NVTheme.accent)
                        Text(resource.type).font(.caption).foregroundStyle(
                            .secondary
                        )
                    }
                    if let desc = resource.description, !desc.isEmpty {
                        Text(
                            (try? AttributedString(markdown: desc))
                                ?? AttributedString(desc)
                        )
                    }
                    HStack {
                        Button {
                            Task { await toggleStar() }
                        } label: {
                            Label(
                                starred ? "已收藏" : "收藏",
                                systemImage: starred ? "star.fill" : "star"
                            )
                        }.buttonStyle(.bordered)
                        Button {
                            Task { await toggleLater() }
                        } label: {
                            Label(
                                later ? "已稍后" : "稍后查看",
                                systemImage: later ? "clock.fill" : "clock"
                            )
                        }.buttonStyle(.bordered)
                    }
                    DisclosureGroup("批注") {
                        Toggle("已处理", isOn: $checked)
                        HStack {
                            Text("评分")
                            ForEach(1...5, id: \.self) { i in
                                Button {
                                    rating = i
                                } label: {
                                    Image(
                                        systemName: i <= rating
                                            ? "star.fill" : "star"
                                    ).foregroundStyle(.yellow)
                                }
                            }
                        }
                        TextField("写下评论…", text: $comment, axis: .vertical)
                            .lineLimit(3...6)
                        Button(saving ? "保存中…" : "保存批注") {
                            Task { await saveAnnotation() }
                        }.buttonStyle(.borderedProminent).disabled(saving)
                    }.padding().background(NVTheme.surface).clipShape(
                        RoundedRectangle(cornerRadius: 8)
                    )
                    if let s = resource.url, let url = URL(string: s) {
                        Link("打开原始链接", destination: url)
                    }
                }.padding(16)
            }.navigationTitle("资源详情").toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
    private func toggleStar() async {
        do {
            try await APIClient.shared.toggleStar(
                resource.id,
                enabled: !starred
            )
            starred.toggle()
        } catch {}
    }
    private func toggleLater() async {
        do {
            try await APIClient.shared.toggleReadLater(
                resource.id,
                enabled: !later
            )
            later.toggle()
        } catch {}
    }
    private func saveAnnotation() async {
        saving = true
        defer { saving = false }
        try? await APIClient.shared.updateAnnotation(
            resource.id,
            patch: AnnotationPatch(
                checked: checked,
                rating: rating == 0 ? nil : rating,
                comment: comment
            )
        )
    }
}
enum ResourceMode { case starred, later }
@MainActor final class ResourceListModel: ObservableObject {
    @Published var resources: [VaultResource] = []
    @Published var error: String?
    @Published var loading = false
    func load(mode: ResourceMode) async {
        loading = true
        defer { loading = false }
        do {
            resources =
                mode == .starred
                ? try await APIClient.shared.loadStarredResources()
                : try await APIClient.shared.loadReadLaterResources()
            error = nil
        } catch let caughtError { self.error = caughtError.localizedDescription }
    }
}
struct ResourceListView: View {
    let mode: ResourceMode
    @StateObject private var model = ResourceListModel()
    var title: String { mode == .starred ? "收藏" : "稍后查看" }
    var body: some View {
        NavigationStack {
            ScrollView {
                if model.loading && model.resources.isEmpty {
                    ProgressView().padding(50)
                } else if let e = model.error, model.resources.isEmpty {
                    ErrorState(message: e) {
                        Task { await model.load(mode: mode) }
                    }
                } else if model.resources.isEmpty {
                    EmptyState(
                        title: "暂无资源",
                        message: mode == .starred
                            ? "在资源详情中点击收藏" : "把想稍后阅读的资源放到这里"
                    )
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(model.resources) { ResourceRow(resource: $0) }
                    }.padding(16)
                }
            }.navigationTitle(title).task { await model.load(mode: mode) }
                .refreshable { await model.load(mode: mode) }
        }
    }
}
struct SettingsView: View {
    @EnvironmentObject var session: SessionStore
    var body: some View {
        NavigationStack {
            Form {
                Section("账号") {
                    if let user = session.user {
                        Label(user.email, systemImage: "person.crop.circle")
                        Button("退出登录", role: .destructive) {
                            Task { await session.signOut() }
                        }
                    }
                }
                Section("连接") {
                    LabeledContent("API", value: "nexus-vault.stacklabs.space")
                    Text("会话和媒体请求均通过 HTTPS 传输").font(.caption).foregroundStyle(
                        .secondary
                    )
                }
            }.scrollContentBackground(.hidden).background(NVTheme.background)
                .navigationTitle("设置")
        }
    }
}
struct EmptyState: View {
    let title: String
    let message: String
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "square.stack.3d.up").font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(message).font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }.frame(maxWidth: .infinity).padding(60)
    }
}
struct ErrorState: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.largeTitle)
            Text(message).multilineTextAlignment(.center)
            Button("重试", action: retry).buttonStyle(.borderedProminent)
        }.frame(maxWidth: .infinity).padding(50)
    }
}
