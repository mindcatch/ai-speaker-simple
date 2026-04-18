from fastapi import APIRouter, HTTPException
from typing import List
import json
from pathlib import Path

from ..models.schemas import VLMAnalysisResult
from ..services.vlm_service import vlm_service

router = APIRouter()

@router.post("/analyze")
async def analyze_presentation(request_data: dict):
    """
    Analyze uploaded presentation using VLM
    """
    try:
        project_id = request_data.get("project_id")
        if not project_id:
            raise HTTPException(
                status_code=400,
                detail="project_id is required"
            )
        
        # Get project metadata
        from ..services.file_service import file_service
        
        metadata = file_service.get_project_metadata(project_id)
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail="Project not found"
            )
        
        # Analyze slides with VLM
        slide_images = metadata["slide_images"]
        extracted_texts = metadata["extracted_texts"]
        
        analysis_result = await vlm_service.analyze_slides(slide_images, extracted_texts)
        
        # Save analysis result to project
        project_dir = Path("backend/data/projects") / project_id
        analysis_path = project_dir / "vlm_analysis.json"
        
        with open(analysis_path, 'w', encoding='utf-8') as f:
            json.dump(analysis_result.dict(), f, indent=2, ensure_ascii=False, default=str)
        
        return analysis_result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@router.get("/analysis/{project_id}", response_model=VLMAnalysisResult)
async def get_analysis(project_id: str):
    """
    Get VLM analysis results for a project
    """
    try:
        project_dir = Path("backend/data/projects") / project_id
        analysis_path = project_dir / "vlm_analysis.json"
        
        if not analysis_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Analysis not found. Please run analysis first."
            )
        
        with open(analysis_path, 'r', encoding='utf-8') as f:
            analysis_data = json.load(f)
        
        return VLMAnalysisResult(**analysis_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get analysis: {str(e)}"
        )

@router.post("/reanalyze/{project_id}")
async def reanalyze_presentation(project_id: str):
    """
    Re-run VLM analysis for a project
    """
    try:
        # Get project metadata
        from ..services.file_service import file_service
        
        metadata = file_service.get_project_metadata(project_id)
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail="Project not found"
            )
        
        # Re-analyze slides
        slide_images = metadata["slide_images"]
        extracted_texts = metadata["extracted_texts"]
        
        analysis_result = await vlm_service.analyze_slides(slide_images, extracted_texts)
        
        # Save updated analysis
        project_dir = Path("backend/data/projects") / project_id
        analysis_path = project_dir / "vlm_analysis.json"
        
        with open(analysis_path, 'w', encoding='utf-8') as f:
            json.dump(analysis_result.dict(), f, indent=2, ensure_ascii=False, default=str)
        
        return analysis_result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Re-analysis failed: {str(e)}"
        )
