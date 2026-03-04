---
name: browser
description: 打开网页并获取执行 JS 后的页面快照，用于需要真实渲染或可交互元素信息的场景
version: 1.0.0
---

# browser

当需要「打开链接看看页面内容」、或需要看到执行 JavaScript 后的真实渲染结果（如 SPA、动态内容）、或需要知道页面上有哪些链接/按钮/输入框时，使用本技能。系统会用无界面浏览器打开该 URL，取回页面标题、正文摘要与可交互元素列表并注入对话。

## 与 FETCH_URL 的取舍

- **FETCH_URL**：仅做 HTTP 请求并抽取 HTML 转成纯文本，不执行 JS；适合静态页或只需原始文本时。
- **BROWSER_NAVIGATE**：用真实浏览器打开页面（执行 JS），返回渲染后的正文与可交互元素摘要；适合需要「页面长什么样、有哪些按钮/链接」时。

## 使用步骤

1. 根据用户问题或上下文确定要打开的 URL（必须是 http 或 https）。
2. 在你的回复中单独写一行：`BROWSER_NAVIGATE: <url>`（将 `<url>` 替换为完整地址）。
3. 系统会打开该页面并将快照（标题、URL、正文摘要、可交互元素）注入对话，你再根据注入内容回答用户。

## 示例

用户说「打开 https://example.com 看看上面有什么」时，你可以回复：

```
BROWSER_NAVIGATE: https://example.com
```

系统会注入该页的快照，你再基于快照做简要说明。

注意：当前每轮仅处理一个 `BROWSER_NAVIGATE`（取第一个 URL）；有 DELEGATE 时勿混用本技能。
