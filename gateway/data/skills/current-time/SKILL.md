---
name: current-time
description: 获取当前日期与时间，用于回答「现在几点」「今天几号」或需要实时时间的推理
version: 1.0.0
---

# current-time

当用户问当前时间、日期、星期几，或任务需要「现在」的真实时间时使用本技能。本地模型无法联网，需通过本技能拉取时间接口得到实时时间后再回答。

## 使用步骤

1. 当用户问「现在几点」「今天几号」「星期几」或需要基于当前时间作答时，在回复中写一行：`FETCH_URL: https://worldtimeapi.org/api/ip`
2. 系统会请求该接口并将返回内容（JSON，含 datetime、timezone、day_of_week 等）注入对话，你再根据注入内容用自然语言回答用户。

如需指定时区，可使用：`FETCH_URL: https://worldtimeapi.org/api/timezone/Asia/Shanghai`（上海时间）或 `https://worldtimeapi.org/api/timezone/Etc/UTC`（UTC）。

## 示例

用户问「现在几点了？」时，你可以回复：

```
FETCH_URL: https://worldtimeapi.org/api/ip
```

系统注入的 JSON 中会包含 `datetime`、`timezone`、`day_of_week` 等字段，你据此组织成「现在是 2025 年 3 月 x 日 星期x xx:xx（xxx 时区）」等回答即可。

注意：有 DELEGATE 时勿混用本技能；可与 SKILL: web-fetch 同轮使用（先加载再 FETCH_URL）。
