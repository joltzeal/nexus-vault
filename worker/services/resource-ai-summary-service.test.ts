import assert from "node:assert/strict"
import test from "node:test"

import type { NormalizedResourceMetadata } from "../domain/resources/metadata"
import {
  getResourceAiSummarySource,
  shouldGenerateResourceAiSummary,
} from "./resource-ai-summary-service"

function createWechatMetadata(
  description: string,
  contentHtml = "<section><script>alert(1)</script><p>公众号原文</p></section>",
): NormalizedResourceMetadata {
  return {
    schemaVersion: 1,
    type: "wechat_mp",
    title: "公众号原始标题",
    description,
    tree: [],
    fetchedAt: "2026-09-22T00:00:00.000Z",
    preview: {
      kind: "wechat_mp_article",
      data: {
        contentHtml,
        itemShowType: 0,
        title: "公众号原始标题",
      },
    },
  }
}

test("WeChat metadata can request an AI summary from its normalized description", () => {
  const data = createWechatMetadata("提供给 AI 的公众号摘要来源")

  assert.equal(shouldGenerateResourceAiSummary({
    currentDescription: "",
    data,
    env: { AI: {} } as Partial<CloudflareEnv>,
    provider: "wechat-mp-tikhub",
    status: "completed",
    type: "wechat_mp",
  }), true)
  assert.equal(
    getResourceAiSummarySource(data, "wechat-mp-tikhub"),
    "提供给 AI 的公众号摘要来源",
  )
})

test("WeChat AI summary source never includes content_noencode HTML", () => {
  const contentHtml = "<section><p>不应进入 AI 的公众号原文</p></section>"
  const data = createWechatMetadata("只使用这个纯文本描述", contentHtml)
  const source = getResourceAiSummarySource(data, "wechat-mp-tikhub")

  assert.equal(source, "只使用这个纯文本描述")
  assert.equal(source.includes(contentHtml), false)
  assert.equal(source.includes("公众号原文"), false)
})

test("WeChat AI summary respects explicit user descriptions and empty source text", () => {
  const data = createWechatMetadata("上游描述")
  assert.equal(shouldGenerateResourceAiSummary({
    currentDescription: "用户手工描述",
    data,
    env: { AI: {} } as Partial<CloudflareEnv>,
    provider: "wechat-mp-tikhub",
    status: "completed",
    type: "wechat_mp",
  }), false)

  assert.equal(shouldGenerateResourceAiSummary({
    currentDescription: "",
    data: createWechatMetadata(""),
    env: { AI: {} } as Partial<CloudflareEnv>,
    provider: "wechat-mp-tikhub",
    status: "completed",
    type: "wechat_mp",
  }), false)
})
