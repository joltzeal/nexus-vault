import XCTest
@testable import NexusVault

final class LinkParserTests: XCTestCase {
    func testExtractsDouyinShortLinkFromShareText() {
        let text = "7.32 复制打开抖音，看看这个作品 https://v.douyin.com/abc123/ 03/21"

        XCTAssertEqual(LinkParser.firstURL(in: text)?.absoluteString, "https://v.douyin.com/abc123/")
    }

    func testPrefersTwitterLinkOverUnrelatedLink() {
        let text = "Source https://example.com More https://x.com/openai/status/123"

        XCTAssertEqual(
            LinkParser.firstURL(in: text)?.absoluteString,
            "https://x.com/openai/status/123"
        )
    }

    func testBuildsTitleByRemovingSharedURL() {
        let url = URL(string: "https://x.com/openai/status/123")!

        XCTAssertEqual(
            LinkParser.suggestedTitle(from: "A useful post https://x.com/openai/status/123", url: url),
            "A useful post"
        )
    }
}
