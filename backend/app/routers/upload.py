from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List
import os
import tempfile
import uuid
from datetime import datetime

from ..models.schemas import FileUploadResponse
from ..services.file_service import file_service

router = APIRouter()

@router.post("/file/{session_id}", response_model=FileUploadResponse)
async def upload_file(session_id: str, files: UploadFile = File(...)):
    """
    Upload and process presentation file (PPTX, PDF, or image)
    """
    # Handle single file (use first file if multiple files are sent)
    file = files
    print(f"📁 Upload request received: {file.filename}")
    
    # Import WebSocket manager
    try:
        from main import get_websocket_manager
        manager = get_websocket_manager()
        
        # Set WebSocket session for file service
        file_service.set_websocket_session(manager, session_id)
    except Exception as e:
        print(f"⚠️ WebSocket manager not available: {e}")
    
    try:
        # Validate file type
        allowed_extensions = {'.pptx', '.pdf', '.png', '.jpg', '.jpeg'}
        file_extension = os.path.splitext(file.filename)[1].lower()
        print(f"🔍 File extension: {file_extension}")
        
        if file_extension not in allowed_extensions:
            print(f"❌ Unsupported file type: {file_extension}")
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (max 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        file_content = await file.read()
        file_size = len(file_content)
        print(f"📊 File size: {file_size / (1024*1024):.2f} MB")
        
        if file_size > max_size:
            print(f"❌ File too large: {file_size} bytes")
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 100MB."
            )
        
        # Save to temporary file
        print("💾 Creating temporary file...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        print(f"✅ Temporary file created: {temp_file_path}")
        
        try:
            # Process the file
            print("🔄 Processing file...")
            project_id, slide_images, extracted_texts = await file_service.process_uploaded_file(
                temp_file_path, file.filename
            )
            print(f"✅ File processed successfully. Project ID: {project_id}")
            print(f"📊 Generated {len(slide_images)} slides")
            
            return FileUploadResponse(
                file_id=project_id,
                filename=file.filename,
                file_type=file_extension,
                file_size=file_size,
                upload_timestamp=datetime.now(),
                processing_status="completed"
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                print(f"🗑️ Temporary file cleaned up: {temp_file_path}")
                
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="File processing failed. Please try a different file."
        )

@router.get("/project/{project_id}")
async def get_project_info(project_id: str):
    """
    Get project information and status
    """
    try:
        metadata = file_service.get_project_metadata(project_id)
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail="Project not found"
            )
        
        # Check if analysis exists
        from pathlib import Path
        base_dir = Path.cwd()
        project_dir = base_dir / "data" / "projects" / project_id
        analysis_path = project_dir / "vlm_analysis.json"
        
        analysis_complete = analysis_path.exists()
        
        return {
            "project_id": project_id,
            "metadata": metadata,
            "analysis_complete": analysis_complete,
            "status": "ready" if analysis_complete else "pending_analysis"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to load project."
        )

@router.get("/projects")
async def list_projects():
    """
    List all projects
    """
    try:
        from pathlib import Path
        base_dir = Path.cwd()
        projects_dir = base_dir / "data" / "projects"
        
        projects = []
        for project_dir in projects_dir.iterdir():
            if project_dir.is_dir():
                metadata = file_service.get_project_metadata(project_dir.name)
                if metadata:
                    # Check analysis status
                    analysis_path = project_dir / "vlm_analysis.json"
                    analysis_complete = analysis_path.exists()
                    
                    projects.append({
                        "project_id": project_dir.name,
                        "filename": metadata.get("original_filename", "Unknown"),
                        "created_at": metadata.get("created_at"),
                        "total_slides": metadata.get("total_slides", 0),
                        "analysis_complete": analysis_complete
                    })
        
        # Sort by creation date (newest first)
        projects.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {"projects": projects}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to list projects."
        )

@router.delete("/project/{project_id}")
async def delete_project(project_id: str):
    """
    Delete a project and all its files
    """
    try:
        from pathlib import Path
        import shutil
        
        base_dir = Path.cwd()
        project_dir = base_dir / "data" / "projects" / project_id
        
        if not project_dir.exists():
            raise HTTPException(
                status_code=404,
                detail="Project not found"
            )
        
        # Remove project directory
        shutil.rmtree(project_dir)
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete project."
        )
