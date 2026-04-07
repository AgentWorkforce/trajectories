#!/usr/bin/env bash
set -euo pipefail

# --- Defaults ---
USE_MOCK=0
PORT=3847
TRAJECTORIES_DATA_DIR=""

# --- Usage ---
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Launch the Trail Viewer app (server + Swift UI).

Options:
  --mock          Use mock trajectory data
  --path <dir>    Set trajectories data directory
  --port <num>    Set server port (default: 3847)
  --help          Show this help message
EOF
  exit 0
}

# --- Parse flags ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mock)
      USE_MOCK=1
      shift
      ;;
    --path)
      TRAJECTORIES_DATA_DIR="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# --- Determine project root ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# --- Prerequisite checks ---
if ! command -v node &> /dev/null; then
  echo "Error: node is not installed. Please install Node.js first."
  exit 1
fi
echo "Node.js $(node --version)"

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed. Please install npm first."
  exit 1
fi

# --- Server PID tracking ---
SERVER_PID=""

# --- Cleanup trap ---
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  echo "Shutdown complete"
}
trap cleanup SIGINT SIGTERM EXIT

# --- Step 1: Build trajectories SDK ---
echo "Building trajectories SDK..."
cd "$PROJECT_ROOT"
if npm run build --if-present 2>/dev/null; then
  echo "SDK build complete."
else
  echo "Warning: SDK build skipped or failed, continuing..."
fi
cd "$SCRIPT_DIR"

# --- Step 2: Install server dependencies ---
cd "$SCRIPT_DIR/server"
if [[ ! -d node_modules ]] || [[ package.json -nt node_modules ]]; then
  echo "Installing server dependencies..."
  npm install
fi
cd "$SCRIPT_DIR"

# --- Step 3: Start server in background ---
echo "Starting server on port $PORT..."
export PORT
if [[ -n "$TRAJECTORIES_DATA_DIR" ]]; then
  export TRAJECTORIES_DATA_DIR
fi
if [[ "$USE_MOCK" -eq 1 ]]; then
  export USE_MOCK
fi

cd "$SCRIPT_DIR/server"
npx tsx src/server.ts &
SERVER_PID=$!
cd "$SCRIPT_DIR"

# --- Step 4: Health check loop ---
echo "Waiting for server..."
for i in $(seq 1 10); do
  if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 10 ]]; then
    echo "Server failed to start after 10 seconds"
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "Server ready at http://localhost:$PORT"

# --- Step 5: Open the app (macOS) ---
if [[ -d "$SCRIPT_DIR/.build" ]] && find "$SCRIPT_DIR/.build" -type f -perm +111 -name "trail-viewer" -print -quit 2>/dev/null | grep -q .; then
  echo "Launching Trail Viewer app..."
  BINARY=$(find "$SCRIPT_DIR/.build" -type f -perm +111 -name "trail-viewer" -print -quit 2>/dev/null)
  "$BINARY"
elif command -v swift &> /dev/null; then
  echo "Building and launching Trail Viewer with Swift..."
  cd "$SCRIPT_DIR"
  swift run
else
  echo "Swift app not built. Server running at http://localhost:$PORT"
fi

# --- Wait for server process ---
wait "$SERVER_PID"
