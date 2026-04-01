#!/usr/bin/env bash
# start-dev.sh — Find free ports and launch docker-compose dev stack
set -euo pipefail

PORT_RANGE_START=13000
PORT_RANGE_END=15000

is_port_free() {
    local port=$1
    if command -v ss &>/dev/null; then
        ! ss -tlnH "sport = :$port" 2>/dev/null | grep -q .
    elif command -v netstat &>/dev/null; then
        ! netstat -an 2>/dev/null | grep -qE "[:.]${port}\s.*LISTEN"
    else
        # fallback: try to bind
        (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null && return 1 || return 0
    fi
}

find_free_port() {
    local start=$1
    for ((p=start; p<=PORT_RANGE_END; p++)); do
        if is_port_free "$p"; then
            echo "$p"
            return
        fi
    done
    echo ""
}

echo "Scanning for free ports in ${PORT_RANGE_START}-${PORT_RANGE_END}..."

APP_PORT=$(find_free_port $PORT_RANGE_START)
if [ -z "$APP_PORT" ]; then
    echo "ERROR: No free port found for app in range ${PORT_RANGE_START}-${PORT_RANGE_END}"
    exit 1
fi

BOARD_PORT=$(find_free_port $((APP_PORT + 1)))
if [ -z "$BOARD_PORT" ]; then
    BOARD_PORT=$((APP_PORT + 10))
fi

export APP_PORT BOARD_PORT

echo "  App:   http://localhost:${APP_PORT}"
echo "  Board: http://localhost:${BOARD_PORT}"
echo ""

# Pass to docker-compose via environment
exec docker compose -f docker-compose.dev.yml up "$@"
