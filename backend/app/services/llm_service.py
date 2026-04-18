import os
import base64
import aiohttp
from pathlib import Path
from PIL import Image
import io

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "gemma3:27b")


def _encode_image(image_path: str) -> str:
    """Encode image to base64 for Ollama API"""
    with Image.open(image_path) as img:
        if img.width > 2048 or img.height > 2048:
            img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')


async def generate(prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
    """Generate text using Ollama LLM"""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": max_tokens,
                    "temperature": temperature,
                    "num_ctx": 8192
                }
            }
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result["response"]
            else:
                error_text = await response.text()
                raise Exception(f"Ollama API error: {error_text}")


async def generate_with_image(prompt: str, image_path: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
    """Generate text from prompt + image using Ollama multimodal model"""
    image_base64 = _encode_image(image_path)

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "images": [image_base64],
                "stream": False,
                "options": {
                    "num_predict": max_tokens,
                    "temperature": temperature,
                    "num_ctx": 8192
                }
            }
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result["response"]
            else:
                error_text = await response.text()
                raise Exception(f"Ollama API error: {error_text}")
