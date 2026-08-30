import UIKit
import UniformTypeIdentifiers

final class ActionViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let label = UILabel(frame: view.bounds.insetBy(dx: 20, dy: 20))
        label.numberOfLines = 0
        label.textAlignment = .center
        label.text = "Nexus Vault\n正在处理…"
        view.addSubview(label)
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
            let provider = item.attachments?.first
        else {
            label.text = "无法读取来源内容"
            return
        }
        provider.loadItem(forTypeIdentifier: UTType.url.identifier) {
            [weak self] value, _ in
            guard let url = value as? URL else {
                DispatchQueue.main.async { label.text = "请在链接上使用此操作" }
                return
            }
            Task {
                do {
                    _ = try await APIClient.shared.createResource(
                        CreateResourceRequest(
                            vaultId: AppGroup.defaults.string(
                                forKey: "defaultVaultId"
                            ) ?? "",
                            spaceId: nil,
                            type: nil,
                            title: url.absoluteString,
                            description: "",
                            url: url.absoluteString,
                            referer: nil
                        )
                    )
                    await MainActor.run {
                        label.text = "已添加到 Nexus Vault"
                        self?.extensionContext?.completeRequest(
                            returningItems: nil
                        )
                    }
                } catch {
                    await MainActor.run {
                        label.text = error.localizedDescription
                    }
                }
            }
        }
    }
}
