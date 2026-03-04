#!/usr/bin/env bash
# 重启 Claw 全部工程：先 stop 再 start

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "停止现有进程..."
"$ROOT/script/stop.sh"

echo ""
echo "重新启动..."
"$ROOT/script/start.sh"
