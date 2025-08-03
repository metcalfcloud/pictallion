"""
AI Processing API Routes

Handles AI configuration, analysis, prompts, and AI-powered features.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.crud import CRUDOperations
from app.models.schemas import InsertAIPrompt, AICategoryEnum, AIProviderEnum
from app.services.ai_service import AIService
from app.services.prompt_management_service import PromptManagementService

router = APIRouter(prefix="/api/ai", tags=["AI"])

# Request/Response models
class AIConfigResponse(BaseModel):
    """AI configuration response."""
    current_provider: str
    available_providers: Dict[str, bool]
    config: Dict[str, Any]

class AIConfigRequest(BaseModel):
    """AI configuration update request."""
    provider: Optional[str] = None
    ollama: Optional[Dict[str, Any]] = None
    openai: Optional[Dict[str, Any]] = None

class AIAnalysisRequest(BaseModel):
    """AI analysis request."""
    photo_id: str
    provider: Optional[str] = None
    include_people_context: bool = True

class AIAnalysisResponse(BaseModel):
    """AI analysis response."""
    success: bool
    analysis: Dict[str, Any]
    confidence_scores: Dict[str, float]
    processing_time: float

class AIPromptResponse(BaseModel):
    """AI prompt response."""
    id: str
    name: str
    description: Optional[str]
    category: str
    provider: str
    system_prompt: str
    user_prompt: str
    is_default: bool
    is_active: bool
    created_at: str
    updated_at: str

class AIPromptCreateRequest(BaseModel):
    """AI prompt creation request."""
    name: str
    description: Optional[str] = None
    category: AICategoryEnum
    provider: AIProviderEnum
    system_prompt: str
    user_prompt: str
    is_default: bool = False
    is_active: bool = True

class AIPromptUpdateRequest(BaseModel):
    """AI prompt update request."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[AICategoryEnum] = None
    provider: Optional[AIProviderEnum] = None
    system_prompt: Optional[str] = None
    user_prompt: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


# Dependencies
async def get_ai_service() -> AIService:
    """Get AI service instance."""
    return AIService()

async def get_prompt_service() -> PromptManagementService:
    """Get prompt management service instance."""
    return PromptManagementService()


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config(
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Get current AI configuration and available providers.
    
    Returns provider status, configuration, and availability.
    """
    try:
        config = await ai_service.get_config()
        providers = await ai_service.get_available_providers()
        
        return AIConfigResponse(
            current_provider=config.get("provider", "ollama"),
            available_providers=providers,
            config={
                "ollama": {
                    "base_url": config.get("ollama", {}).get("base_url", ""),
                    "vision_model": config.get("ollama", {}).get("vision_model", ""),
                    "text_model": config.get("ollama", {}).get("text_model", "")
                },
                "openai": {
                    "model": config.get("openai", {}).get("model", ""),
                    "has_api_key": bool(config.get("openai", {}).get("api_key"))
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get AI config: {str(e)}")


@router.post("/config")
async def update_ai_config(
    request: AIConfigRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Update AI configuration."""
    try:
        config_updates = {}
        
        if request.provider:
            config_updates["provider"] = request.provider
        if request.ollama:
            config_updates["ollama"] = request.ollama
        if request.openai:
            config_updates["openai"] = request.openai
        
        await ai_service.update_config(config_updates)
        
        return {"success": True, "message": "AI configuration updated"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update AI config: {str(e)}")


@router.post("/test")
async def test_ai_providers(
    ai_service: AIService = Depends(get_ai_service)
):
    """Test AI provider availability and connectivity."""
    try:
        providers = await ai_service.test_providers()
        
        return {
            "ollama": providers.get("ollama", False),
            "openai": providers.get("openai", False)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test AI providers: {str(e)}")


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_image(
    request: AIAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Analyze image with AI for tags, description, and objects.
    
    Supports both standalone analysis and context-aware analysis with people.
    """
    try:
        import time
        start_time = time.time()
        
        # Get photo
        photo = await crud.get_file_version(request.photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        if not photo.mime_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="AI analysis only supports images")
        
        # Get people context if requested
        people_context = []
        if request.include_people_context:
            faces = await crud.get_faces_by_photo(request.photo_id)
            people_context = await ai_service.build_people_context(faces, crud)
        
        # Run AI analysis
        provider = request.provider or "openai"
        
        if people_context:
            analysis = await ai_service.analyze_image_with_context(
                photo.file_path, people_context, provider
            )
        else:
            analysis = await ai_service.analyze_image(photo.file_path, provider)
        
        # Enhance with short description
        enhanced_analysis = await ai_service.enhance_metadata_with_short_description(
            analysis, photo.file_path
        )
        
        processing_time = time.time() - start_time
        
        return AIAnalysisResponse(
            success=True,
            analysis=enhanced_analysis,
            confidence_scores=enhanced_analysis.get("ai_confidence_scores", {}),
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.post("/analyze-batch")
async def analyze_batch(
    photo_ids: List[str],
    provider: Optional[str] = None,
    include_people_context: bool = True,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service)
):
    """Batch AI analysis for multiple photos."""
    try:
        results = []
        errors = []
        
        for photo_id in photo_ids:
            try:
                photo = await crud.get_file_version(photo_id)
                if not photo or not photo.mime_type.startswith("image/"):
                    continue
                
                # Get people context if requested
                people_context = []
                if include_people_context:
                    faces = await crud.get_faces_by_photo(photo_id)
                    people_context = await ai_service.build_people_context(faces, crud)
                
                # Run AI analysis
                analysis_provider = provider or "openai"
                
                if people_context:
                    analysis = await ai_service.analyze_image_with_context(
                        photo.file_path, people_context, analysis_provider
                    )
                else:
                    analysis = await ai_service.analyze_image(photo.file_path, analysis_provider)
                
                enhanced_analysis = await ai_service.enhance_metadata_with_short_description(
                    analysis, photo.file_path
                )
                
                # Update photo metadata
                combined_metadata = {**(photo.metadata or {}), "ai": enhanced_analysis}
                await crud.update_file_version(photo_id, {
                    "metadata": combined_metadata,
                    "ai_short_description": enhanced_analysis.get("short_description"),
                    "is_reviewed": False
                })
                
                results.append({
                    "photo_id": photo_id,
                    "status": "success",
                    "analysis": enhanced_analysis
                })
                
            except Exception as photo_error:
                errors.append({
                    "photo_id": photo_id,
                    "error": str(photo_error)
                })
        
        return {
            "processed": len(results),
            "errors": len(errors),
            "results": results,
            "error_details": errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


# AI Prompts Management
@router.get("/prompts", response_model=List[AIPromptResponse])
async def list_ai_prompts(
    category: Optional[str] = Query(None, description="Filter by category"),
    provider: Optional[str] = Query(None, description="Filter by provider"),
    active_only: bool = Query(False, description="Show only active prompts"),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """List AI prompts with optional filtering."""
    try:
        if category:
            prompts = await crud.get_ai_prompts_by_category(category)
        elif provider:
            prompts = await crud.get_ai_prompts_by_provider(provider)
        else:
            prompts = await crud.get_all_ai_prompts()
        
        # Filter active only if requested
        if active_only:
            prompts = [p for p in prompts if p.is_active]
        
        return [AIPromptResponse(**prompt.dict()) for prompt in prompts]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch AI prompts: {str(e)}")


@router.get("/prompts/category/{category}", response_model=List[AIPromptResponse])
async def get_prompts_by_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get AI prompts by category."""
    try:
        prompts = await crud.get_ai_prompts_by_category(category)
        return [AIPromptResponse(**prompt.dict()) for prompt in prompts]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch prompts: {str(e)}")


@router.get("/prompts/provider/{provider}", response_model=List[AIPromptResponse])
async def get_prompts_by_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get AI prompts by provider."""
    try:
        prompts = await crud.get_ai_prompts_by_provider(provider)
        return [AIPromptResponse(**prompt.dict()) for prompt in prompts]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch prompts: {str(e)}")


@router.get("/prompts/{prompt_id}", response_model=AIPromptResponse)
async def get_ai_prompt(
    prompt_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get AI prompt by ID."""
    try:
        prompt = await crud.get_ai_prompt(prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="AI prompt not found")
        
        return AIPromptResponse(**prompt.dict())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch AI prompt: {str(e)}")


@router.post("/prompts", response_model=AIPromptResponse)
async def create_ai_prompt(
    request: AIPromptCreateRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Create a new AI prompt."""
    try:
        prompt_data = InsertAIPrompt(
            name=request.name,
            description=request.description,
            category=request.category,
            provider=request.provider,
            system_prompt=request.system_prompt,
            user_prompt=request.user_prompt,
            is_default=request.is_default,
            is_active=request.is_active
        )
        
        prompt = await crud.create_ai_prompt(prompt_data)
        return AIPromptResponse(**prompt.dict())
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create AI prompt: {str(e)}")


@router.put("/prompts/{prompt_id}", response_model=AIPromptResponse)
async def update_ai_prompt(
    prompt_id: str,
    request: AIPromptUpdateRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Update an AI prompt."""
    try:
        prompt = await crud.get_ai_prompt(prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="AI prompt not found")
        
        update_data = request.dict(exclude_unset=True)
        updated_prompt = await crud.update_ai_prompt(prompt_id, update_data)
        
        return AIPromptResponse(**updated_prompt.dict())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update AI prompt: {str(e)}")


@router.delete("/prompts/{prompt_id}")
async def delete_ai_prompt(
    prompt_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Delete an AI prompt."""
    try:
        prompt = await crud.get_ai_prompt(prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="AI prompt not found")
        
        await crud.delete_ai_prompt(prompt_id)
        return {"success": True, "message": "AI prompt deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete AI prompt: {str(e)}")


@router.post("/prompts/reset-to-defaults")
async def reset_prompts_to_defaults(
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Reset AI prompts to default values."""
    try:
        await crud.reset_ai_prompts_to_defaults()
        return {"success": True, "message": "AI prompts reset to defaults successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset prompts: {str(e)}")


@router.get("/prompts/defaults/available")
async def get_default_prompts(
    prompt_service: PromptManagementService = Depends(get_prompt_service)
):
    """Get available default prompts and categories."""
    try:
        defaults = await prompt_service.get_default_prompts()
        categories = await prompt_service.get_prompt_categories()
        
        return {
            "prompts": defaults,
            "categories": categories
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch default prompts: {str(e)}")


# AI-powered naming and descriptions
@router.post("/generate-filename")
async def generate_ai_filename(
    photo_id: str,
    pattern: str = "ai_description",
    tier: str = "gold",
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service)
):
    """Generate AI-powered filename for a photo."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        media_asset = await crud.get_media_asset(photo.media_asset_id)
        if not media_asset:
            raise HTTPException(status_code=404, detail="Media asset not found")
        
        filename = await ai_service.generate_filename(
            photo=photo,
            media_asset=media_asset,
            pattern=pattern,
            tier=tier
        )
        
        return {"filename": filename, "pattern": pattern}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate filename: {str(e)}")


@router.post("/enhance-description")
async def enhance_description(
    photo_id: str,
    base_description: str,
    include_technical: bool = True,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service)
):
    """Enhance a basic description with AI-powered details."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        enhanced = await ai_service.enhance_description(
            photo.file_path,
            base_description,
            include_technical=include_technical
        )
        
        return {
            "original": base_description,
            "enhanced": enhanced,
            "photo_id": photo_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enhance description: {str(e)}")