#!/bin/bash

echo "=========================================="
echo "  Academic Presentation AI Coach (Simple)"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "backend/main.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Cleanup function to kill background processes on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# --- Backend Setup ---
echo ""
echo "[Backend] Setting up..."

cd backend

if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed. Install it with: brew install uv"
    exit 1
fi

if [ ! -d ".venv" ]; then
    echo "[Backend] Creating virtual environment..."
    uv venv
fi

source .venv/bin/activate

echo "[Backend] Installing dependencies..."
uv pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Error: Failed to install backend dependencies"
    exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo "[Backend] Created .env from .env.example - please configure it."
fi

mkdir -p data/projects data/temp

echo "[Backend] Starting FastAPI server on port 8000..."
python main.py &
BACKEND_PID=$!

cd ..

# --- Frontend Setup ---
echo ""
echo "[Frontend] Setting up..."

cd frontend

if [ ! -d "node_modules" ]; then
    echo "[Frontend] Installing dependencies..."
    npm install
fi

# Find available port
PORT=3000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done

echo "[Frontend] Starting Next.js on port $PORT..."
npm run dev -- --port $PORT &
FRONTEND_PID=$!

cd ..

echo ""
echo "=========================================="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:$PORT"
echo "  API Docs: http://localhost:8000/docs"
echo "=========================================="
echo "  Press Ctrl+C to stop both servers"
echo "=========================================="

# Wait for either process to exit
wait
