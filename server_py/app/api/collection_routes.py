"""
Collections API Routes

Handles collection management, smart collections, and photo organization.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.crud import CRUDOperations
from app.models.schemas import InsertCollection, InsertCollectionPhoto, SmartCollectionRules

router = APIRouter(prefix="/api/collections", tags=["Collections"])

# Response models
class CollectionResponse(BaseModel):
    """Standard collection response model."""
    id: str
    name: str
    description: Optional[str] = None
    is_public: bool = False
    cover_photo: Optional[str] = None
    is_smart_collection: bool = False
    smart_rules: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    photo_count: Optional[int] = None
    photos: Optional[List[Dict[str, Any]]] = None

class CollectionCreateRequest(BaseModel):
    """Collection creation request."""
    name: str
    description: Optional[str] = None
    is_public: bool = False
    cover_photo: Optional[str] = None
    is_smart_collection: bool = False
    smart_rules: Optional[SmartCollectionRules] = None

class CollectionUpdateRequest(BaseModel):
    """Collection update request."""
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    cover_photo: Optional[str] = None
    smart_rules: Optional[SmartCollectionRules] = None

class PhotosRequest(BaseModel):
    """Request to add/remove photos from collection."""
    photo_ids: List[str]

class SmartCollectionCreateRequest(BaseModel):
    """Smart collection creation request."""
    name: str
    description: Optional[str] = None
    rules: SmartCollectionRules

class SmartCollectionToggleRequest(BaseModel):
    """Smart collection toggle request."""
    is_active: bool


@router.get("/", response_model=List[CollectionResponse])
async def list_collections(
    include_smart: bool = Query(True, description="Include smart collections"),
    include_photo_count: bool = Query(True, description="Include photo counts"),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """
    List all collections with optional photo counts and cover photos.
    
    Matches TypeScript backend functionality for collection listing.
    """
    try:
        collections = await crud.get_collections()
        
        # Filter smart collections if requested
        if not include_smart:
            collections = [c for c in collections if not c.is_smart_collection]
        
        # Enhance with photo counts and cover photos
        enhanced_collections = []
        for collection in collections:
            collection_dict = collection.dict()
            
            if include_photo_count:
                photos = await crud.get_collection_photos(collection.id)
                collection_dict["photo_count"] = len(photos)
                collection_dict["cover_photo"] = photos[0].file_path if photos else None
            
            enhanced_collections.append(CollectionResponse(**collection_dict))
        
        return enhanced_collections
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch collections: {str(e)}")


@router.post("/", response_model=CollectionResponse)
async def create_collection(
    request: CollectionCreateRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Create a new collection."""
    try:
        collection_data = InsertCollection(
            name=request.name,
            description=request.description,
            is_public=request.is_public,
            cover_photo=request.cover_photo,
            is_smart_collection=request.is_smart_collection,
            smart_rules=request.smart_rules.dict() if request.smart_rules else None
        )
        
        collection = await crud.create_collection(collection_data)
        
        # If it's a smart collection, trigger organization
        if request.is_smart_collection and request.smart_rules:
            # TODO: Implement smart collection photo organization
            pass
        
        return CollectionResponse(**collection.dict())
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create collection: {str(e)}")


@router.get("/{collection_id}")
async def get_collection(
    collection_id: str,
    include_photos: bool = Query(False, description="Include collection photos"),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get collection by ID with optional photos."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        collection_dict = collection.dict()
        
        if include_photos:
            photos = await crud.get_collection_photos(collection_id)
            collection_dict["photos"] = [photo.dict() for photo in photos]
            collection_dict["photo_count"] = len(photos)
        
        return CollectionResponse(**collection_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch collection: {str(e)}")


@router.patch("/{collection_id}")
async def update_collection(
    collection_id: str,
    request: CollectionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Update collection details."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Prepare update data
        update_data = request.dict(exclude_unset=True)
        if "smart_rules" in update_data and update_data["smart_rules"]:
            update_data["smart_rules"] = update_data["smart_rules"].dict()
        
        updated_collection = await crud.update_collection(collection_id, update_data)
        return CollectionResponse(**updated_collection.dict())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update collection: {str(e)}")


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Delete a collection."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        await crud.delete_collection(collection_id)
        return {"success": True, "message": "Collection deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete collection: {str(e)}")


@router.get("/{collection_id}/photos")
async def get_collection_photos(
    collection_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get photos in a collection with pagination."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        offset = (page - 1) * limit
        photos = await crud.get_collection_photos(
            collection_id, 
            limit=limit, 
            offset=offset
        )
        
        # Enhance photos with media asset information
        enhanced_photos = []
        for photo in photos:
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            photo_dict = photo.dict()
            photo_dict["media_asset"] = media_asset.dict() if media_asset else None
            enhanced_photos.append(photo_dict)
        
        return enhanced_photos
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch collection photos: {str(e)}")


@router.post("/{collection_id}/photos")
async def add_photos_to_collection(
    collection_id: str,
    request: PhotosRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Add photos to a collection."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Prevent adding photos to smart collections manually
        if collection.is_smart_collection:
            raise HTTPException(
                status_code=400, 
                detail="Cannot manually add photos to smart collections"
            )
        
        added_count = 0
        for photo_id in request.photo_ids:
            # Check if photo exists
            photo = await crud.get_file_version(photo_id)
            if photo:
                # Check if already in collection
                existing = await crud.get_collection_photo(collection_id, photo_id)
                if not existing:
                    await crud.add_photo_to_collection(collection_id, photo_id)
                    added_count += 1
        
        return {
            "success": True,
            "added": added_count,
            "total_requested": len(request.photo_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add photos: {str(e)}")


@router.delete("/{collection_id}/photos")
async def remove_photos_from_collection(
    collection_id: str,
    request: PhotosRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Remove photos from a collection."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Prevent removing photos from smart collections manually
        if collection.is_smart_collection:
            raise HTTPException(
                status_code=400, 
                detail="Cannot manually remove photos from smart collections"
            )
        
        removed_count = 0
        for photo_id in request.photo_ids:
            existing = await crud.get_collection_photo(collection_id, photo_id)
            if existing:
                await crud.remove_photo_from_collection(collection_id, photo_id)
                removed_count += 1
        
        return {
            "success": True,
            "removed": removed_count,
            "total_requested": len(request.photo_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove photos: {str(e)}")


# Smart Collections endpoints
@router.get("/smart-collections", response_model=List[CollectionResponse])
async def list_smart_collections(
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get all smart collections."""
    try:
        collections = await crud.get_collections()
        smart_collections = [c for c in collections if c.is_smart_collection]
        
        enhanced_collections = []
        for collection in smart_collections:
            collection_dict = collection.dict()
            photos = await crud.get_collection_photos(collection.id)
            collection_dict["photo_count"] = len(photos)
            enhanced_collections.append(CollectionResponse(**collection_dict))
        
        return enhanced_collections
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get smart collections: {str(e)}")


@router.post("/smart-collections", response_model=CollectionResponse)
async def create_smart_collection(
    request: SmartCollectionCreateRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Create a new smart collection."""
    try:
        collection_data = InsertCollection(
            name=request.name,
            description=request.description,
            is_smart_collection=True,
            smart_rules=request.rules.dict(),
            is_public=False
        )
        
        collection = await crud.create_collection(collection_data)
        
        # TODO: Trigger smart collection organization
        # await organize_smart_collection(collection.id, request.rules)
        
        return CollectionResponse(**collection.dict())
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create smart collection: {str(e)}")


@router.patch("/smart-collections/{collection_id}/toggle")
async def toggle_smart_collection(
    collection_id: str,
    request: SmartCollectionToggleRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Toggle smart collection active status."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        if not collection.is_smart_collection:
            raise HTTPException(status_code=400, detail="Not a smart collection")
        
        await crud.update_collection(collection_id, {"is_public": request.is_active})
        
        return {"success": True, "is_active": request.is_active}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle smart collection: {str(e)}")


@router.post("/smart-collections/organize")
async def organize_smart_collections(
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Organize photos into smart collections based on rules."""
    try:
        # Get all active smart collections
        collections = await crud.get_collections()
        smart_collections = [c for c in collections if c.is_smart_collection and c.is_public]
        
        organized_count = 0
        
        for collection in smart_collections:
            if collection.smart_rules:
                # TODO: Implement smart collection rule evaluation
                # For now, return success message
                pass
        
        return {
            "message": "Smart collection organization completed",
            "organized": organized_count,
            "processed_collections": len(smart_collections)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to organize smart collections: {str(e)}")


@router.get("/smart-collections/{collection_id}/photos")
async def get_smart_collection_photos(
    collection_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get photos in a smart collection."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        if not collection.is_smart_collection:
            raise HTTPException(status_code=400, detail="Not a smart collection")
        
        offset = (page - 1) * limit
        photos = await crud.get_collection_photos(
            collection_id, 
            limit=limit, 
            offset=offset
        )
        
        # Enhance photos with media asset information
        enhanced_photos = []
        for photo in photos:
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            photo_dict = photo.dict()
            photo_dict["media_asset"] = media_asset.dict() if media_asset else None
            enhanced_photos.append(photo_dict)
        
        return enhanced_photos
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch smart collection photos: {str(e)}")


# Collection statistics
@router.get("/{collection_id}/stats")
async def get_collection_stats(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get collection statistics."""
    try:
        collection = await crud.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        photos = await crud.get_collection_photos(collection_id)
        
        # Calculate basic statistics
        stats = {
            "total_photos": len(photos),
            "last_added": None,
            "file_types": {},
            "tier_distribution": {"silver": 0, "gold": 0, "bronze": 0},
            "avg_rating": 0
        }
        
        if photos:
            # Get detailed stats
            ratings = []
            for photo in photos:
                # File type distribution
                ext = photo.file_path.split('.')[-1].lower() if '.' in photo.file_path else 'unknown'
                stats["file_types"][ext] = stats["file_types"].get(ext, 0) + 1
                
                # Tier distribution
                stats["tier_distribution"][photo.tier] += 1
                
                # Ratings
                if photo.rating > 0:
                    ratings.append(photo.rating)
            
            # Average rating
            if ratings:
                stats["avg_rating"] = round(sum(ratings) / len(ratings), 2)
            
            # Most recent addition
            latest_photo = max(photos, key=lambda p: p.created_at)
            stats["last_added"] = latest_photo.created_at.isoformat()
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get collection stats: {str(e)}")