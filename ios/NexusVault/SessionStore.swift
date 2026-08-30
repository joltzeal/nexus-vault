import Foundation
import SwiftUI

@MainActor final class SessionStore: ObservableObject {
    @Published var user: SessionUser?
    @Published var isLoading = true
    @Published var error: String?
    let api = APIClient.shared
    var isSignedIn: Bool { user != nil }
    func restore() async {
        isLoading = true
        defer { isLoading = false }
        do { user = try await api.sessionUser() } catch let caughtError {
            if let apiError = caughtError as? APIError, case .unauthorized = apiError
            {
                user = nil
            } else {
                self.error = caughtError.localizedDescription
            }
        }
    }
    func signIn(email: String, password: String) async -> Bool {
        isLoading = true
        defer { isLoading = false }
        do {
            user = try await api.signIn(email: email, password: password)
            return true
        } catch let caughtError {
            self.error = caughtError.localizedDescription
            return false
        }
    }
    func signOut() async {
        try? await api.signOut()
        user = nil
    }
}
