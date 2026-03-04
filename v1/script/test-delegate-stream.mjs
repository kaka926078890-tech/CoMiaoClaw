/**
 * 模拟前端：向 /chat/stream 发一条会触发 DELEGATE 的测试消息，打印 SSE 输出。
 * 用法：在项目根目录执行 node script/test-delegate-stream.mjs
 * 要求：前端 dev（5173）或网关（3000）已启动；与网关共用同一模型（从 /config 读取）。
 */
const BASE = "http://localhost:5173";
const TEST_MESSAGE =
  "先让 researcher 查一下什么是 REST API，再让 coder 写一段简单的 Node fetch 示例。";

async function main() {
  let model;
  try {
    const cfgRes = await fetch(BASE + "/config");
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      model = cfg.ollamaModel || undefined;
    }
  } catch (_) {}
  const body = model ? { message: TEST_MESSAGE, model } : { message: TEST_MESSAGE };
  console.log("请求:", BASE + "/chat/stream", model ? "model=" + model : "");
  console.log("消息:", TEST_MESSAGE);
  console.log("---");

  const res = await fetch(BASE + "/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("HTTP", res.status, await res.text());
    process.exit(1);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    console.error("无 body");
    process.exit(1);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      const dataStr = t.slice(6);
      if (dataStr === "[DONE]") {
        console.log("\n[DONE]");
        console.log("---\n完整回复长度:", fullText.length, "字符");
        return;
      }
      try {
        const data = JSON.parse(dataStr);
        if (data.chunk) {
          process.stdout.write(data.chunk);
          fullText += data.chunk;
        }
        if (data.thinking) process.stdout.write("[thinking] ");
      } catch (_) {}
    }
  }
  console.log("\n---\n完整回复长度:", fullText.length, "字符");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
