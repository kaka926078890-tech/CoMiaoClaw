/**
 * 用「假主回复」验证 DELEGATE 管道：解析 → 子 agent 调用 → 子结果。
 * 与网关共用同一模型：设置 OLLAMA_MODEL（如 deepseek-r1:8b）或使用网关默认。
 * 需先 cd gateway && npm run build，再从项目根目录运行：node script/verify-delegate-pipeline.mjs
 * 要求：Ollama 已启动，gateway/data/subpersona/researcher.md、coder.md 存在。
 */
import { parseDelegate, runSubAgents } from "../gateway/dist/delegate.js";

const fakeMainReply = `好的，我来派发子任务。
DELEGATE: 查一下什么是 REST API | researcher
DELEGATE: 用 Node 写一段 fetch 请求示例 | coder
`;

console.log("1. 假主回复（含 DELEGATE）：");
console.log(fakeMainReply);
console.log("2. parseDelegate 结果：");
const delegates = parseDelegate(fakeMainReply);
console.log(delegates);
if (delegates.length === 0) {
  console.error("解析不到 DELEGATE，管道无法验证。");
  process.exit(1);
}
const modelOverride = process.env.OLLAMA_MODEL || undefined;
if (modelOverride) console.log("使用模型:", modelOverride);
console.log("3. 调用子 agent（串行，与主 agent 同一模型）…");
const subResult = await runSubAgents(delegates, modelOverride);
console.log("4. 子任务结果：");
console.log(subResult);
console.log("\n--- DELEGATE 管道验证通过（解析 + 子 agent 调用正常）。---");
