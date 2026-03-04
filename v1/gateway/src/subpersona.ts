import fs from "fs";
import path from "path";
import { config } from "./config.js";

export function getSubPersona(role: string): string {
  if (!role || !/^[\w-]+$/.test(role)) return "";
  const filePath = path.join(config.subpersonaDir, `${role}.md`);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

export function getSubAgentSystem(role: string): string {
  if (!role || !/^[\w-]+$/.test(role)) return "";
  const filePath = path.join(config.agentsDir, `${role}.md`);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}
