"""
Photo Management API Routes

Handles all photo-related endpoints including CRUD operations,
metadata management, file operations, and multi-tier processing.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

import os
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.crud import CRUDOperations
from app.models.schemas import (
    InsertFileVersion, InsertMediaAsset, InsertAssetHistory,
    TierEnum, ProcessingStateEnum
)
from app.services.file_manager_service import FileManagerService
from app.services.metadata_service import MetadataService
from app.services.ai_service import AIService
from app.services.face_detection_service import FaceDetectionService
from app.services.thumbnail_service import ThumbnailService

router = APIRouter(prefix="/api/photos", tags=["Photos"])

# Response models
class PhotoResponse(BaseModel):
    """Standard photo response model."""
    id: str
    media_asset_id: str
    tier: str
    file_path: str
    file_hash: str
    file_size: int
    mime_type: str
    metadata: Optional[Dict[str, Any]] = None
    is_reviewed: bool = False
    rating: int = 0
    keywords: List[str] = []
    location: Optional[str] = None
    event_type: Optional[str] = None
    event_name: Optional[str] = None
    ai_short_description: Optional[str] = None
    processing_state: str = "processed"
    created_at: datetime
    updated_at: datetime
    media_asset: Optional[Dict[str, Any]] = None

class PhotoListResponse(BaseModel):
    """Photo list response with metadata."""
    photos: List[PhotoResponse]
    total_count: int
    page: int
    limit: int

class UploadResult(BaseModel):
    """Upload operation result."""
    filename: str
    status: str
    message: Optional[str] = None
    asset_id: Optional[str] = None
    version_id: Optional[str] = None
    conflicts: Optional[List[Dict[str, Any]]] = None

class BatchUploadResponse(BaseModel):
    """Batch upload response."""
    results: List[UploadResult]
    has_conflicts: bool = False
    total_conflicts: int = 0

class MetadataUpdateRequest(BaseModel):
    """Metadata update request."""
    rating: Optional[int] = None
    keywords: Optional[List[str]] = None
    event_type: Optional[str] = None
    event_name: Optional[str] = None
    location: Optional[str] = None
    ai_tags: Optional[List[str]] = None
    ai_description: Optional[str] = None

class BatchProcessRequest(BaseModel):
    """Batch processing request."""
    photo_ids: List[str]
    operation: str  # 'ai_process', 'promote', 'demote'
    params: Optional[Dict[str, Any]] = None


# Dependencies
async def get_file_manager() -> FileManagerService:
    """Get file manager service instance."""
    return FileManagerService()

async def get_metadata_service() -> MetadataService:
    """Get metadata service instance."""
    return MetadataService()

async def get_ai_service() -> AIService:
    """Get AI service instance."""
    return AIService()

async def get_face_detection_service() -> FaceDetectionService:
    """Get face detection service instance."""
    return FaceDetectionService()

async def get_thumbnail_service() -> ThumbnailService:
    """Get thumbnail service instance."""
    return ThumbnailService()


@router.get("/", response_model=PhotoListResponse)
async def list_photos(
    tier: Optional[str] = Query(None, description="Filter by tier: silver, gold, unprocessed, all_versions"),
    show_all_versions: bool = Query(False, description="Show all versions of photos"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """
    List photos with optional filters and pagination.
    
    Supports the same filtering options as TypeScript backend:
    - tier: Filter by specific tier
    - unprocessed: Show silver photos without gold versions
    - all_versions: Show all versions of all photos
    """
    try:
        offset = (page - 1) * limit
        
        if tier == "unprocessed":
            # Get silver photos that haven't been promoted to gold
            photos = await crud.get_unprocessed_photos(limit=limit, offset=offset)
        elif tier == "all_versions":
            # Show all versions of all photos (admin view)
            photos = await crud.get_all_file_versions(limit=limit, offset=offset)
        elif tier:
            # Show specific tier, filter out superseded unless explicitly requested
            photos = await crud.get_photos_by_tier(
                tier=tier, 
                show_superseded=show_all_versions,
                limit=limit, 
                offset=offset
            )
        else:
            # Default view: show highest tier version of each asset
            photos = await crud.get_highest_tier_photos(limit=limit, offset=offset)
        
        # Get total count for pagination
        total_count = await crud.get_photos_count(tier=tier)
        
        # Enhance photos with media asset information
        enhanced_photos = []
        for photo in photos:
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            photo_dict = photo.dict()
            photo_dict["media_asset"] = media_asset.dict() if media_asset else None
            enhanced_photos.append(PhotoResponse(**photo_dict))
        
        return PhotoListResponse(
            photos=enhanced_photos,
            total_count=total_count,
            page=page,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch photos: {str(e)}")


@router.get("/recent")
async def get_recent_photos(
    limit: int = Query(6, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get recent photos for dashboard."""
    try:
        photos = await crud.get_recent_photos(limit=limit)
        return [photo.dict() for photo in photos]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent photos: {str(e)}")


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get photo by ID with full details."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        # Get media asset and history
        media_asset = await crud.get_media_asset(photo.media_asset_id)
        history = await crud.get_asset_history(photo.media_asset_id)
        
        photo_dict = photo.dict()
        photo_dict["media_asset"] = media_asset.dict() if media_asset else None
        photo_dict["history"] = [h.dict() for h in history] if history else []
        
        return PhotoResponse(**photo_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch photo: {str(e)}")


@router.post("/upload", response_model=BatchUploadResponse)
async def upload_photos(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    file_manager: FileManagerService = Depends(get_file_manager),
    metadata_service: MetadataService = Depends(get_metadata_service),
    face_detection: FaceDetectionService = Depends(get_face_detection_service)
):
    """
    Upload multiple photos with enhanced duplicate detection.
    
    Matches TypeScript backend upload flow:
    1. Calculate file hash for duplicate detection
    2. Run enhanced duplicate detection
    3. Process file to Silver tier with basic processing
    4. Extract EXIF metadata
    5. Run face detection
    6. Create file version and save faces
    """
    try:
        results = []
        conflicts = []
        
        for file in files:
            try:
                # Validate file type
                if not await file_manager.is_valid_file_type(file.filename):
                    results.append(UploadResult(
                        filename=file.filename,
                        status="error",
                        message="Unsupported file type"
                    ))
                    continue
                
                # Save temporary file
                temp_path = await file_manager.save_temp_file(file)
                
                # Calculate file hash for duplicate detection
                file_hash = await file_manager.calculate_file_hash(temp_path)
                
                # Check for duplicates using enhanced detection
                duplicate_conflicts = await file_manager.check_for_duplicates(
                    temp_path, file.filename, file_hash
                )
                
                # Handle auto-skip for MD5 duplicates
                if len(duplicate_conflicts) == 0:
                    exact_duplicate = await crud.get_file_by_hash(file_hash)
                    if exact_duplicate:
                        results.append(UploadResult(
                            filename=file.filename,
                            status="skipped",
                            message="Identical file already exists - automatically skipped"
                        ))
                        await file_manager.cleanup_temp_file(temp_path)
                        continue
                
                # Handle conflicts
                if duplicate_conflicts:
                    conflicts.extend([{**conflict, "filename": file.filename} 
                                    for conflict in duplicate_conflicts])
                    results.append(UploadResult(
                        filename=file.filename,
                        status="conflict",
                        message=f"{len(duplicate_conflicts)} potential duplicate(s) found",
                        conflicts=duplicate_conflicts
                    ))
                    continue
                
                # No conflicts - proceed with upload
                # Create media asset
                media_asset = await crud.create_media_asset(
                    InsertMediaAsset(original_filename=file.filename)
                )
                
                # Process file to Silver tier
                silver_path = await file_manager.process_to_silver(temp_path, file.filename)
                
                # Extract metadata
                metadata = await metadata_service.extract_metadata(silver_path)
                
                # Create file version
                file_version = await crud.create_file_version(InsertFileVersion(
                    media_asset_id=media_asset.id,
                    tier=TierEnum.SILVER,
                    file_path=silver_path,
                    file_hash=file_hash,
                    file_size=file.size,
                    mime_type=file.content_type,
                    metadata=metadata,
                    ai_short_description=None,  # No AI processing at upload
                    is_reviewed=False
                ))
                
                # Detect faces if it's an image
                if file.content_type.startswith("image/"):
                    faces = await face_detection.detect_faces(silver_path)
                    
                    # Save detected faces
                    for face in faces:
                        await crud.create_face({
                            "photo_id": file_version.id,
                            "bounding_box": face.bounding_box,
                            "confidence": face.confidence,
                            "embedding": face.embedding,
                            "person_id": None  # Faces start unassigned
                        })
                    
                    # Update metadata with face detection results
                    if faces:
                        face_metadata = {"faces_detected": len(faces)}
                        combined_metadata = {**(metadata or {}), **face_metadata}
                        await crud.update_file_version(file_version.id, {"metadata": combined_metadata})
                
                # Log ingestion
                await crud.create_asset_history(InsertAssetHistory(
                    media_asset_id=media_asset.id,
                    action="INGESTED",
                    details=f"File uploaded to Silver tier with basic processing: {file.filename}"
                ))
                
                # Cleanup temp file
                await file_manager.cleanup_temp_file(temp_path)
                
                results.append(UploadResult(
                    filename=file.filename,
                    status="success",
                    asset_id=media_asset.id,
                    version_id=file_version.id
                ))
                
            except Exception as file_error:
                results.append(UploadResult(
                    filename=file.filename,
                    status="error",
                    message=f"Failed to process file: {str(file_error)}"
                ))
        
        return BatchUploadResponse(
            results=results,
            has_conflicts=len(conflicts) > 0,
            total_conflicts=len(conflicts)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.patch("/{photo_id}/metadata")
async def update_photo_metadata(
    photo_id: str,
    updates: MetadataUpdateRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Update photo metadata."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        # Prepare updates
        update_data = {}
        
        # Handle AI metadata updates
        if updates.ai_tags or updates.ai_description:
            existing_metadata = photo.metadata or {}
            ai_metadata = existing_metadata.get("ai", {})
            
            if updates.ai_tags:
                ai_metadata["aiTags"] = updates.ai_tags
            if updates.ai_description:
                ai_metadata["longDescription"] = updates.ai_description
            
            existing_metadata["ai"] = ai_metadata
            update_data["metadata"] = existing_metadata
        
        # Handle other updates
        for field, value in updates.dict(exclude_unset=True).items():
            if field not in ["ai_tags", "ai_description"] and value is not None:
                update_data[field] = value
        
        # Update photo
        updated_photo = await crud.update_file_version(photo_id, update_data)
        return updated_photo.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {str(e)}")


@router.get("/{photo_id}/history")
async def get_photo_history(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get photo history."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        history = await crud.get_asset_history(photo.media_asset_id)
        return [h.dict() for h in history]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/{photo_id}/filename-preview")
async def get_filename_preview(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service)
):
    """Get filename preview for promotion."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        # Get naming pattern from settings
        naming_pattern = await crud.get_setting_value("gold_naming_pattern", "datetime")
        custom_pattern = await crud.get_setting_value("custom_naming_pattern", "")
        
        media_asset = await crud.get_media_asset(photo.media_asset_id)
        if not media_asset:
            raise HTTPException(status_code=404, detail="Media asset not found")
        
        # Generate preview filename
        final_pattern = custom_pattern if naming_pattern == "custom" else naming_pattern
        preview_filename = await ai_service.generate_filename(
            photo=photo,
            media_asset=media_asset,
            pattern=final_pattern,
            tier="gold"
        )
        
        return {"filename": preview_filename}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")


@router.get("/{photo_id}/versions")
async def get_photo_versions(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get all versions of a media asset."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        versions = await crud.get_file_versions_by_asset(photo.media_asset_id)
        
        # Enhance with media asset info and sort by tier priority
        enhanced_versions = []
        for version in versions:
            media_asset = await crud.get_media_asset(version.media_asset_id)
            version_dict = version.dict()
            version_dict["media_asset"] = media_asset.dict() if media_asset else None
            enhanced_versions.append(version_dict)
        
        # Sort by tier priority (Gold > Silver > Bronze)
        tier_priority = {"gold": 3, "silver": 2, "bronze": 1}
        enhanced_versions.sort(
            key=lambda v: tier_priority.get(v["tier"], 0), 
            reverse=True
        )
        
        return enhanced_versions
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch versions: {str(e)}")


@router.post("/{photo_id}/process-ai")
async def process_photo_ai(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service)
):
    """Manual AI processing for Silver tier photos."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        if photo.tier != "silver":
            raise HTTPException(status_code=400, detail="Only Silver tier photos can be AI processed")
        
        if not photo.mime_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="AI processing only supports images")
        
        # Check if already has AI processing
        existing_ai = photo.metadata.get("ai", {}) if photo.metadata else {}
        if existing_ai.get("shortDescription"):
            raise HTTPException(status_code=400, detail="Photo already has AI processing")
        
        # Get people context for enhanced AI analysis
        faces = await crud.get_faces_by_photo(photo_id)
        people_context = await ai_service.build_people_context(faces, crud)
        
        # Run AI analysis
        ai_metadata = await ai_service.analyze_image_with_context(
            photo.file_path, people_context
        )
        
        # Update metadata
        combined_metadata = {**(photo.metadata or {}), "ai": ai_metadata}
        await crud.update_file_version(photo_id, {
            "metadata": combined_metadata,
            "ai_short_description": ai_metadata.get("shortDescription"),
            "is_reviewed": False
        })
        
        # Log AI processing
        await crud.create_asset_history(InsertAssetHistory(
            media_asset_id=photo.media_asset_id,
            action="AI_PROCESSED",
            details="AI analysis completed with enhanced metadata and descriptions"
        ))
        
        return {
            "success": True,
            "message": "AI processing completed successfully",
            "ai_metadata": ai_metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")


@router.post("/{photo_id}/promote")
async def promote_photo(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    file_manager: FileManagerService = Depends(get_file_manager)
):
    """Promote photo from Silver to Gold tier."""
    try:
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        if photo.tier != "silver":
            raise HTTPException(status_code=400, detail="Photo must be in Silver tier for promotion")
        
        # Copy file to Gold tier
        media_asset = await crud.get_media_asset(photo.media_asset_id)
        gold_path = await file_manager.copy_to_gold(photo.file_path, media_asset)
        
        # Create Gold file version
        gold_version = await crud.create_file_version(InsertFileVersion(
            media_asset_id=photo.media_asset_id,
            tier=TierEnum.GOLD,
            file_path=gold_path,
            file_hash=photo.file_hash,
            file_size=photo.file_size,
            mime_type=photo.mime_type,
            metadata=photo.metadata,
            is_reviewed=True
        ))
        
        # Log promotion
        await crud.create_asset_history(InsertAssetHistory(
            media_asset_id=photo.media_asset_id,
            action="PROMOTED",
            details="Promoted from Silver to Gold tier"
        ))
        
        return gold_version.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to promote photo: {str(e)}")


@router.post("/batch-process", response_model=Dict[str, Any])
async def batch_process_photos(
    request: BatchProcessRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    ai_service: AIService = Depends(get_ai_service),
    file_manager: FileManagerService = Depends(get_file_manager)
):
    """Batch process photos with various operations."""
    try:
        processed = 0
        errors = []
        
        for photo_id in request.photo_ids:
            try:
                photo = await crud.get_file_version(photo_id)
                if not photo:
                    continue
                
                if request.operation == "ai_process":
                    if photo.tier == "silver" and photo.mime_type.startswith("image/"):
                        # Get people context and run AI analysis
                        faces = await crud.get_faces_by_photo(photo_id)
                        people_context = await ai_service.build_people_context(faces, crud)
                        ai_metadata = await ai_service.analyze_image_with_context(
                            photo.file_path, people_context
                        )
                        
                        # Update metadata
                        combined_metadata = {**(photo.metadata or {}), "ai": ai_metadata}
                        await crud.update_file_version(photo_id, {
                            "metadata": combined_metadata,
                            "ai_short_description": ai_metadata.get("shortDescription"),
                            "is_reviewed": False
                        })
                        processed += 1
                        
                elif request.operation == "promote":
                    if photo.tier == "silver":
                        # Promote to gold
                        media_asset = await crud.get_media_asset(photo.media_asset_id)
                        gold_path = await file_manager.copy_to_gold(photo.file_path, media_asset)
                        
                        await crud.create_file_version(InsertFileVersion(
                            media_asset_id=photo.media_asset_id,
                            tier=TierEnum.GOLD,
                            file_path=gold_path,
                            file_hash=photo.file_hash,
                            file_size=photo.file_size,
                            mime_type=photo.mime_type,
                            metadata=photo.metadata,
                            is_reviewed=True
                        ))
                        processed += 1
                        
            except Exception as photo_error:
                errors.append({"photo_id": photo_id, "error": str(photo_error)})
        
        return {
            "processed": processed,
            "errors": errors,
            "total_requested": len(request.photo_ids)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")


@router.patch("/{photo_id}/rating")
async def update_photo_rating(
    photo_id: str,
    rating: int,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Update photo rating (0-5 stars)."""
    try:
        if not 0 <= rating <= 5:
            raise HTTPException(status_code=400, detail="Rating must be between 0 and 5")
        
        await crud.update_file_version(photo_id, {"rating": rating})
        return {"success": True, "rating": rating}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update rating: {str(e)}")


@router.get("/burst-analysis")
async def get_burst_analysis(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get burst photo analysis for grouping."""
    try:
        # Get recent photos for burst analysis
        photos = await crud.get_recent_photos(limit=limit)
        
        # TODO: Implement burst detection service integration
        # For now, return empty groups
        return {
            "groups": [],
            "total_photos": len(photos),
            "burst_groups": 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Burst analysis failed: {str(e)}")


# File serving endpoints will be handled in a separate file_routes.py
# to match the TypeScript backend structure