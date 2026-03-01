import fs from "fs";
import path from "path";
import { config } from "./config.js";

/**
 * 子角色名 → system 文本。按 gateway/data/subpersona/<role>.md 读取。
 * 未配置的角色返回空或默认说明。
 */
export function getSubPersona(role: string): string {
  if (!role || !/^[\w-]+$/.test(role)) return "";
  const filePath = path.join(config.subpersonaDir, `${role}.md`);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return "";
  }
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}
