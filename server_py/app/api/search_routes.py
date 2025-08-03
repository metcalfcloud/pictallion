"""
Advanced Search API Routes

Handles advanced search, filtering, and photo discovery features.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.crud import CRUDOperations
from app.services.advanced_search_service import AdvancedSearchService

router = APIRouter(prefix="/api", tags=["Search"])

# Request/Response models
class SearchFilters(BaseModel):
    """Advanced search filters."""
    query: Optional[str] = None
    tier: Optional[str] = None
    rating: Optional[Dict[str, int]] = None  # {"min": 1, "max": 5}
    date_range: Optional[Dict[str, str]] = Field(None, alias="dateRange")  # {"start": "2023-01-01", "end": "2023-12-31"}
    tags: Optional[List[str]] = None
    people: Optional[List[str]] = None
    locations: Optional[List[str]] = None
    event_types: Optional[List[str]] = Field(None, alias="eventTypes")
    mime_types: Optional[List[str]] = Field(None, alias="mimeTypes")
    has_faces: Optional[bool] = Field(None, alias="hasFaces")
    is_favorite: Optional[bool] = Field(None, alias="isFavorite")
    keywords: Optional[List[str]] = None
    file_size: Optional[Dict[str, int]] = Field(None, alias="fileSize")  # {"min": 1024, "max": 10485760}

class SearchSort(BaseModel):
    """Search sorting options."""
    field: str = "created_at"  # created_at, rating, file_size, name
    direction: str = "desc"  # asc, desc

class SearchRequest(BaseModel):
    """Advanced search request."""
    filters: Optional[SearchFilters] = None
    sort: Optional[SearchSort] = None
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)

class SearchFacets(BaseModel):
    """Search result facets for filtering UI."""
    tiers: Dict[str, int]
    ratings: Dict[str, int]
    mime_types: Dict[str, int]
    event_types: Dict[str, int]
    people: Dict[str, int]
    tags: Dict[str, int]
    years: Dict[str, int]

class SearchResponse(BaseModel):
    """Search results response."""
    photos: List[Dict[str, Any]]
    total_count: int
    facets: SearchFacets
    search_time: float
    filters_applied: Dict[str, Any]

class SimilarPhotosResponse(BaseModel):
    """Similar photos response."""
    similar_photos: List[Dict[str, Any]]
    similarity_scores: List[float]
    search_time: float
    reference_photo: Dict[str, Any]


# Dependencies
async def get_search_service() -> AdvancedSearchService:
    """Get advanced search service instance."""
    return AdvancedSearchService()


@router.post("/photos/search", response_model=SearchResponse)
async def advanced_photo_search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Advanced photo search with filters, facets, and sorting.
    
    Supports complex filtering, full-text search, and faceted navigation.
    """
    try:
        import time
        start_time = time.time()
        
        # Prepare search parameters
        search_params = {
            "filters": request.filters.dict() if request.filters else {},
            "sort": request.sort.dict() if request.sort else {"field": "created_at", "direction": "desc"},
            "limit": request.limit,
            "offset": request.offset
        }
        
        # Execute search
        if request.filters and request.filters.query:
            # Full-text search with filters
            results = await search_service.search_photos_with_query(
                query=request.filters.query,
                filters=search_params["filters"],
                sort=search_params["sort"],
                limit=request.limit,
                offset=request.offset
            )
        else:
            # Filter-only search
            results = await search_service.search_photos_by_filters(
                filters=search_params["filters"],
                sort=search_params["sort"],
                limit=request.limit,
                offset=request.offset
            )
        
        # Generate facets for filtering UI
        facets = await search_service.generate_search_facets(
            base_filters=search_params["filters"]
        )
        
        search_time = time.time() - start_time
        
        return SearchResponse(
            photos=results["photos"],
            total_count=results["total_count"],
            facets=SearchFacets(**facets),
            search_time=search_time,
            filters_applied=search_params["filters"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/search")
async def simple_photo_search(
    q: Optional[str] = Query(None, description="Search query"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    people: Optional[str] = Query(None, description="Comma-separated people"),
    rating_min: Optional[int] = Query(None, description="Minimum rating", alias="ratingMin"),
    rating_max: Optional[int] = Query(None, description="Maximum rating", alias="ratingMax"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Simple photo search endpoint for basic queries.
    
    Provides a simpler interface for common search operations.
    """
    try:
        # Build filters from query parameters
        filters = {}
        
        if tier:
            filters["tier"] = tier
        if tags:
            filters["tags"] = [tag.strip() for tag in tags.split(",")]
        if people:
            filters["people"] = [person.strip() for person in people.split(",")]
        if rating_min is not None or rating_max is not None:
            filters["rating"] = {}
            if rating_min is not None:
                filters["rating"]["min"] = rating_min
            if rating_max is not None:
                filters["rating"]["max"] = rating_max
        
        # Execute search
        if q:
            results = await search_service.search_photos_with_query(
                query=q,
                filters=filters,
                limit=limit,
                offset=offset
            )
        else:
            results = await search_service.search_photos_by_filters(
                filters=filters,
                limit=limit,
                offset=offset
            )
        
        return {
            "photos": results["photos"],
            "total_count": results["total_count"],
            "query": q,
            "filters_applied": filters
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simple search failed: {str(e)}")


@router.get("/photos/{photo_id}/similar", response_model=SimilarPhotosResponse)
async def find_similar_photos(
    photo_id: str,
    threshold: float = Query(85, ge=50, le=99, description="Similarity threshold (50-99)"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Find photos similar to the given photo.
    
    Uses AI embeddings and metadata to find visually and semantically similar photos.
    """
    try:
        import time
        start_time = time.time()
        
        # Get reference photo
        reference_photo = await crud.get_file_version(photo_id)
        if not reference_photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        # Find similar photos
        similar_photos = await search_service.find_similar_photos(
            photo_id=photo_id,
            threshold=threshold / 100.0,  # Convert percentage to decimal
            limit=limit
        )
        
        search_time = time.time() - start_time
        
        # Extract similarity scores
        similarity_scores = [photo.get("similarity_score", 0) for photo in similar_photos]
        
        # Get media asset for reference photo
        media_asset = await crud.get_media_asset(reference_photo.media_asset_id)
        reference_photo_dict = reference_photo.dict()
        reference_photo_dict["media_asset"] = media_asset.dict() if media_asset else None
        
        return SimilarPhotosResponse(
            similar_photos=similar_photos,
            similarity_scores=similarity_scores,
            search_time=search_time,
            reference_photo=reference_photo_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find similar photos: {str(e)}")


@router.get("/search/suggestions")
async def get_search_suggestions(
    q: str = Query(..., description="Partial search query"),
    type: str = Query("all", description="Suggestion type: all, tags, people, locations"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Get search suggestions for auto-completion.
    
    Provides tag, people, and location suggestions based on partial queries.
    """
    try:
        suggestions = await search_service.get_search_suggestions(
            query=q,
            suggestion_type=type,
            limit=limit
        )
        
        return {
            "query": q,
            "suggestions": suggestions,
            "type": type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get suggestions: {str(e)}")


@router.get("/search/facets")
async def get_search_facets(
    filters: Optional[str] = Query(None, description="JSON string of current filters"),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Get search facets for filtering UI.
    
    Returns counts for different filter categories to build dynamic filtering interfaces.
    """
    try:
        import json
        
        # Parse filters if provided
        parsed_filters = {}
        if filters:
            try:
                parsed_filters = json.loads(filters)
            except json.JSONDecodeError:
                pass
        
        facets = await search_service.generate_search_facets(
            base_filters=parsed_filters
        )
        
        return SearchFacets(**facets)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get facets: {str(e)}")


@router.post("/search/save")
async def save_search(
    name: str = Body(..., description="Search name"),
    description: Optional[str] = Body(None, description="Search description"),
    filters: Dict[str, Any] = Body(..., description="Search filters"),
    sort: Optional[Dict[str, str]] = Body(None, description="Search sorting"),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """
    Save a search query as a smart collection.
    
    Converts search parameters into a smart collection for reuse.
    """
    try:
        # Convert search to smart collection rules
        smart_rules = {
            "rules": [],
            "operator": "AND"
        }
        
        # Convert filters to rules format
        for field, value in filters.items():
            if value is not None:
                if isinstance(value, list):
                    smart_rules["rules"].append({
                        "field": field,
                        "operator": "in",
                        "value": value
                    })
                elif isinstance(value, dict) and "min" in value:
                    smart_rules["rules"].append({
                        "field": field,
                        "operator": "between",
                        "value": [value.get("min"), value.get("max")]
                    })
                else:
                    smart_rules["rules"].append({
                        "field": field,
                        "operator": "equals",
                        "value": value
                    })
        
        # Create smart collection
        from app.models.schemas import InsertCollection
        collection_data = InsertCollection(
            name=name,
            description=description,
            is_smart_collection=True,
            smart_rules=smart_rules,
            is_public=True
        )
        
        collection = await crud.create_collection(collection_data)
        
        return {
            "success": True,
            "collection_id": collection.id,
            "message": f"Search saved as smart collection: {name}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save search: {str(e)}")


@router.get("/search/saved")
async def get_saved_searches(
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """
    Get saved searches (smart collections).
    
    Returns smart collections that represent saved search queries.
    """
    try:
        collections = await crud.get_collections()
        smart_collections = [c for c in collections if c.is_smart_collection]
        
        # Format as saved searches
        saved_searches = []
        for collection in smart_collections:
            saved_searches.append({
                "id": collection.id,
                "name": collection.name,
                "description": collection.description,
                "rules": collection.smart_rules,
                "is_active": collection.is_public,
                "created_at": collection.created_at.isoformat(),
                "updated_at": collection.updated_at.isoformat()
            })
        
        return saved_searches
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get saved searches: {str(e)}")


@router.delete("/search/saved/{search_id}")
async def delete_saved_search(
    search_id: str,
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Delete a saved search (smart collection)."""
    try:
        collection = await crud.get_collection(search_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        if not collection.is_smart_collection:
            raise HTTPException(status_code=400, detail="Not a saved search")
        
        await crud.delete_collection(search_id)
        
        return {
            "success": True,
            "message": "Saved search deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete saved search: {str(e)}")


@router.get("/photos/similarity")
async def analyze_photo_similarity(
    tier: str = Query("silver", description="Photo tier to analyze"),
    threshold: float = Query(0.85, ge=0.5, le=0.99),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Analyze photo similarity for review and organization.
    
    Groups photos by similarity for duplicate detection and organization.
    """
    try:
        photos = await crud.get_photos_by_tier(tier)
        
        # Find similar photo groups
        similar_groups = await search_service.find_similar_photo_groups(
            photos=photos,
            threshold=threshold
        )
        
        return {
            "groups": similar_groups,
            "total_photos": len(photos),
            "similar_groups": len(similar_groups),
            "threshold": threshold
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze similarity: {str(e)}")


@router.post("/collections/smart/update")
async def update_smart_collections(
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations),
    search_service: AdvancedSearchService = Depends(get_search_service)
):
    """
    Update all smart collections based on their rules.
    
    Re-evaluates smart collection rules and updates photo assignments.
    """
    try:
        updated_count = await search_service.update_smart_collections()
        
        return {
            "success": True,
            "updated_collections": updated_count,
            "message": "Smart collections updated successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update smart collections: {str(e)}")


# Tag-based search endpoints
@router.get("/tags/search")
async def search_tags(
    q: str = Query(..., description="Tag search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Search for tags matching the query."""
    try:
        # Get all tags from global tag library
        all_tags = await crud.get_tag_library()
        
        # Filter tags by query
        matching_tags = [
            tag for tag in all_tags 
            if q.lower() in tag["tag"].lower()
        ]
        
        # Sort by usage count and limit
        matching_tags.sort(key=lambda x: x["usage_count"], reverse=True)
        
        return {
            "query": q,
            "tags": matching_tags[:limit],
            "total_found": len(matching_tags)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search tags: {str(e)}")


@router.get("/photos/by-tag/{tag}")
async def get_photos_by_tag(
    tag: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    crud: CRUDOperations = Depends(CRUDOperations)
):
    """Get photos that have a specific tag."""
    try:
        photos = await crud.get_photos_by_tag(tag, limit=limit, offset=offset)
        
        # Enhance with media asset information
        enhanced_photos = []
        for photo in photos:
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            photo_dict = photo.dict()
            photo_dict["media_asset"] = media_asset.dict() if media_asset else None
            enhanced_photos.append(photo_dict)
        
        return {
            "tag": tag,
            "photos": enhanced_photos,
            "total_count": len(photos),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get photos by tag: {str(e)}")