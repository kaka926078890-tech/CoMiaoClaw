import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, Loader2, Plus, Save, X } from "lucide-react";
import type { WorkspaceFiles } from "@/api/gateway";
import {
  listWorkspaceFiles,
  getWorkspaceFileContent,
  putWorkspaceFile,
  createWorkspaceFile,
} from "@/api/gateway";

const NEW_SKILL_TEMPLATE = `---
name: 技能名
description: 一句话描述该技能的用途，将出现在「可用技能」列表中
version: 1.0.0
---

# 技能标题

简要说明何时使用本技能、解决什么问题。

## 使用步骤

1. 第一步（例如：从用户消息或上下文中确定 XXX）。
2. 在你的回复中写：\`协议关键字: 参数\`（按本技能约定格式）。
3. 系统执行后会注入结果，你再基于结果回答用户。

## 示例

用户问「XXX」时，你可以回复：

\`\`\`
协议关键字: 具体参数
\`\`\`

系统执行后你再基于内容回答。

## 注意

- 有 DELEGATE 时勿同轮写 SKILL。
- 其他约定（如一次可写多行、与某技能共用协议等）在此补充。
`;

type EditorMode = "view" | "edit" | "new-agent" | "new-skill";

export function WorkspacePanel() {
  const [files, setFiles] = useState<WorkspaceFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("view");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkspaceFiles();
      setFiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const openFile = useCallback(async (path: string) => {
    setError(null);
    setCurrentPath(path);
    setMode("view");
    setNewName("");
    setCreateError(null);
    try {
      const text = await getWorkspaceFileContent(path);
      setContent(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setContent("");
    }
  }, []);

  const startNewAgent = useCallback(() => {
    setCurrentPath(null);
    setContent("");
    setMode("new-agent");
    setNewName("");
    setCreateError(null);
  }, []);

  const startNewSkill = useCallback(() => {
    setCurrentPath(null);
    setContent(NEW_SKILL_TEMPLATE);
    setMode("new-skill");
    setNewName("");
    setCreateError(null);
  }, []);

  const save = useCallback(async () => {
    if (!currentPath) return;
    setSaving(true);
    setError(null);
    try {
      await putWorkspaceFile(currentPath, content);
      setMode("view");
      loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [currentPath, content, loadFiles]);

  const createFile = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError("请输入名称");
      return;
    }
    if (mode === "new-agent") {
      if (!/^[\w-]+$/.test(name)) {
        setCreateError("子 Agent 名仅允许字母、数字、下划线、连字符");
        return;
      }
      setSaving(true);
      setCreateError(null);
      try {
        await createWorkspaceFile(`agents/${name}.md`, content || `# ${name}\n\n`);
        setMode("view");
        setCurrentPath(`agents/${name}.md`);
        setContent(content || `# ${name}\n\n`);
        loadFiles();
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (mode === "new-skill") {
      if (!/^[\w-]+$/.test(name)) {
        setCreateError("技能名仅允许字母、数字、下划线、连字符");
        return;
      }
      setSaving(true);
      setCreateError(null);
      try {
        const body = (content || NEW_SKILL_TEMPLATE).replace(/^name:\s*[^\n]+/m, `name: ${name}`);
        await createWorkspaceFile(`skills/${name}/SKILL.md`, body);
        setMode("view");
        setCurrentPath(`skills/${name}/SKILL.md`);
        setContent(body);
        loadFiles();
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    }
  }, [mode, newName, content, loadFiles]);

  const closeEditor = useCallback(() => {
    setCurrentPath(null);
    setContent("");
    setMode("view");
    setNewName("");
    setCreateError(null);
  }, []);

  const canSave = currentPath && content !== undefined && mode === "edit";

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 shadow-[var(--shadow-header)]">
        <span className="font-semibold text-[var(--color-text)]">工作区</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={startNewAgent}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text)]"
            title="新建子 Agent"
          >
            <Plus className="size-3.5" />
            子 Agent
          </button>
          <button
            type="button"
            onClick={startNewSkill}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text)]"
            title="新建技能"
          >
            <Plus className="size-3.5" />
            技能
          </button>
        </div>
      </div>
      {error && (
        <div className="shrink-0 bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error-text)]" role="alert">
          {error}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="w-52 shrink-0 overflow-y-auto border-r border-[var(--color-border)] p-2">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="size-4 animate-spin" />
              加载中…
            </div>
          ) : files ? (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-subtle)]">
                <FileText className="size-3.5" />
                根文件
              </div>
              <ul className="mb-4 space-y-0.5">
                {files.rootFiles.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => openFile(f.path)}
                      className={`w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm truncate ${currentPath === f.path ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]" : "text-[var(--color-text)] hover:bg-[var(--color-bg)]"}`}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-subtle)]">
                <FolderOpen className="size-3.5" />
                子 Agent
              </div>
              <ul className="mb-4 space-y-0.5">
                {files.agents.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => openFile(f.path)}
                      className={`w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm truncate ${currentPath === f.path ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]" : "text-[var(--color-text)] hover:bg-[var(--color-bg)]"}`}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-subtle)]">
                <FolderOpen className="size-3.5" />
                技能
              </div>
              <ul className="space-y-0.5">
                {files.skills.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => openFile(f.path)}
                      className={`w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm truncate ${currentPath === f.path ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]" : "text-[var(--color-text)] hover:bg-[var(--color-bg)]"}`}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {(currentPath || mode === "new-agent" || mode === "new-skill") ? (
            <>
              <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--color-border)]">
                <span className="truncate text-sm font-medium text-[var(--color-text)]">
                  {mode === "new-agent" ? "新建子 Agent" : mode === "new-skill" ? "新建技能" : currentPath}
                </span>
                <div className="flex items-center gap-2">
                  {(mode === "new-agent" || mode === "new-skill") && (
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={mode === "new-agent" ? "agent 名称，如 researcher" : "技能目录名，如 my-skill"}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm w-40"
                    />
                  )}
                  {mode === "view" && currentPath && (
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      编辑
                    </button>
                  )}
                  {(mode === "edit" && canSave) && (
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2.5 py-1 text-sm text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      保存
                    </button>
                  )}
                  {(mode === "new-agent" || mode === "new-skill") && (
                    <button
                      type="button"
                      onClick={createFile}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2.5 py-1 text-sm text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      创建
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                    aria-label="关闭"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              {createError && (
                <div className="shrink-0 bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error-text)]">
                  {createError}
                </div>
              )}
              <textarea
                className="flex-1 min-h-0 w-full resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[var(--color-text)] focus:outline-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                readOnly={mode === "view"}
                placeholder={mode === "new-agent" ? "子 Agent 的 system 内容（Markdown）" : mode === "new-skill" ? "已填入配置模板，修改后点击「创建」；frontmatter 中的 name 会随上方技能目录名自动写入" : ""}
                spellCheck={false}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-subtle)]">
              从左侧选择文件查看或编辑，或新建子 Agent / 技能
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
