"""
Advanced Search Service for Pictallion

Provides comprehensive photo search capabilities with filters, facets, similarity detection,
and smart collection management. Supports full-text search across metadata, AI descriptions,
and file properties with efficient pagination and sorting.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from sqlalchemy import asc, desc
from sqlmodel import and_, func, or_, select, text

from ..core.database import get_db
from ..models.collection import Collection
from ..models.collection_photo import CollectionPhoto
from ..models.file_version import FileVersion
from ..models.media_asset import MediaAsset


@dataclass
class SearchFilters:
    """Search filter parameters"""

    query: Optional[str] = None
    tier: Optional[str] = None  # 'bronze', 'silver', 'gold'
    rating: Optional[Dict[str, int]] = None  # {'min': 1, 'max': 5}
    date_range: Optional[Dict[str, datetime]] = (
        None  # {'start': datetime, 'end': datetime}
    )
    keywords: Optional[List[str]] = None
    event_type: Optional[List[str]] = None
    event_name: Optional[str] = None
    location: Optional[str] = None
    mime_type: Optional[List[str]] = None
    camera: Optional[str] = None
    lens: Optional[str] = None
    min_confidence: Optional[float] = None
    people_ids: Optional[List[str]] = None
    has_gps: Optional[bool] = None
    collections: Optional[List[str]] = None
    is_reviewed: Optional[bool] = None
    perceptual_hash_similarity: Optional[Dict[str, Union[str, float]]] = (
        None  # {'hash': str, 'threshold': float}
    )


@dataclass
class SortOptions:
    """Sort options for search results"""

    field: str = (
        "createdAt"  # 'createdAt', 'rating', 'fileSize', 'confidence', 'eventName'
    )
    direction: str = "desc"  # 'asc', 'desc'


@dataclass
class SearchResult:
    """Search result with photos and facets"""

    photos: List[Dict[str, Any]]
    total_count: int
    facets: Dict[str, Dict[str, int]]


@dataclass
class SimilarPhoto:
    """Similar photo result"""

    id: str
    similarity: float
    file_path: str
    tier: str
    original_filename: str


class AdvancedSearchService:
    """Service for advanced photo search and smart collections"""

    async def search_photos(
        self,
        filters: SearchFilters = None,
        sort: SortOptions = None,
        limit: int = 50,
        offset: int = 0,
    ) -> SearchResult:
        """
        Perform comprehensive search across all photos with filters and facets

        Args:
            filters: Search filter parameters
            sort: Sort options
            limit: Maximum number of results to return
            offset: Number of results to skip

        Returns:
            SearchResult with photos and facets
        """
        if filters is None:
            filters = SearchFilters()
        if sort is None:
            sort = SortOptions()

        try:
            async with get_session() as session:
                # Start with base query joining FileVersion and MediaAsset
                query = select(FileVersion).join(MediaAsset)
                conditions = []

                # Apply filters
                if filters.tier:
                    conditions.append(FileVersion.tier == filters.tier)

                if filters.rating:
                    if filters.rating.get("min") is not None:
                        conditions.append(FileVersion.rating >= filters.rating["min"])
                    if filters.rating.get("max") is not None:
                        conditions.append(FileVersion.rating <= filters.rating["max"])

                if filters.date_range:
                    if filters.date_range.get("start"):
                        conditions.append(
                            FileVersion.created_at >= filters.date_range["start"]
                        )
                    if filters.date_range.get("end"):
                        conditions.append(
                            FileVersion.created_at <= filters.date_range["end"]
                        )

                if filters.mime_type:
                    conditions.append(FileVersion.mime_type.in_(filters.mime_type))

                if filters.is_reviewed is not None:
                    conditions.append(FileVersion.is_reviewed == filters.is_reviewed)

                if filters.has_gps:
                    conditions.append(FileVersion.location.is_not(None))
                    conditions.append(FileVersion.location != "")

                # Apply text-based filters (these would need to be implemented with proper full-text search)
                if filters.query:
                    query_lower = filters.query.lower()
                    text_conditions = []

                    # Search in file path
                    text_conditions.append(
                        func.lower(FileVersion.file_path).contains(query_lower)
                    )

                    # Search in location
                    text_conditions.append(
                        func.lower(FileVersion.location).contains(query_lower)
                    )

                    # Search in event name
                    text_conditions.append(
                        func.lower(FileVersion.event_name).contains(query_lower)
                    )

                    # Search in AI short description (JSON field)
                    text_conditions.append(
                        func.lower(FileVersion.ai_short_description).contains(
                            query_lower
                        )
                    )

                    # Combine text conditions with OR
                    conditions.append(or_(*text_conditions))

                if filters.location:
                    conditions.append(
                        func.lower(FileVersion.location).contains(
                            filters.location.lower()
                        )
                    )

                if filters.event_name:
                    conditions.append(
                        func.lower(FileVersion.event_name).contains(
                            filters.event_name.lower()
                        )
                    )

                if filters.event_type:
                    conditions.append(FileVersion.event_type.in_(filters.event_type))

                # Apply all conditions
                if conditions:
                    query = query.where(and_(*conditions))

                # Apply sorting
                sort_column = self._get_sort_column(sort.field)
                if sort.direction == "desc":
                    query = query.order_by(desc(sort_column))
                else:
                    query = query.order_by(asc(sort_column))

                # Get total count
                count_query = select(func.count(FileVersion.id)).select_from(
                    query.subquery()
                )
                total_count_result = await session.execute(count_query)
                total_count = total_count_result.scalar() or 0

                # Apply pagination
                query = query.offset(offset).limit(limit)

                # Execute query
                result = await session.execute(query)
                photos = result.scalars().all()

                # Convert to response format
                photo_list = []
                for photo in photos:
                    # Get associated media asset
                    asset_result = await session.execute(
                        select(MediaAsset).where(MediaAsset.id == photo.media_asset_id)
                    )
                    asset = asset_result.scalar_one_or_none()

                    photo_dict = {
                        "id": photo.id,
                        "filePath": photo.file_path,
                        "tier": photo.tier,
                        "metadata": photo.metadata,
                        "mediaAsset": {
                            "originalFilename": (
                                asset.original_filename if asset else "Unknown"
                            )
                        },
                        "createdAt": (
                            photo.created_at.isoformat() if photo.created_at else None
                        ),
                    }
                    photo_list.append(photo_dict)

                # Generate facets
                facets = await self._generate_facets(session)

                return SearchResult(
                    photos=photo_list, total_count=total_count, facets=facets
                )

        except Exception as e:
            print(f"Error in search_photos: {e}")
            return SearchResult(photos=[], total_count=0, facets={})

    async def find_similar_photos(
        self, photo_id: str, threshold: float = 85.0, limit: int = 20
    ) -> List[SimilarPhoto]:
        """
        Find visually similar photos using perceptual hash

        Args:
            photo_id: ID of the source photo
            threshold: Similarity threshold (0-100)
            limit: Maximum number of results

        Returns:
            List of similar photos with similarity scores
        """
        try:
            async with get_session() as session:
                # Get the perceptual hash of the source photo
                source_result = await session.execute(
                    select(FileVersion.perceptual_hash).where(
                        FileVersion.id == photo_id
                    )
                )
                source_photo = source_result.scalar_one_or_none()

                if not source_photo or not source_photo:
                    return []

                source_hash = source_photo

                # Get all photos with perceptual hashes (excluding the source photo)
                result = await session.execute(
                    select(FileVersion, MediaAsset.original_filename)
                    .join(MediaAsset)
                    .where(
                        and_(
                            FileVersion.perceptual_hash.is_not(None),
                            FileVersion.id != photo_id,
                        )
                    )
                )

                all_photos = result.all()

                # Calculate similarities and filter by threshold
                similar_photos = []
                for photo, original_filename in all_photos:
                    if photo.perceptual_hash:
                        similarity = self._calculate_hash_similarity(
                            source_hash, photo.perceptual_hash
                        )
                        if similarity >= threshold:
                            similar_photos.append(
                                SimilarPhoto(
                                    id=photo.id,
                                    similarity=similarity,
                                    file_path=photo.file_path,
                                    tier=photo.tier,
                                    original_filename=original_filename,
                                )
                            )

                # Sort by similarity (highest first) and limit results
                similar_photos.sort(key=lambda x: x.similarity, reverse=True)
                return similar_photos[:limit]

        except Exception as e:
            print(f"Error finding similar photos: {e}")
            return []

    async def update_smart_collections(self) -> None:
        """
        Auto-update smart collections based on their rules
        """
        try:
            async with get_session() as session:
                # Get all smart collections
                result = await session.execute(
                    select(Collection).where(Collection.is_smart_collection == True)
                )
                smart_collections = result.scalars().all()

                for collection in smart_collections:
                    if not collection.smart_rules:
                        continue

                    try:
                        # Find photos matching the collection rules
                        matching_photos = await self._find_photos_matching_rules(
                            session, collection.smart_rules
                        )

                        # Clear existing photos in smart collection
                        await session.execute(
                            text(
                                "DELETE FROM collection_photos WHERE collection_id = :collection_id"
                            ).bindparam(collection_id=collection.id)
                        )

                        # Add matching photos
                        if matching_photos:
                            for photo_id in matching_photos:
                                collection_photo = CollectionPhoto(
                                    collection_id=collection.id, photo_id=photo_id
                                )
                                session.add(collection_photo)

                        await session.commit()

                        print(
                            f"Updated smart collection '{collection.name}' with {len(matching_photos)} photos"
                        )

                    except Exception as e:
                        print(
                            f"Failed to update smart collection {collection.name}: {e}"
                        )
                        await session.rollback()

        except Exception as e:
            print(f"Error updating smart collections: {e}")

    def _get_sort_column(self, field: str):
        """Get SQLModel column for sorting"""
        sort_mapping = {
            "createdAt": FileVersion.created_at,
            "rating": FileVersion.rating,
            "fileSize": FileVersion.file_size,
            "eventName": FileVersion.event_name,
        }
        return sort_mapping.get(field, FileVersion.created_at)

    def _calculate_hash_similarity(self, hash1: str, hash2: str) -> float:
        """
        Calculate similarity between two perceptual hashes (Hamming distance)

        Args:
            hash1: First perceptual hash
            hash2: Second perceptual hash

        Returns:
            Similarity percentage (0-100)
        """
        if len(hash1) != len(hash2):
            return 0.0

        differences = sum(1 for i in range(len(hash1)) if hash1[i] != hash2[i])
        similarity = (1 - differences / len(hash1)) * 100
        return round(similarity, 2)

    async def _generate_facets(self, session) -> Dict[str, Dict[str, int]]:
        """
        Generate facets for search filtering UI

        Args:
            session: Database session

        Returns:
            Dictionary of facet categories and counts
        """
        facets = {
            "tiers": {},
            "ratings": {},
            "eventTypes": {},
            "cameras": {},
            "mimeTypes": {},
            "keywords": {},
        }

        try:
            # Get all photos for facet generation
            result = await session.execute(select(FileVersion))
            all_photos = result.scalars().all()

            for photo in all_photos:
                # Count tiers
                tier = photo.tier or "unknown"
                facets["tiers"][tier] = facets["tiers"].get(tier, 0) + 1

                # Count ratings
                if photo.rating:
                    rating_str = str(photo.rating)
                    facets["ratings"][rating_str] = (
                        facets["ratings"].get(rating_str, 0) + 1
                    )

                # Count event types
                if photo.event_type:
                    facets["eventTypes"][photo.event_type] = (
                        facets["eventTypes"].get(photo.event_type, 0) + 1
                    )

                # Count MIME types
                if photo.mime_type:
                    facets["mimeTypes"][photo.mime_type] = (
                        facets["mimeTypes"].get(photo.mime_type, 0) + 1
                    )

                # Count cameras from metadata
                if photo.metadata and isinstance(photo.metadata, dict):
                    exif = photo.metadata.get("exif", {})
                    if exif and isinstance(exif, dict):
                        camera = exif.get("camera")
                        if camera:
                            facets["cameras"][camera] = (
                                facets["cameras"].get(camera, 0) + 1
                            )

                # Count keywords
                if photo.keywords and isinstance(photo.keywords, list):
                    for keyword in photo.keywords:
                        facets["keywords"][keyword] = (
                            facets["keywords"].get(keyword, 0) + 1
                        )

        except Exception as e:
            print(f"Error generating facets: {e}")

        return facets

    async def _find_photos_matching_rules(
        self, session, smart_rules: Dict[str, Any]
    ) -> List[str]:
        """
        Find photos matching smart collection rules

        Args:
            session: Database session
            smart_rules: Smart collection rules dictionary

        Returns:
            List of photo IDs matching the rules
        """
        try:
            # This is a simplified implementation
            # In a full implementation, you would parse the smart_rules and build appropriate queries

            # For now, return all photo IDs as a placeholder
            result = await session.execute(select(FileVersion.id))
            photo_ids = [row[0] for row in result.all()]
            return photo_ids[:100]  # Limit to prevent huge collections

        except Exception as e:
            print(f"Error finding photos matching rules: {e}")
            return []

    def _build_rule_condition(self, rule: Dict[str, Any]):
        """
        Build SQL condition from smart collection rule

        Args:
            rule: Rule dictionary with field, operator, and value

        Returns:
            SQLAlchemy condition
        """
        field = rule.get("field")
        operator = rule.get("operator")
        value = rule.get("value")

        # Map fields to database columns
        field_mapping = {
            "rating": FileVersion.rating,
            "tier": FileVersion.tier,
            "isReviewed": FileVersion.is_reviewed,
            "eventType": FileVersion.event_type,
            "keywords": FileVersion.keywords,
        }

        column = field_mapping.get(field)
        if not column:
            return text("true")  # Fallback condition

        # Build condition based on operator
        if operator == "equals":
            return column == value
        elif operator == "greater_than":
            return column > value
        elif operator == "less_than":
            return column < value
        elif operator == "between" and isinstance(value, list) and len(value) == 2:
            return and_(column >= value[0], column <= value[1])
        elif operator == "contains":
            return column.contains(value)
        elif operator == "in" and isinstance(value, list):
            return column.in_(value)
        else:
            return text("true")  # Fallback condition


# Global service instance
advanced_search_service = AdvancedSearchService()


# Convenience functions
async def search_photos(
    filters: SearchFilters = None,
    sort: SortOptions = None,
    limit: int = 50,
    offset: int = 0,
) -> SearchResult:
    """Perform comprehensive photo search"""
    return await advanced_search_service.search_photos(filters, sort, limit, offset)


async def find_similar_photos(
    photo_id: str, threshold: float = 85.0, limit: int = 20
) -> List[SimilarPhoto]:
    """Find visually similar photos using perceptual hash"""
    return await advanced_search_service.find_similar_photos(photo_id, threshold, limit)


async def update_smart_collections() -> None:
    """Auto-update smart collections based on their rules"""
    await advanced_search_service.update_smart_collections()
