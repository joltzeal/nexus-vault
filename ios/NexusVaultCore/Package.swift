// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NexusVaultCore",
    platforms: [.iOS(.v16), .macOS(.v12)],
    products: [.library(name: "NexusVaultCore", targets: ["NexusVaultCore"])],
    targets: [
        .target(name: "NexusVaultCore"),
        .testTarget(name: "NexusVaultCoreTests", dependencies: ["NexusVaultCore"]),
    ]
)
