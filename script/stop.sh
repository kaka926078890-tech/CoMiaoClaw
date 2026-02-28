#!/usr/bin/env bash
# 停止 Claw 全部工程：按 PID 文件结束进程，并清理占用 3000 / 5173 的进程

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/script/claw.pids"

stop_by_pid_file() {
  if [ ! -f "$PID_FILE" ]; then
    return 0
  fi
  while read -r pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "已结束进程: $pid"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
}

stop_by_port() {
  local port=$1
  # macOS: lsof -ti :PORT
  local pids
  pids=$(lsof -ti ":$port" 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    echo "已结束占用端口 $port 的进程"
  fi
}

stop_by_pid_file
stop_by_port 3000
stop_by_port 5173

echo "Claw 已全部停止。"
