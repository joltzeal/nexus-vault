import SwiftUI
import UIKit

final class ShareViewController: UIViewController {
    private var hostingController: UIHostingController<ShareExtensionView>?

    override func viewDidLoad() {
        super.viewDidLoad()

        let rootView = ShareExtensionView(
            extensionContext: extensionContext,
            onCancel: { [weak self] in
                self?.extensionContext?.cancelRequest(withError: ShareExtensionError.cancelled)
            }
        )
        let hostingController = UIHostingController(rootView: rootView)
        addChild(hostingController)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hostingController.view)
        NSLayoutConstraint.activate([
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        hostingController.didMove(toParent: self)
        self.hostingController = hostingController
    }
}

private enum ShareExtensionError: LocalizedError {
    case cancelled

    var errorDescription: String? { "用户取消了分享。" }
}

