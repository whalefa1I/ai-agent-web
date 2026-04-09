#!/usr/bin/env bash
# Linux / macOS: Vite + tee to logs/（UTF-8）
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL="${LC_ALL:-C.UTF-8}"
export LANG="${LANG:-C.UTF-8}"
mkdir -p logs
LOG="logs/web-dev-$(date +%Y%m%d-%H%M%S).log"
echo "========================================"
echo "  ai-agent-web（Vite）"
echo "  日志: $LOG"
echo "========================================"
npm run dev 2>&1 | tee "$LOG"
