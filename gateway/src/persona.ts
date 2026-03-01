import fs from "fs";
import { config } from "./config.js";

/**
 * 读人设：单文件时读该文件内容；不存在或读失败返回空串。
 */
export function loadPersona(): string {
  const p = config.personaPath;
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return "";

  try {
    return fs.readFileSync(p, "utf-8").trim();
  } catch {
    return "";
  }
}
