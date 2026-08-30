import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private var sharedURL: URL?
    private var text: String?
    private var status = UILabel()
    private var saveButton = UIButton(type: .system)
    private var vaultField = UITextField()
    private var spaceField = UITextField()
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let title = UILabel()
        title.text = "添加到 Nexus Vault"
        title.font = .preferredFont(forTextStyle: .title2)
        title.translatesAutoresizingMaskIntoConstraints = false
        status.translatesAutoresizingMaskIntoConstraints = false
        status.numberOfLines = 0
        status.text = "正在读取分享内容…"
        vaultField.placeholder = "Vault ID（先在主 App 设置默认 Vault）"
        spaceField.placeholder = "Space ID（可选）"
        for field in [vaultField, spaceField] {
            field.borderStyle = .roundedRect
            field.translatesAutoresizingMaskIntoConstraints = false
        }
        vaultField.text = AppGroup.defaults.string(forKey: "defaultVaultId")
        saveButton.setTitle("保存资源", for: .normal)
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)
        view.addSubview(title)
        view.addSubview(status)
        view.addSubview(vaultField)
        view.addSubview(spaceField)
        view.addSubview(saveButton)
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.topAnchor,
                constant: 24
            ),
            title.leadingAnchor.constraint(
                equalTo: view.leadingAnchor,
                constant: 20
            ),
            status.topAnchor.constraint(
                equalTo: title.bottomAnchor,
                constant: 24
            ), status.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            status.trailingAnchor.constraint(
                equalTo: view.trailingAnchor,
                constant: -20
            ),
            vaultField.topAnchor.constraint(
                equalTo: status.bottomAnchor,
                constant: 18
            ),
            vaultField.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            vaultField.trailingAnchor.constraint(
                equalTo: status.trailingAnchor
            ), vaultField.heightAnchor.constraint(equalToConstant: 44),
            spaceField.topAnchor.constraint(
                equalTo: vaultField.bottomAnchor,
                constant: 10
            ),
            spaceField.leadingAnchor.constraint(
                equalTo: vaultField.leadingAnchor
            ),
            spaceField.trailingAnchor.constraint(
                equalTo: vaultField.trailingAnchor
            ), spaceField.heightAnchor.constraint(equalToConstant: 44),
            saveButton.topAnchor.constraint(
                equalTo: spaceField.bottomAnchor,
                constant: 20
            ), saveButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
        ])
        loadInput()
    }
    private func loadInput() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
            let provider = item.attachments?.first
        else {
            status.text = "来源 App 不允许读取此内容"
            return
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier) {
                [weak self] value, _ in
                DispatchQueue.main.async {
                    self?.sharedURL = value as? URL
                    self?.text = self?.sharedURL?.absoluteString
                    self?.status.text = self?.text ?? "无法读取链接"
                }
            }
            return
        }
        if provider.hasItemConformingToTypeIdentifier(
            UTType.plainText.identifier
        ) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) {
                [weak self] value, _ in
                DispatchQueue.main.async {
                    self?.text = value as? String
                    self?.sharedURL = LinkParser.absoluteURL(self?.text ?? "")
                    self?.status.text = self?.text ?? "无法读取文本"
                }
            }
            return
        }
        status.text = "暂不支持此类型，请分享 URL 或文本"
    }
    @objc private func save() {
        guard let url = sharedURL else {
            status.text = "请提供有效的 http/https URL"
            return
        }
        guard let vaultId = vaultField.text, !vaultId.isEmpty else {
            status.text = "请输入 Vault ID，或先在主 App 设置默认 Vault"
            return
        }
        saveButton.isEnabled = false
        status.text = "正在保存…"
        Task {
            do {
                _ = try await APIClient.shared.createResource(
                    CreateResourceRequest(
                        vaultId: vaultId,
                        spaceId: spaceField.text?.isEmpty == true
                            ? nil : spaceField.text,
                        type: nil,
                        title: text,
                        description: "",
                        url: url.absoluteString,
                        referer: nil
                    )
                )
                await MainActor.run {
                    self.status.text = "已保存到 Nexus Vault"
                    self.extensionContext?.completeRequest(returningItems: nil)
                }
            } catch {
                await MainActor.run {
                    self.status.text = error.localizedDescription
                    self.saveButton.isEnabled = true
                }
            }
        }
    }
}
