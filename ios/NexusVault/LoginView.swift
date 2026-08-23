import SwiftUI
import UIKit

struct LoginView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            NexusBackground()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 54)

                    ZStack {
                        Circle()
                            .stroke(NexusPalette.jade.opacity(0.18), lineWidth: 1)
                            .frame(width: 152, height: 152)
                        Circle()
                            .stroke(NexusPalette.jade.opacity(0.06), lineWidth: 18)
                            .frame(width: 188, height: 188)
                        Image(systemName: "archivebox.fill")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(NexusPalette.jade)
                            .frame(width: 66, height: 66)
                            .background(NexusPalette.jade.opacity(0.14), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .stroke(.white.opacity(0.12), lineWidth: 1)
                            }
                    }
                    .padding(.bottom, 31)

                    VStack(spacing: 12) {
                        Text("把每一个信号，\n收进你的 Vault。")
                            .font(.system(size: 31, weight: .bold, design: .rounded))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(NexusPalette.foreground)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("登录后即可从 Safari、X 或抖音快速保存，\n并在任意设备继续整理。")
                            .font(.subheadline)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(NexusPalette.muted)
                            .lineSpacing(3)
                    }

                    VStack(spacing: 11) {
                        LoginField(
                            title: "邮箱地址",
                            systemImage: "at",
                            text: $email,
                            contentType: .emailAddress,
                            keyboardType: .emailAddress,
                            isSecure: false
                        )

                        LoginField(
                            title: "密码",
                            systemImage: "lock",
                            text: $password,
                            contentType: .password,
                            keyboardType: .default,
                            isSecure: true
                        )

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red.opacity(0.9))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 2)
                        }

                        Button(action: submit) {
                            HStack(spacing: 8) {
                                if isSubmitting {
                                    ProgressView()
                                        .tint(NexusPalette.jadeInk)
                                }
                                Text(isSubmitting ? "正在登录" : "继续")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(NexusPalette.jadeInk)
                        .background(NexusPalette.jade, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .disabled(!canSubmit)
                        .opacity(canSubmit ? 1 : 0.45)
                        .padding(.top, 3)
                    }
                    .padding(14)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(.white.opacity(0.1), lineWidth: 1)
                    }
                    .padding(.top, 42)

                    Text("继续即表示你同意 Nexus Vault 的使用条款。")
                        .font(.caption2)
                        .foregroundStyle(NexusPalette.dim)
                        .padding(.top, 15)
                        .padding(.bottom, 30)
                }
                .padding(.horizontal, 22)
            }
        }
    }

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !password.isEmpty &&
            !isSubmitting
    }

    private func submit() {
        guard canSubmit else { return }
        isSubmitting = true
        errorMessage = nil

        Task { @MainActor in
            defer { isSubmitting = false }
            do {
                try await appModel.signIn(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct LoginField: View {
    let title: String
    let systemImage: String
    @Binding var text: String
    let contentType: UITextContentType
    let keyboardType: UIKeyboardType
    let isSecure: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .frame(width: 18)
                .foregroundStyle(NexusPalette.jade)

            Group {
                if isSecure {
                    SecureField(title, text: $text)
                } else {
                    TextField(title, text: $text)
                }
            }
            .textContentType(contentType)
            .keyboardType(keyboardType)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .foregroundStyle(NexusPalette.foreground)
        }
        .padding(.horizontal, 13)
        .frame(height: 48)
        .background(NexusPalette.ink900.opacity(0.52), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.white.opacity(0.07), lineWidth: 1)
        }
    }
}
