#!/usr/bin/env bash
# 启动 Claw 全部工程：网关(3000) + 前端(5173)
# 使用前请确保已安装依赖：cd gateway && npm install；cd frontend && npm install

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/script/claw.pids"
LOG_DIR="$ROOT/script/logs"

mkdir -p "$LOG_DIR"

# 若已有 PID 记录，先尝试停止
if [ -f "$PID_FILE" ]; then
  echo "发现已有 PID 文件，先执行停止..."
  "$ROOT/script/stop.sh" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

echo "启动网关 (port 3000)..."
cd "$ROOT/gateway"
npm run dev > "$LOG_DIR/gateway.log" 2>&1 &
GATEWAY_PID=$!
echo $GATEWAY_PID >> "$PID_FILE"

echo "启动前端 (port 5173)..."
cd "$ROOT/frontend"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID >> "$PID_FILE"

echo "已启动。PID 已写入 $PID_FILE"
echo "  网关: $GATEWAY_PID (http://localhost:3000)"
echo "  前端: $FRONTEND_PID (http://localhost:5173)"
echo "日志: $LOG_DIR/gateway.log, $LOG_DIR/frontend.log"
echo "停止: $ROOT/script/stop.sh"
