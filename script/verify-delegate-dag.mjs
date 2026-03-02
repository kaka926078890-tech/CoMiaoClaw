/**
 * 验证 DELEGATE 扩展格式与 DAG 分层执行：解析带依赖的 DELEGATE、strip、runSubAgents 按层执行。
 * 需先 cd gateway && npm run build，再从项目根目录运行：node script/verify-delegate-dag.mjs
 * 要求：Ollama 已启动，gateway/data/agents/researcher.md、coder.md 存在。
 */
import { parseDelegate, stripDelegateFromReply, runSubAgents } from "../gateway/dist/delegate.js";

const SUB_RESULT_SEP = "\n\n---\n\n";

const fakeMainReply = `好的，派发子任务如下。
DELEGATE: 用一句话说明什么是 REST API | researcher
DELEGATE: 用一句话说明什么是 HTTP 方法 GET | coder
DELEGATE: 根据前两段内容用一句话总结 | researcher | 0,1
`;

console.log("1. 假主回复（含无依赖 + 依赖 0,1）：");
console.log(fakeMainReply);

console.log("2. parseDelegate 结果：");
const delegates = parseDelegate(fakeMainReply);
console.log(JSON.stringify(delegates, null, 2));

if (delegates.length !== 3) {
  console.error("期望解析出 3 条 DELEGATE，实际:", delegates.length);
  process.exit(1);
}
if (!delegates[2].deps || String(delegates[2].deps) !== "0,1") {
  console.error("期望第 3 条 deps 为 [0,1]，实际:", delegates[2].deps);
  process.exit(1);
}

console.log("3. stripDelegateFromReply：");
const cleaned = stripDelegateFromReply(fakeMainReply);
console.log(cleaned);
if (/DELEGATE:/.test(cleaned)) {
  console.error("strip 后仍含 DELEGATE 行");
  process.exit(1);
}

const modelOverride = process.env.OLLAMA_MODEL || undefined;
if (modelOverride) console.log("使用模型:", modelOverride);
console.log("4. runSubAgents（DAG：层0 并行 researcher+coder，层1 researcher 依赖 0,1）…");
let subResult;
try {
  subResult = await runSubAgents(delegates, modelOverride);
} catch (e) {
  console.error("runSubAgents 失败:", e.message);
  process.exit(1);
}

const parts = subResult.split(SUB_RESULT_SEP);
if (parts.length !== 3) {
  console.error("期望子结果 3 段，实际:", parts.length);
  process.exit(1);
}
console.log("5. 子任务结果（3 段）：");
parts.forEach((p, i) => {
  const preview = p.length > 200 ? p.slice(0, 200) + "..." : p;
  console.log("--- [" + i + "] ---\n" + preview + "\n");
});
console.log("--- DELEGATE DAG 验证通过（扩展格式解析 + strip + 分层执行正常）。---");
