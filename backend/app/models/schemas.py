from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class SlideType(str, Enum):
    INTRODUCTION = "introduction"
    METHODOLOGY = "methodology"
    RESULTS = "results"
    CONCLUSION = "conclusion"
    TITLE = "title"
    CONTENT = "content"
    CHART = "chart"
    IMAGE = "image"
    OTHER = "other"

class ComplexityLevel(str, Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"

class PresentationStyle(str, Enum):
    ACADEMIC = "academic"
    CONVERSATIONAL = "conversational"
    FORMAL = "formal"
    ENTHUSIASTIC = "enthusiastic"

class AudienceLevel(str, Enum):
    EXPERT = "expert"
    GENERAL = "general"
    BEGINNER = "beginner"

# VLM Analysis Models
class SlideAnalysis(BaseModel):
    slide_number: int
    title: str
    main_content: str
    visual_elements: str
    key_points: List[str]
    slide_type: SlideType
    estimated_speaking_time: int  # in seconds
    complexity_level: ComplexityLevel

class PresentationContext(BaseModel):
    presentation_topic: str
    research_field: str
    target_audience: AudienceLevel
    presentation_structure: str
    key_messages: List[str]
    logical_flow: str
    estimated_total_time: int  # in minutes
    presentation_style: PresentationStyle
    potential_qa_topics: List[str]

class VLMAnalysisResult(BaseModel):
    slides: List[SlideAnalysis]
    context: PresentationContext
    total_slides: int
    analysis_timestamp: datetime

# Script Generation Models
class ScriptGenerationRequest(BaseModel):
    slide_data: SlideAnalysis
    user_context: Optional[str] = None
    presentation_context: PresentationContext
    options: Dict[str, Any] = Field(default_factory=dict)

class ScriptGenerationResponse(BaseModel):
    script: str
    estimated_duration: int  # in seconds
    word_count: int
    slide_number: int
    generation_timestamp: datetime

class ScriptModificationRequest(BaseModel):
    current_script: str
    user_request: str
    slide_context: SlideAnalysis
    presentation_context: PresentationContext

class ScriptChange(BaseModel):
    type: str  # addition, deletion, modification
    original: str
    modified: str
    reason: str

class ScriptModificationResponse(BaseModel):
    modified_script: str
    explanation: str
    changes: List[ScriptChange]

# Voice Generation Models
class VoiceSettings(BaseModel):
    provider: str = "macos"  # macos, elevenlabs
    voice: str = "Alex"
    speed: float = 1.0
    pitch: int = 0
    emotion: str = "neutral"
    language: str = "en"

class VoiceGenerationRequest(BaseModel):
    script: str
    voice_settings: VoiceSettings
    slide_number: int

class VoiceGenerationResponse(BaseModel):
    audio_url: str
    duration: int  # in seconds
    file_size: int  # in bytes
    generation_timestamp: datetime

# File Upload Models
class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    file_type: str
    file_size: int
    upload_timestamp: datetime
    processing_status: str

# Error Models
class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

