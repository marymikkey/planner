#!/bin/bash
# Двойной клик: запускает локальный сервер и открывает Планер в браузере.
cd "$(dirname "$0")"
PORT=8000
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 tools/serve.py $PORT >/dev/null 2>&1 &
  sleep 1
fi
open "http://localhost:$PORT"
