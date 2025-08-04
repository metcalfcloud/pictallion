"""
Models Package

Contains all SQLModel data models for database tables and API schemas.
"""

# Import base classes
from .base import TimestampMixin, UUIDMixin
# Import all database models
from .media_asset import (AIPrompt, AssetHistory, Collection, CollectionPhoto,
                          Event, Face, FileVersion, GlobalTagLibrary, Location,
                          MediaAsset, Person, Relationship, Setting, User)
# Import schemas and types
from .schemas import (AICategoryEnum,  # Enums; Metadata types; Insert schemas
                      AIMetadata, AIProviderEnum, CombinedMetadata,
                      EventTypeEnum, ExifMetadata, InsertAIPrompt,
                      InsertAssetHistory, InsertCollection,
                      InsertCollectionPhoto, InsertEvent, InsertFace,
                      InsertFileVersion, InsertGlobalTagLibrary,
                      InsertLocation, InsertMediaAsset, InsertPerson,
                      InsertRelationship, InsertSetting, InsertUser,
                      ProcessingStateEnum, RecurringTypeEnum,
                      RelationshipTypeEnum, SmartCollectionRule,
                      SmartCollectionRules, TierEnum)

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
    "InsertAIPrompt",
]
