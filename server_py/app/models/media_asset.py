"""
Media Asset Models

SQLModel definitions for media assets and related database tables.
Converted from TypeScript Drizzle schema to maintain 100% compatibility.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (ARRAY, JSON, TIMESTAMP, Boolean, Column, ForeignKey,
                        Integer, String, Text)
from sqlmodel import Field, Relationship, SQLModel

from .base import TimestampMixin, UUIDMixin


class User(UUIDMixin, SQLModel, table=True):
    """User authentication model."""

    __tablename__ = "users"

    username: str = Field(unique=True, index=True)
    password: str


class MediaAsset(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    Main media asset model representing photos and videos.
    Maps to media_assets table from TypeScript schema.
    """

    __tablename__ = "media_assets"

    original_filename: str = Field(alias="originalFilename")

    # Relationships
    file_versions: List["FileVersion"] = Relationship(back_populates="media_asset")  # type: ignore
    history: List["AssetHistory"] = Relationship(back_populates="media_asset")  # type: ignore


class FileVersion(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """
    File version model for multi-tier file management (Bronze/Silver/Gold).
    Maps to file_versions table from TypeScript schema.
    """

    __tablename__ = "file_versions"

    media_asset_id: str = Field(foreign_key="media_assets.id", alias="mediaAssetId")
    tier: str = Field(sa_column=Column(String, nullable=False))  # bronze, silver, gold
    file_path: str = Field(alias="filePath")
    file_hash: str = Field(alias="fileHash")
    file_size: int = Field(alias="fileSize")
    mime_type: str = Field(alias="mimeType")
    is_reviewed: bool = Field(default=False, alias="isReviewed")
    rating: int = Field(default=0)  # 0-5 star rating
    keywords: List[str] = Field(default_factory=list, sa_column=Column(ARRAY(String)))
    location: Optional[str] = None  # GPS coordinates or place name
    event_type: Optional[str] = Field(default=None, alias="eventType")
    event_name: Optional[str] = Field(default=None, alias="eventName")
    perceptual_hash: Optional[str] = Field(default=None, alias="perceptualHash")
    ai_short_description: Optional[str] = Field(
        default=None, alias="aiShortDescription"
    )
    processing_state: str = Field(
        default="processed", alias="processingState"
    )  # processed, promoted, rejected

    # Relationships
    media_asset: Optional["MediaAsset"] = Relationship(back_populates="file_versions")  # type: ignore
    faces: List["Face"] = Relationship(back_populates="photo")  # type: ignore
    collection_photos: List["CollectionPhoto"] = Relationship(back_populates="photo")  # type: ignore


class AssetHistory(UUIDMixin, SQLModel, table=True):
    """Asset history tracking model."""

    __tablename__ = "asset_history"

    media_asset_id: str = Field(foreign_key="media_assets.id", alias="mediaAssetId")
    action: str
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    media_asset: Optional["MediaAsset"] = Relationship(back_populates="history")  # type: ignore


class Collection(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Collections model for organizing photos."""

    __tablename__ = "collections"

    name: str
    description: Optional[str] = None
    is_public: bool = Field(default=False, alias="isPublic")
    cover_photo: Optional[str] = Field(default=None, alias="coverPhoto")
    is_smart_collection: bool = Field(default=False, alias="isSmartCollection")
    smart_rules: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON), alias="smartRules"
    )

    # Relationships
    photos: List["CollectionPhoto"] = Relationship(back_populates="collection")  # type: ignore


class CollectionPhoto(UUIDMixin, SQLModel, table=True):
    """Junction table for collection-photo relationships."""

    __tablename__ = "collection_photos"

    collection_id: str = Field(foreign_key="collections.id", alias="collectionId")
    photo_id: str = Field(foreign_key="file_versions.id", alias="photoId")
    added_at: datetime = Field(default_factory=datetime.utcnow, alias="addedAt")

    # Relationships
    collection: Optional["Collection"] = Relationship(back_populates="photos")  # type: ignore
    photo: Optional["FileVersion"] = Relationship(back_populates="collection_photos")  # type: ignore


class Person(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Person model for face recognition and people management."""

    __tablename__ = "people"

    name: str
    notes: Optional[str] = None
    birthdate: Optional[datetime] = None
    face_count: int = Field(default=0, alias="faceCount")
    representative_face: Optional[str] = Field(default=None, alias="representativeFace")
    selected_thumbnail_face_id: Optional[str] = Field(
        default=None, alias="selectedThumbnailFaceId"
    )

    # Relationships
    faces: List["Face"] = Relationship(back_populates="person")  # type: ignore
    events: List["Event"] = Relationship(back_populates="person")  # type: ignore
    relationships_as_person1: Any = Relationship(
        back_populates="person1",
        sa_relationship_kwargs={"foreign_keys": "Relationship.person1_id"},
    )
    relationships_as_person2: Any = Relationship(
        back_populates="person2",
        sa_relationship_kwargs={"foreign_keys": "Relationship.person2_id"},
    )


class Face(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Face detection and recognition model."""

    __tablename__ = "faces"

    photo_id: str = Field(foreign_key="file_versions.id", alias="photoId")
    person_id: Optional[str] = Field(
        default=None, foreign_key="people.id", alias="personId"
    )
    bounding_box: Dict[str, Any] = Field(sa_column=Column(JSON), alias="boundingBox")
    confidence: int  # 0-100
    embedding: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    ignored: bool = Field(default=False)

    # Relationships
    photo: Optional["FileVersion"] = Relationship(back_populates="faces")  # type: ignore
    person: Optional["Person"] = Relationship(back_populates="faces")  # type: ignore


class Setting(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Application settings model."""

    __tablename__ = "settings"

    key: str = Field(unique=True, index=True)
    value: str
    category: str = Field(default="general")
    description: Optional[str] = None


class AIPrompt(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """AI prompts configuration model."""

    __tablename__ = "ai_prompts"

    name: str
    description: Optional[str] = None
    category: str  # analysis, naming, description
    provider: str  # openai, ollama, both
    system_prompt: str = Field(alias="systemPrompt")
    user_prompt: str = Field(alias="userPrompt")
    is_default: bool = Field(default=False, alias="isDefault")
    is_active: bool = Field(default=True, alias="isActive")


class Event(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Events model for holidays, birthdays, and custom events."""

    __tablename__ = "events"

    name: str
    type: str  # holiday, birthday, custom
    date: datetime
    is_recurring: bool = Field(default=False, alias="isRecurring")
    recurring_type: Optional[str] = Field(
        default=None, alias="recurringType"
    )  # yearly, monthly, weekly
    country: Optional[str] = None
    region: Optional[str] = None
    person_id: Optional[str] = Field(
        default=None, foreign_key="people.id", alias="personId"
    )
    is_enabled: bool = Field(default=True, alias="isEnabled")
    description: Optional[str] = None

    # Only created_at, not updated_at for events
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    person: Optional["Person"] = Relationship(back_populates="events")  # type: ignore


class GlobalTagLibrary(UUIDMixin, SQLModel, table=True):
    """Global tag library for curated tags."""

    __tablename__ = "global_tag_library"

    tag: str = Field(unique=True, index=True)
    usage_count: int = Field(default=1, alias="usageCount")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Relationship(UUIDMixin, SQLModel, table=True):
    """Relationships between people."""

    __tablename__ = "relationships"

    person1_id: str = Field(foreign_key="people.id", alias="person1Id")
    person2_id: str = Field(foreign_key="people.id", alias="person2Id")
    relationship_type: str = Field(
        alias="relationshipType"
    )  # spouse, partner, sibling, parent, child, friend, relative
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    person1: Optional["Person"] = Relationship(
        back_populates="relationships_as_person1",
        sa_relationship_kwargs={"foreign_keys": "Relationship.person1_id"},
    )  # type: ignore
    person2: Optional["Person"] = Relationship(
        back_populates="relationships_as_person2",
        sa_relationship_kwargs={"foreign_keys": "Relationship.person2_id"},
    )  # type: ignore


class Location(UUIDMixin, TimestampMixin, SQLModel, table=True):
    """Locations model for photo location management."""

    __tablename__ = "locations"

    name: str
    description: Optional[str] = None
    latitude: str  # Store as text for precision
    longitude: str  # Store as text for precision
    radius: int = Field(default=100)  # Radius in meters
    is_user_defined: bool = Field(default=False, alias="isUserDefined")
    photo_count: int = Field(default=0, alias="photoCount")
    place_name: Optional[str] = Field(default=None, alias="placeName")
    place_type: Optional[str] = Field(default=None, alias="placeType")


# Export all models for easy importing
__all__ = [
    "User",
    "MediaAsset",
    "FileVersion",
    "AssetHistory",
    "Collection",
    "CollectionPhoto",
    "Person",
    "Face",
    "Setting",
    "AIPrompt",
    "Event",
    "GlobalTagLibrary",
    "Relationship",
    "Location",
]
