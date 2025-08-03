"""
Database Schemas and Types

Pydantic models for API schemas and metadata interfaces that match
the TypeScript schema definitions.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
from enum import Enum


# Enums matching TypeScript schema
class TierEnum(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"


class ProcessingStateEnum(str, Enum):
    PROCESSED = "processed"
    PROMOTED = "promoted"
    REJECTED = "rejected"


class EventTypeEnum(str, Enum):
    HOLIDAY = "holiday"
    BIRTHDAY = "birthday"
    CUSTOM = "custom"


class RecurringTypeEnum(str, Enum):
    YEARLY = "yearly"
    MONTHLY = "monthly"
    WEEKLY = "weekly"


class AIProviderEnum(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"
    BOTH = "both"


class AICategoryEnum(str, Enum):
    ANALYSIS = "analysis"
    NAMING = "naming"
    DESCRIPTION = "description"


class RelationshipTypeEnum(str, Enum):
    SPOUSE = "spouse"
    PARTNER = "partner"
    SIBLING = "sibling"
    PARENT = "parent"
    CHILD = "child"
    FRIEND = "friend"
    RELATIVE = "relative"


# Metadata interfaces matching TypeScript
class AIMetadata(BaseModel):
    """AI-generated metadata for photos."""
    ai_tags: List[str] = Field(default_factory=list, alias="aiTags")
    short_description: str = Field(alias="shortDescription")
    long_description: str = Field(alias="longDescription")
    detected_objects: List[Dict[str, Any]] = Field(default_factory=list, alias="detectedObjects")
    detected_faces: Optional[List[Dict[str, Any]]] = Field(default=None, alias="detectedFaces")
    detected_events: Optional[List[Dict[str, Any]]] = Field(default=None, alias="detectedEvents")
    place_name: Optional[str] = Field(default=None, alias="placeName")
    gps_coordinates: Optional[Dict[str, float]] = Field(default=None, alias="gpsCoordinates")
    perceptual_hash: Optional[str] = Field(default=None, alias="perceptualHash")
    ai_confidence_scores: Dict[str, float] = Field(default_factory=dict, alias="aiConfidenceScores")


class ExifMetadata(BaseModel):
    """EXIF metadata from photos."""
    camera: Optional[str] = None
    lens: Optional[str] = None
    aperture: Optional[str] = None
    shutter: Optional[str] = None
    iso: Optional[str] = None
    focal_length: Optional[str] = Field(default=None, alias="focalLength")
    date_time: Optional[str] = Field(default=None, alias="dateTime")
    date_taken: Optional[str] = Field(default=None, alias="dateTaken")
    date_time_original: Optional[str] = Field(default=None, alias="dateTimeOriginal")
    create_date: Optional[str] = Field(default=None, alias="createDate")
    modify_date: Optional[str] = Field(default=None, alias="modifyDate")
    gps_latitude: Optional[float] = Field(default=None, alias="gpsLatitude")
    gps_longitude: Optional[float] = Field(default=None, alias="gpsLongitude")
    software: Optional[str] = None
    flash: Optional[str] = None
    white_balance: Optional[str] = Field(default=None, alias="whiteBalance")
    exposure_mode: Optional[str] = Field(default=None, alias="exposureMode")
    metering_mode: Optional[str] = Field(default=None, alias="meteringMode")
    scene_type: Optional[str] = Field(default=None, alias="sceneType")
    color_space: Optional[str] = Field(default=None, alias="colorSpace")
    orientation: Optional[str] = None
    x_resolution: Optional[str] = Field(default=None, alias="xResolution")
    y_resolution: Optional[str] = Field(default=None, alias="yResolution")
    resolution_unit: Optional[str] = Field(default=None, alias="resolutionUnit")


class CombinedMetadata(BaseModel):
    """Combined EXIF and AI metadata."""
    exif: Optional[ExifMetadata] = None
    ai: Optional[AIMetadata] = None


# Smart Collection Rules
class SmartCollectionRule(BaseModel):
    """Rule for smart collections."""
    field: str
    operator: str  # equals, contains, greater_than, less_than, between, in
    value: Any


class SmartCollectionRules(BaseModel):
    """Rules configuration for smart collections."""
    rules: List[SmartCollectionRule]
    operator: str  # AND, OR


# Insert schemas for API endpoints
class InsertUser(BaseModel):
    """Schema for creating users."""
    username: str
    password: str


class InsertMediaAsset(BaseModel):
    """Schema for creating media assets."""
    original_filename: str = Field(alias="originalFilename")


class InsertFileVersion(BaseModel):
    """Schema for creating file versions."""
    media_asset_id: str = Field(alias="mediaAssetId")
    tier: TierEnum
    file_path: str = Field(alias="filePath")
    file_hash: str = Field(alias="fileHash")
    file_size: int = Field(alias="fileSize")
    mime_type: str = Field(alias="mimeType")
    metadata: Optional[CombinedMetadata] = None
    is_reviewed: bool = Field(default=False, alias="isReviewed")
    rating: int = Field(default=0, ge=0, le=5)
    keywords: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    event_type: Optional[str] = Field(default=None, alias="eventType")
    event_name: Optional[str] = Field(default=None, alias="eventName")
    perceptual_hash: Optional[str] = Field(default=None, alias="perceptualHash")
    ai_short_description: Optional[str] = Field(default=None, alias="aiShortDescription")
    processing_state: ProcessingStateEnum = Field(default=ProcessingStateEnum.PROCESSED, alias="processingState")


class InsertAssetHistory(BaseModel):
    """Schema for creating asset history."""
    media_asset_id: str = Field(alias="mediaAssetId")
    action: str
    details: Optional[str] = None


class InsertCollection(BaseModel):
    """Schema for creating collections."""
    name: str
    description: Optional[str] = None
    is_public: bool = Field(default=False, alias="isPublic")
    cover_photo: Optional[str] = Field(default=None, alias="coverPhoto")
    is_smart_collection: bool = Field(default=False, alias="isSmartCollection")
    smart_rules: Optional[SmartCollectionRules] = Field(default=None, alias="smartRules")


class InsertCollectionPhoto(BaseModel):
    """Schema for adding photos to collections."""
    collection_id: str = Field(alias="collectionId")
    photo_id: str = Field(alias="photoId")


class InsertPerson(BaseModel):
    """Schema for creating people."""
    name: str
    notes: Optional[str] = None
    birthdate: Optional[datetime] = None
    face_count: int = Field(default=0, alias="faceCount")
    representative_face: Optional[str] = Field(default=None, alias="representativeFace")
    selected_thumbnail_face_id: Optional[str] = Field(default=None, alias="selectedThumbnailFaceId")


class InsertFace(BaseModel):
    """Schema for creating faces."""
    photo_id: str = Field(alias="photoId")
    person_id: Optional[str] = Field(default=None, alias="personId")
    bounding_box: Dict[str, Any] = Field(alias="boundingBox")
    confidence: int = Field(ge=0, le=100)
    embedding: Optional[Dict[str, Any]] = None
    ignored: bool = Field(default=False)


class InsertSetting(BaseModel):
    """Schema for creating settings."""
    key: str
    value: str
    category: str = Field(default="general")
    description: Optional[str] = None


class InsertEvent(BaseModel):
    """Schema for creating events."""
    name: str
    type: EventTypeEnum
    date: datetime
    is_recurring: bool = Field(default=False, alias="isRecurring")
    recurring_type: Optional[RecurringTypeEnum] = Field(default=None, alias="recurringType")
    country: Optional[str] = None
    region: Optional[str] = None
    person_id: Optional[str] = Field(default=None, alias="personId")
    is_enabled: bool = Field(default=True, alias="isEnabled")
    description: Optional[str] = None


class InsertGlobalTagLibrary(BaseModel):
    """Schema for creating global tags."""
    tag: str
    usage_count: int = Field(default=1, alias="usageCount")


class InsertRelationship(BaseModel):
    """Schema for creating relationships."""
    person1_id: str = Field(alias="person1Id")
    person2_id: str = Field(alias="person2Id")
    relationship_type: RelationshipTypeEnum = Field(alias="relationshipType")
    notes: Optional[str] = None


class InsertLocation(BaseModel):
    """Schema for creating locations."""
    name: str
    description: Optional[str] = None
    latitude: str
    longitude: str
    radius: int = Field(default=100)
    is_user_defined: bool = Field(default=False, alias="isUserDefined")
    photo_count: int = Field(default=0, alias="photoCount")
    place_name: Optional[str] = Field(default=None, alias="placeName")
    place_type: Optional[str] = Field(default=None, alias="placeType")


class InsertAIPrompt(BaseModel):
    """Schema for creating AI prompts."""
    name: str
    description: Optional[str] = None
    category: AICategoryEnum
    provider: AIProviderEnum
    system_prompt: str = Field(alias="systemPrompt")
    user_prompt: str = Field(alias="userPrompt")
    is_default: bool = Field(default=False, alias="isDefault")
    is_active: bool = Field(default=True, alias="isActive")