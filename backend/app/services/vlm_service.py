import os
import json
import base64
from typing import List, Dict, Any
from datetime import datetime
import asyncio
import aiohttp
from PIL import Image
import io

from ..models.schemas import (
    SlideAnalysis, PresentationContext, VLMAnalysisResult,
    SlideType, ComplexityLevel, AudienceLevel, PresentationStyle
)

class OllamaVLMService:
    def __init__(self):
        # Ollama 설정
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.llm_model = os.getenv("OLLAMA_LLM_MODEL", "gemma3:27b")
        self.vision_model = os.getenv("OLLAMA_VISION_MODEL", "qwen2.5vl:7b")
        
        print(f"🔧 Ollama VLM Service initialized")
        print(f"📍 Ollama URL: {self.ollama_url}")
        print(f"🧠 LLM Model: {self.llm_model}")
        print(f"👁️ Vision Model: {self.vision_model}")
        
    async def analyze_slides(self, slide_images: List[str], extracted_texts: List[str] = None) -> VLMAnalysisResult:
        """
        Analyze slides using VLM (Vision Language Model)
        """
        try:
            # Analyze each slide individually
            slide_analyses = []
            for i, image_path in enumerate(slide_images):
                slide_text = extracted_texts[i] if extracted_texts else ""
                analysis = await self._analyze_single_slide(image_path, slide_text, i + 1)
                slide_analyses.append(analysis)
            
            # Generate overall presentation context
            context = await self._analyze_presentation_context(slide_analyses)
            
            return VLMAnalysisResult(
                slides=slide_analyses,
                context=context,
                total_slides=len(slide_analyses),
                analysis_timestamp=datetime.now()
            )
            
        except Exception as e:
            raise Exception(f"VLM analysis failed: {str(e)}")
    
    async def _analyze_single_slide(self, image_path: str, extracted_text: str, slide_number: int) -> SlideAnalysis:
        """
        Analyze a single slide using Ollama Vision Model
        """
        try:
            # Encode image to base64
            image_base64 = self._encode_image_to_base64(image_path)
            
            # Prepare prompt for vision model
            prompt = f"""Analyze this academic presentation slide (slide #{slide_number}).

Extracted text from slide: {extracted_text}

Please provide a detailed analysis in the following JSON format:
{{
    "slide_number": {slide_number},
    "title": "slide title (empty string if none)",
    "main_content": "comprehensive summary of all content",
    "visual_elements": "detailed description of charts, graphs, images, diagrams",
    "key_points": ["list", "of", "key", "points"],
    "slide_type": "introduction|methodology|results|conclusion|title|content|chart|image|other",
    "estimated_speaking_time": 60,
    "complexity_level": "simple|moderate|complex"
}}

Guidelines:
- Be thorough in extracting all text content
- Describe visual elements in detail for script generation
- Estimate realistic speaking time (30-180 seconds)
- Classify slide type based on academic presentation structure
- Assess complexity based on technical content and visual density

Respond with valid JSON only."""
            
            # Generate response using Ollama Vision
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ollama_url}/api/generate",
                json={
                    "model": self.vision_model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "stream": False,
                    "options": {
                        "num_predict": 2000,
                        "temperature": 0.7,
                        "num_ctx": 8192
                    }
                }
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        response_text = result["response"]
                    else:
                        error_text = await response.text()
                        print(f"❌ Ollama vision analysis failed: {error_text}")
                        return self._create_fallback_analysis(slide_number, extracted_text)
            
            # Parse JSON response
            try:
                analysis_data = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    analysis_data = json.loads(json_match.group())
                else:
                    print(f"⚠️ Failed to parse JSON from Ollama response, using fallback")
                    return self._create_fallback_analysis(slide_number, extracted_text)
            
            return SlideAnalysis(
                slide_number=analysis_data["slide_number"],
                title=analysis_data["title"],
                main_content=analysis_data["main_content"],
                visual_elements=analysis_data["visual_elements"],
                key_points=analysis_data["key_points"],
                slide_type=SlideType(analysis_data["slide_type"]),
                estimated_speaking_time=analysis_data["estimated_speaking_time"],
                complexity_level=ComplexityLevel(analysis_data["complexity_level"])
            )
            
        except Exception as e:
            print(f"❌ Ollama slide analysis failed: {e}")
            return self._create_fallback_analysis(slide_number, extracted_text)
    
    async def _analyze_presentation_context(self, slide_analyses: List[SlideAnalysis]) -> PresentationContext:
        """
        Analyze overall presentation context from all slides using Ollama LLM
        """
        try:
            # Compile all slide information
            slides_summary = "\n\n".join([
                f"Slide {slide.slide_number}: {slide.title}\n"
                f"Type: {slide.slide_type}\n"
                f"Content: {slide.main_content[:200]}..."
                for slide in slide_analyses
            ])
            
            prompt = f"""Analyze this academic presentation based on all slides to understand the overall context.

Slides Summary:
{slides_summary}

Provide analysis in the following JSON format:
{{
    "presentation_topic": "main topic/title of the presentation",
    "research_field": "academic field (e.g., Computer Science, Biology, etc.)",
    "target_audience": "expert|general|beginner",
    "presentation_structure": "description of logical flow and structure",
    "key_messages": ["main", "messages", "of", "presentation"],
    "logical_flow": "analysis of how slides connect logically",
    "estimated_total_time": 15,
    "presentation_style": "academic|conversational|formal|enthusiastic",
    "potential_qa_topics": ["likely", "question", "topics"]
}}

Guidelines:
- Infer the research field from content and terminology
- Assess audience level based on technical complexity
- Estimate total time based on slide count and complexity
- Identify potential Q&A topics from the research content

Respond with valid JSON only."""
            
            # Generate response using Ollama LLM
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.llm_model,
                        "prompt": prompt,
                        "stream": False
                    }
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        response_text = result["response"]
                    else:
                        error_text = await response.text()
                        print(f"❌ Ollama context analysis failed: {error_text}")
                        return self._create_fallback_context(slide_analyses)
            
            # Parse JSON response
            try:
                context_data = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    context_data = json.loads(json_match.group())
                else:
                    print(f"⚠️ Failed to parse JSON from Ollama response, using fallback")
                    return self._create_fallback_context(slide_analyses)
            
            return PresentationContext(
                presentation_topic=context_data["presentation_topic"],
                research_field=context_data["research_field"],
                target_audience=AudienceLevel(context_data["target_audience"]),
                presentation_structure=context_data["presentation_structure"],
                key_messages=context_data["key_messages"],
                logical_flow=context_data["logical_flow"],
                estimated_total_time=context_data["estimated_total_time"],
                presentation_style=PresentationStyle(context_data["presentation_style"]),
                potential_qa_topics=context_data["potential_qa_topics"]
            )
            
        except Exception as e:
            print(f"❌ Ollama context analysis failed: {e}")
            return self._create_fallback_context(slide_analyses)
    
    def _encode_image_to_base64(self, image_path: str) -> str:
        """
        Encode image to base64 for API transmission
        """
        try:
            with Image.open(image_path) as img:
                # Resize if too large (max 2048x2048 for GPT-4V)
                if img.width > 2048 or img.height > 2048:
                    img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Save to bytes
                buffer = io.BytesIO()
                img.save(buffer, format='PNG', optimize=True)
                buffer.seek(0)
                
                # Encode to base64
                return base64.b64encode(buffer.getvalue()).decode('utf-8')
                
        except Exception as e:
            raise Exception(f"Image encoding failed: {str(e)}")
    
    def _create_fallback_analysis(self, slide_number: int, extracted_text: str) -> SlideAnalysis:
        """
        Create fallback analysis when VLM fails
        """
        return SlideAnalysis(
            slide_number=slide_number,
            title=f"Slide {slide_number}",
            main_content=extracted_text[:500] if extracted_text else "Content analysis unavailable",
            visual_elements="Visual analysis unavailable",
            key_points=["Analysis unavailable"],
            slide_type=SlideType.CONTENT,
            estimated_speaking_time=60,
            complexity_level=ComplexityLevel.MODERATE
        )
    
    def _create_fallback_context(self, slide_analyses: List[SlideAnalysis]) -> PresentationContext:
        """
        Create fallback context when analysis fails
        """
        return PresentationContext(
            presentation_topic="Academic Presentation",
            research_field="General",
            target_audience=AudienceLevel.GENERAL,
            presentation_structure="Standard academic presentation structure",
            key_messages=["Key messages analysis unavailable"],
            logical_flow="Logical flow analysis unavailable",
            estimated_total_time=len(slide_analyses) * 2,  # 2 minutes per slide
            presentation_style=PresentationStyle.ACADEMIC,
            potential_qa_topics=["General questions about the research"]
        )

# Global VLM service instance
vlm_service = OllamaVLMService()
