---
name: url-scraper
description: 根据用户提供的网址抓取页面内容并返回文本
version: 1.0.0
---

# url-scraper

当用户显式提供网址并希望获取该页正文/摘要时使用本技能。

## 使用步骤

1. 从用户消息中识别出 URL（或用户说「打开某链接」「抓取这个页面」等）。
2. 在你的回复中写：`FETCH_URL: <url>`（使用用户提供的完整 http(s) 地址）。
3. 系统抓取页面并注入文本后，你对内容做摘要或按用户要求回答。

## 示例

用户说「帮我看看 https://example.com/about 页写了啥」时，你可以回复：

```
FETCH_URL: https://example.com/about
```

系统会抓取该页并注入内容，你再基于内容做简要说明或摘要。与 web-fetch 共用 FETCH_URL 协议，侧重「用户显式给 URL + 要页面数据」。
