from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from ..services import tts_service

router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=2)


@router.get("/list/{project_id}")
async def list_audio_files(project_id: str):
    """List all generated audio files for a project"""
    audio_dir = Path.cwd() / "data" / "projects" / project_id / "audio"
    if not audio_dir.exists():
        return {"audio_files": []}

    audio_files = []
    for f in audio_dir.glob("slide_*.mp3"):
        audio_files.append({
            "slide_number": int(f.stem.split('_')[1]),
            "filename": f.name,
            "file_size": f.stat().st_size,
            "url": f"/static/projects/{project_id}/audio/{f.name}"
        })

    audio_files.sort(key=lambda x: x["slide_number"])
    return {"audio_files": audio_files}


@router.post("/synthesize/{project_id}/{slide_number}")
async def synthesize_audio(project_id: str, slide_number: int, request: dict):
    """Synthesize audio for a specific project and slide"""
    text = request.get("text", "")
    voice = request.get("voice", "us_standard")
    speed = request.get("speed", 1.0)
    force_regenerate = request.get("force_regenerate", False)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    audio_dir = Path.cwd() / "data" / "projects" / project_id / "audio"
    audio_filename = f"slide_{slide_number:03d}.mp3"
    audio_path = audio_dir / audio_filename

    if audio_path.exists() and not force_regenerate:
        return {
            "audio_url": f"/static/projects/{project_id}/audio/{audio_filename}",
            "duration": int(len(text.split()) / 2.5),
            "file_size": audio_path.stat().st_size,
            "generation_timestamp": datetime.now().isoformat()
        }

    loop = asyncio.get_event_loop()
    success = await loop.run_in_executor(
        _executor, tts_service.generate_audio, text, audio_path, voice, speed
    )

    if not success:
        raise HTTPException(status_code=500, detail="All TTS methods failed")

    return {
        "audio_url": f"/static/projects/{project_id}/audio/{audio_filename}",
        "duration": int(len(text.split()) / 2.5),
        "file_size": audio_path.stat().st_size if audio_path.exists() else 0,
        "generation_timestamp": datetime.now().isoformat()
    }


@router.get("/audio-file/{project_id}/{filename}")
async def get_audio_file(project_id: str, filename: str):
    """Serve audio file directly"""
    audio_path = Path.cwd() / "data" / "projects" / project_id / "audio" / filename
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path=str(audio_path), media_type="audio/mpeg", filename=filename)


@router.delete("/delete/{project_id}/{slide_number}")
async def delete_audio(project_id: str, slide_number: int):
    """Delete audio file for a specific slide"""
    audio_file = Path.cwd() / "data" / "projects" / project_id / "audio" / f"slide_{slide_number:03d}.mp3"
    if not audio_file.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    audio_file.unlink()
    return {"message": "Audio file deleted successfully"}


@router.get("/voice-options")
async def get_voice_options():
    """Get available voice options for frontend"""
    return {
        "voice_options": tts_service.get_all_voice_options(),
        "speed_range": {
            "min": 0.5, "max": 2.0, "step": 0.25, "default": 1.0,
            "marks": {"0.5": "0.5x", "0.75": "0.75x", "1.0": "1x",
                      "1.25": "1.25x", "1.5": "1.5x", "1.75": "1.75x", "2.0": "2x"}
        },
        "recommendations": {
            "academic": ["us_standard", "uk_formal"],
            "business": ["us_deep", "ca_neutral"],
            "educational": ["au_friendly", "us_energetic"],
            "international": ["uk_formal", "ca_neutral"]
        }
    }


