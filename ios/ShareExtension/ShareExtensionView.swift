import SwiftUI

struct ShareExtensionView: View {
    @StateObject private var model: ShareExtensionModel
    private let onCancel: () -> Void

    init(extensionContext: NSExtensionContext?, onCancel: @escaping () -> Void) {
        _model = StateObject(wrappedValue: ShareExtensionModel(extensionContext: extensionContext))
        self.onCancel = onCancel
    }

    var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .loading:
                    ProgressView("正在读取分享内容")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failed(let message):
                    ContentUnavailableView {
                        Label("无法添加", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("关闭", action: onCancel)
                    }
                case .ready, .saving:
                    editor
                }
            }
            .navigationTitle("添加到 Nexus Vault")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消", action: onCancel)
                }
                if !isFailed {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("添加") {
                            Task { await model.save() }
                        }
                        .fontWeight(.semibold)
                        .disabled(!model.canSave)
                    }
                }
            }
        }
        .task { await model.load() }
    }

    private var editor: some View {
        Form {
            Section("保存到") {
                Picker("Vault", selection: $model.selectedVaultID) {
                    ForEach(model.vaults) { vault in
                        Text(vault.title).tag(vault.id)
                    }
                }
            }

            Section("内容") {
                Text(model.url)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .textSelection(.enabled)

                TextField("标题（可选）", text: $model.title, axis: .vertical)
                    .lineLimit(1...3)
                TextField("备注（可选）", text: $model.description, axis: .vertical)
                    .lineLimit(2...5)
            }

            if let errorMessage = model.errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            if case .saving = model.phase {
                HStack {
                    Spacer()
                    ProgressView("正在添加")
                    Spacer()
                }
            }
        }
        .disabled(isSaving)
    }

    private var isSaving: Bool {
        if case .saving = model.phase { return true }
        return false
    }

    private var isFailed: Bool {
        if case .failed = model.phase { return true }
        return false
    }
}
