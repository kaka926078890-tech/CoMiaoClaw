#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT/frontend"
GATEWAY_DIR="$ROOT/gateway"
DEV_DIR="$ROOT/.dev"
LOG_DIR="$ROOT/logs"
FRONTEND_PID_FILE="$DEV_DIR/frontend.pid"
GATEWAY_PID_FILE="$DEV_DIR/gateway.pid"
FRONTEND_PORT="${V2_FRONTEND_PORT:-5173}"
GATEWAY_PORT="${V2_GATEWAY_PORT:-3000}"

mkdir -p "$DEV_DIR" "$LOG_DIR"

usage() {
  echo "用法: $0 {start|stop|restart} {all|frontend|gateway}"
  echo "  例: $0 restart all"
  echo "      $0 start frontend"
  echo "      $0 stop gateway"
  exit 1
}

stop_frontend() {
  if [ -f "$FRONTEND_PID_FILE" ]; then
    local pid
    pid=$(cat "$FRONTEND_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "已停止 frontend (PID $pid)"
    fi
    rm -f "$FRONTEND_PID_FILE"
  fi
  local pids
  pids=$(lsof -ti ":$FRONTEND_PORT" 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    echo "已结束占用端口 $FRONTEND_PORT 的进程"
  fi
}

stop_gateway() {
  if [ -f "$GATEWAY_PID_FILE" ]; then
    local pid
    pid=$(cat "$GATEWAY_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "已停止 gateway (PID $pid)"
    fi
    rm -f "$GATEWAY_PID_FILE"
  fi
  local pids
  pids=$(lsof -ti ":$GATEWAY_PORT" 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    echo "已结束占用端口 $GATEWAY_PORT 的进程"
  fi
}

start_frontend() {
  if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    echo "frontend 目录无 package.json，跳过"
    return 0
  fi
  stop_frontend
  echo "启动 frontend (port $FRONTEND_PORT)..."
  cd "$FRONTEND_DIR"
  VITE_PORT="$FRONTEND_PORT" npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
  echo "  frontend PID $(cat "$FRONTEND_PID_FILE") -> http://localhost:$FRONTEND_PORT"
}

start_gateway() {
  if [ ! -f "$GATEWAY_DIR/package.json" ]; then
    echo "gateway 暂无 package.json，跳过（骨架未实现时可忽略）"
    return 0
  fi
  if ! grep -q '"dev"' "$GATEWAY_DIR/package.json" 2>/dev/null; then
    echo "gateway 无 dev 脚本，跳过"
    return 0
  fi
  stop_gateway
  echo "启动 gateway (port $GATEWAY_PORT)..."
  cd "$GATEWAY_DIR"
  PORT="$GATEWAY_PORT" npm run dev > "$LOG_DIR/gateway.log" 2>&1 &
  echo $! > "$GATEWAY_PID_FILE"
  echo "  gateway PID $(cat "$GATEWAY_PID_FILE") -> http://localhost:$GATEWAY_PORT"
}

run_start() {
  case "$1" in
    all)
      start_gateway
      start_frontend
      echo "日志: $LOG_DIR/gateway.log, $LOG_DIR/frontend.log"
      ;;
    frontend) start_frontend ;;
    gateway)  start_gateway ;;
    *) usage ;;
  esac
}

run_stop() {
  case "$1" in
    all)
      stop_gateway
      stop_frontend
      echo "V2 服务已全部停止"
      ;;
    frontend) stop_frontend ;;
    gateway)  stop_gateway ;;
    *) usage ;;
  esac
}

run_restart() {
  run_stop "$1"
  run_start "$1"
}

CMD="${1:-}"
TARGET="${2:-all}"
[ -z "$CMD" ] && usage
case "$CMD" in
  start)   run_start "$TARGET" ;;
  stop)    run_stop "$TARGET" ;;
  restart) run_restart "$TARGET" ;;
  *) usage ;;
esac
