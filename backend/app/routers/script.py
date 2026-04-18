from fastapi import APIRouter, HTTPException
import json
from pathlib import Path
from datetime import datetime

from ..services.file_service import file_service
from ..services import llm_service

router = APIRouter()


def _clean_script(response_text: str, target_duration: int) -> dict:
    """Clean LLM response to extract only the spoken script"""
    lines = response_text.strip().split('\n')
    cleaned = []

    for line in lines:
        stripped = line.strip()
        # Skip JSON lines
        if stripped.startswith('{') and ('key_points' in stripped or 'keywords' in stripped):
            continue
        # Skip LLM preamble/meta lines
        if stripped.lower().startswith(('here\'s', 'here is', 'okay', 'sure', 'certainly', 'below is', 'note:')):
            continue
        # Skip lines that are just labels
        if stripped in ('SCRIPT:', 'Script:', '[Your complete presentation script goes here]'):
            continue
        # Skip stage directions like [pause], [gesture], etc.
        if stripped.startswith('[') and stripped.endswith(']') and len(stripped) < 80:
            continue
        cleaned.append(line)

    script = '\n'.join(cleaned).strip()
    # Remove wrapping quotes if LLM enclosed entire script in quotes
    if script.startswith('"') and script.endswith('"'):
        script = script[1:-1].strip()

    return {
        "script": script,
        "duration": target_duration,
    }


def _get_slide_image_path(project_id: str, slide_number: int) -> str | None:
    """Get slide image path if it exists"""
    path = Path.cwd() / "data" / "projects" / project_id / "slides" / f"slide_{slide_number:03d}.png"
    return str(path) if path.exists() else None


# --- Endpoints ---

@router.post("/generate-slide")
async def generate_slide_script(request_data: dict):
    """Generate script for a single slide by looking at the slide image directly"""
    try:
        project_id = request_data.get("project_id")
        slide_number = request_data.get("slide_number", 1)
        target_duration = request_data.get("target_duration", 60)
        audience_level = request_data.get("audience_level", "general")
        presentation_style = request_data.get("presentation_style", "academic")
        user_context = request_data.get("user_context", "")

        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        metadata = file_service.get_project_metadata(project_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Project not found")

        extracted_texts = metadata.get("extracted_texts", [])
        slide_content = extracted_texts[slide_number - 1] if slide_number <= len(extracted_texts) else ""
        user_context_section = f"\n\nADDITIONAL INSTRUCTIONS FROM PRESENTER:\n{user_context}" if user_context.strip() else ""

        slide_content_section = f"\n\nEXTRACTED TEXT FROM SLIDE:\n{slide_content}" if slide_content.strip() else ""

        prompt = f"""Look at this presentation slide image and write exactly what the presenter should say out loud.

RULES:
- Output ONLY the spoken script — nothing else
- No preamble ("Here's...", "Okay..."), no commentary, no JSON, no brackets
- Describe what is visually shown (charts, images, tweets, diagrams) naturally in speech
- Duration: approximately {target_duration} seconds when spoken
- Style: {presentation_style}
- Audience: {audience_level}
- This is slide {slide_number}{slide_content_section}{user_context_section}

SCRIPT:"""

        slide_image = _get_slide_image_path(project_id, slide_number)

        if slide_image:
            response_text = await llm_service.generate_with_image(prompt, slide_image, max_tokens=1000)
        else:
            response_text = await llm_service.generate(prompt, max_tokens=1000)

        result = _clean_script(response_text, target_duration)
        return {"status": "success", "slide_number": slide_number, "project_id": project_id, **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Script generation failed. Check if Ollama is running.")


@router.post("/generate-all")
async def generate_all_scripts(request_data: dict):
    """Generate scripts for all slides in a project"""
    try:
        project_id = request_data.get("project_id")
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        metadata = file_service.get_project_metadata(project_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Project not found")

        total_slides = metadata.get("total_slides", 0)
        extracted_texts = metadata.get("extracted_texts", [])
        scripts = []

        for slide_num in range(1, total_slides + 1):
            try:
                slide_content = extracted_texts[slide_num - 1] if slide_num <= len(extracted_texts) else ""
                slide_content_section = f"\n\nEXTRACTED TEXT:\n{slide_content}" if slide_content.strip() else ""

                prompt = f"""Look at this presentation slide image and write exactly what the presenter should say out loud.
Output ONLY the spoken script. No commentary, no JSON, no brackets.
Duration: 60-90 seconds. Academic but conversational tone.
This is slide {slide_num}.{slide_content_section}

SCRIPT:"""

                slide_image = _get_slide_image_path(project_id, slide_num)
                if slide_image:
                    script_text = await llm_service.generate_with_image(prompt, slide_image, max_tokens=800)
                else:
                    script_text = await llm_service.generate(prompt, max_tokens=800)

                result = _clean_script(script_text, 60)
                word_count = len(result["script"].split())

                scripts.append({
                    "slide_number": slide_num,
                    "script": result["script"],
                    "word_count": word_count,
                    "estimated_duration": int(word_count / 2.5)
                })
            except Exception as e:
                scripts.append({
                    "slide_number": slide_num,
                    "script": f"Script generation failed for slide {slide_num}. Please try again.",
                    "word_count": 0, "estimated_duration": 60, "error": str(e)
                })

        return {"status": "success", "project_id": project_id, "total_slides": total_slides, "scripts": scripts}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Bulk script generation failed. Check if Ollama is running.")


@router.post("/save/{project_id}/{slide_number}")
async def save_script(project_id: str, slide_number: int, script_data: dict):
    """Save script for a specific slide"""
    try:
        scripts_dir = Path.cwd() / "data" / "projects" / project_id / "scripts"
        scripts_dir.mkdir(exist_ok=True)

        script_file = scripts_dir / f"slide_{slide_number:03d}.txt"
        with open(script_file, 'w', encoding='utf-8') as f:
            f.write(script_data.get("script", ""))

        metadata = {
            "slide_number": slide_number,
            "script": script_data.get("script", ""),
            "word_count": script_data.get("word_count", 0),
            "estimated_duration": script_data.get("estimated_duration", 0),
            "saved_at": datetime.now().isoformat(),
            "version": script_data.get("version", 1)
        }
        metadata_file = scripts_dir / f"slide_{slide_number:03d}_metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        return {"message": "Script saved successfully", "slide_number": slide_number}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save script.")


@router.get("/load/{project_id}/{slide_number}")
async def load_script(project_id: str, slide_number: int):
    """Load saved script for a specific slide"""
    try:
        scripts_dir = Path.cwd() / "data" / "projects" / project_id / "scripts"
        script_file = scripts_dir / f"slide_{slide_number:03d}.txt"

        if not script_file.exists():
            raise HTTPException(status_code=404, detail="Script not found")

        script = script_file.read_text(encoding='utf-8')
        metadata = {}
        metadata_file = scripts_dir / f"slide_{slide_number:03d}_metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

        return {"script": script, "metadata": metadata, "slide_number": slide_number}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load script.")


@router.get("/list/{project_id}")
async def list_scripts(project_id: str):
    """List all scripts for a project"""
    try:
        scripts_dir = Path.cwd() / "data" / "projects" / project_id / "scripts"
        if not scripts_dir.exists():
            return {"scripts": []}

        scripts = []
        for script_file in scripts_dir.glob("slide_*.txt"):
            slide_number = int(script_file.stem.split('_')[1])
            metadata = {}
            metadata_file = scripts_dir / f"slide_{slide_number:03d}_metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            scripts.append({"slide_number": slide_number, "has_script": True, "metadata": metadata})

        scripts.sort(key=lambda x: x["slide_number"])
        return {"scripts": scripts}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to list scripts.")


@router.post("/edit-script")
async def edit_script(request_data: dict):
    """Smart editing of existing script based on user instructions"""
    try:
        project_id = request_data.get("project_id")
        slide_number = request_data.get("slide_number", 1)
        current_script = request_data.get("current_script", "")
        editing_instructions = request_data.get("editing_instructions", [])
        target_duration = request_data.get("target_duration", 60)
        presentation_style = request_data.get("presentation_style", "academic")

        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        if not current_script.strip():
            raise HTTPException(status_code=400, detail="current_script is required")

        instructions_text = (
            "\n\nSPECIFIC EDITING INSTRUCTIONS:\n" + "\n".join(f"- {inst}" for inst in editing_instructions)
            if editing_instructions
            else "\n\nGENERAL IMPROVEMENT: Improve the script for better flow, clarity, and engagement."
        )

        prompt = f"""Rewrite the following presentation script based on the instructions below. Output ONLY the revised spoken script — no commentary, no explanations, no preamble, no brackets.

CURRENT SCRIPT:
{current_script}{instructions_text}

CONSTRAINTS:
- Style: {presentation_style}
- Duration: approximately {target_duration} seconds when spoken
- Output only what the presenter says at the podium

REVISED SCRIPT:"""

        # Include slide image for context if available
        slide_image = _get_slide_image_path(project_id, slide_number)
        if slide_image:
            raw = await llm_service.generate_with_image(prompt, slide_image, max_tokens=1000)
        else:
            raw = await llm_service.generate(prompt, max_tokens=1000)

        result = _clean_script(raw, target_duration)
        improved_script = result["script"]
        word_count = len(improved_script.split())

        return {
            "status": "success", "slide_number": slide_number, "project_id": project_id,
            "improved_script": improved_script, "word_count": word_count,
            "estimated_duration": int(word_count / 2.5),
            "editing_instructions_processed": len(editing_instructions)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Script editing failed. Check if Ollama is running.")
