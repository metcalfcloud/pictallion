"""
Models Package

Contains all SQLModel data models for database tables and API schemas.
"""

# Import base classes
from .base import UUIDMixin, TimestampMixin

# Import all database models
from .media_asset import (
    User,
    MediaAsset,
    FileVersion,
    AssetHistory,
    Collection,
    CollectionPhoto,
    Person,
    Face,
    Setting,
    AIPrompt,
    Event,
    GlobalTagLibrary,
    Relationship,
    Location
)

# Import schemas and types
from .schemas import (
    # Enums
    TierEnum,
    ProcessingStateEnum,
    EventTypeEnum,
    RecurringTypeEnum,
    AIProviderEnum,
    AICategoryEnum,
    RelationshipTypeEnum,
    
    # Metadata types
    AIMetadata,
    ExifMetadata,
    CombinedMetadata,
    SmartCollectionRule,
    SmartCollectionRules,
    
    # Insert schemas
    InsertUser,
    InsertMediaAsset,
    InsertFileVersion,
    InsertAssetHistory,
    InsertCollection,
    InsertCollectionPhoto,
    InsertPerson,
    InsertFace,
    InsertSetting,
    InsertEvent,
    InsertGlobalTagLibrary,
    InsertRelationship,
    InsertLocation,
    InsertAIPrompt
)

# Export all models for easy importing
__all__ = [
    # Base classes
    "UUIDMixin",
    "TimestampMixin",
    
    # Database models
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
    
    # Enums
    "TierEnum",
    "ProcessingStateEnum",
    "EventTypeEnum",
    "RecurringTypeEnum",
    "AIProviderEnum",
    "AICategoryEnum",
    "RelationshipTypeEnum",
    
    # Metadata types
    "AIMetadata",
    "ExifMetadata",
    "CombinedMetadata",
    "SmartCollectionRule",
    "SmartCollectionRules",
    
    # Insert schemas
    "InsertUser",
    "InsertMediaAsset",
    "InsertFileVersion",
    "InsertAssetHistory",
    "InsertCollection",
    "InsertCollectionPhoto",
    "InsertPerson",
    "InsertFace",
    "InsertSetting",
    "InsertEvent",
    "InsertGlobalTagLibrary",
    "InsertRelationship",
    "InsertLocation",
    "InsertAIPrompt"
]