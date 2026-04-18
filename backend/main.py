from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import json
from typing import Dict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Academic Presentation AI Coach",
    description="AI-powered presentation coaching platform for academic researchers",
    version="1.0.0"
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        print(f"🔌 WebSocket connected: {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            print(f"🔌 WebSocket disconnected: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(json.dumps(message))
            except Exception as e:
                print(f"❌ Failed to send WebSocket message to {session_id}: {e}")
                self.disconnect(session_id)

manager = ConnectionManager()

# Mount static files with absolute path
from pathlib import Path
data_dir = Path.cwd() / "data"
data_dir.mkdir(exist_ok=True)
(data_dir / "projects").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(data_dir)), name="static")

@app.get("/")
async def root():
    return {
        "message": "Academic Presentation AI Coach API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time progress updates"""
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Keep connection alive and listen for client messages
            data = await websocket.receive_text()
            # Echo back for testing (optional)
            await manager.send_message(session_id, {
                "type": "echo",
                "message": f"Received: {data}"
            })
    except WebSocketDisconnect:
        manager.disconnect(session_id)

# Make manager available for import
def get_websocket_manager():
    return manager

# Import routers
from app.routers import upload, script, voice

# Include routers
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(script.router, prefix="/api/script", tags=["script"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting server on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, timeout_keep_alive=300)
