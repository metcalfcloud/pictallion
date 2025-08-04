"""
CRUD Operations

Base CRUD operations and repository patterns for database models.
Provides common operations for all models with proper async support.
"""

from typing import Generic, TypeVar, Type, Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlmodel import SQLModel

ModelType = TypeVar("ModelType", bound=SQLModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=SQLModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=SQLModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base CRUD operations class."""
    
    def __init__(self, model: Type[ModelType]):
        self.model = model
    
    async def get(self, db: AsyncSession, id: str) -> Optional[ModelType]:
        """Get a single record by ID."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()
    
    async def get_multi(
        self, 
        db: AsyncSession, 
        *, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records with pagination."""
        result = await db.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record."""
        obj_data = obj_in.dict()
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | Dict[str, Any]
    ) -> ModelType:
        """Update an existing record."""
        obj_data = db_obj.dict()
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def remove(self, db: AsyncSession, *, id: str) -> ModelType:
        """Delete a record by ID."""
        obj = await self.get(db, id=id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj
    
    async def count(self, db: AsyncSession) -> int:
        """Count total records."""
        result = await db.execute(select(func.count(self.model.id)))
        return result.scalar()
    
    async def exists(self, db: AsyncSession, id: str) -> bool:
        """Check if record exists."""
        result = await db.execute(
            select(func.count(self.model.id)).where(self.model.id == id)
        )
        return result.scalar() > 0


class MediaAssetCRUD(CRUDBase):
    """CRUD operations for MediaAsset model."""
    
    async def get_by_filename(
        self, 
        db: AsyncSession, 
        filename: str
    ) -> Optional[ModelType]:
        """Get media asset by original filename."""
        result = await db.execute(
            select(self.model).where(self.model.original_filename == filename)
        )
        return result.scalar_one_or_none()
    
    async def get_recent(
        self, 
        db: AsyncSession, 
        limit: int = 50
    ) -> List[ModelType]:
        """Get recently created media assets."""
        result = await db.execute(
            select(self.model)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()


class FileVersionCRUD(CRUDBase):
    """CRUD operations for FileVersion model."""
    
    async def get_by_media_asset(
        self, 
        db: AsyncSession, 
        media_asset_id: str
    ) -> List[ModelType]:
        """Get all file versions for a media asset."""
        result = await db.execute(
            select(self.model).where(self.model.media_asset_id == media_asset_id)
        )
        return result.scalars().all()
    
    async def get_by_tier(
        self, 
        db: AsyncSession, 
        tier: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get file versions by tier."""
        result = await db.execute(
            select(self.model)
            .where(self.model.tier == tier)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def get_by_hash(
        self, 
        db: AsyncSession, 
        file_hash: str
    ) -> Optional[ModelType]:
        """Get file version by hash (for duplicate detection)."""
        result = await db.execute(
            select(self.model).where(self.model.file_hash == file_hash)
        )
        return result.scalar_one_or_none()


class PersonCRUD(CRUDBase):
    """CRUD operations for Person model."""

    async def get_people(self, db: AsyncSession, limit: int = 100) -> List[ModelType]:
        """Stub: Get all people."""
        result = await db.execute(
            select(self.model).limit(limit)
        )
        return result.scalars().all()
    
    async def get_by_name(
        self,
        db: AsyncSession,
        name: str
    ) -> Optional[ModelType]:
        """Get person by name."""
        result = await db.execute(
            select(self.model).where(self.model.name == name)
        )
        return result.scalar_one_or_none()
    
    async def search_by_name(
        self,
        db: AsyncSession,
        name_query: str,
        limit: int = 10
    ) -> List[ModelType]:
        """Search people by name (partial match)."""
        result = await db.execute(
            select(self.model)
            .where(self.model.name.ilike(f"%{name_query}%"))
            .limit(limit)
        )
        return result.scalars().all()


class FaceCRUD(CRUDBase):
    """CRUD operations for Face model."""
    
    async def get_by_person(
        self, 
        db: AsyncSession, 
        person_id: str
    ) -> List[ModelType]:
        """Get all faces for a person."""
        result = await db.execute(
            select(self.model).where(self.model.person_id == person_id)
        )
        return result.scalars().all()
    
    async def get_by_photo(
        self, 
        db: AsyncSession, 
        photo_id: str
    ) -> List[ModelType]:
        """Get all faces in a photo."""
        result = await db.execute(
            select(self.model).where(self.model.photo_id == photo_id)
        )
        return result.scalars().all()
    
    async def get_unassigned(
        self, 
        db: AsyncSession,
        limit: int = 100
    ) -> List[ModelType]:
        """Get faces not assigned to any person."""
        result = await db.execute(
            select(self.model)
            .where(self.model.person_id.is_(None))
            .where(self.model.ignored == False)
            .limit(limit)
        )
        return result.scalars().all()


class CollectionCRUD(CRUDBase):
    """CRUD operations for Collection model."""
    
    async def get_by_name(
        self, 
        db: AsyncSession, 
        name: str
    ) -> Optional[ModelType]:
        """Get collection by name."""
        result = await db.execute(
            select(self.model).where(self.model.name == name)
        )
        return result.scalar_one_or_none()
    
    async def get_smart_collections(
        self, 
        db: AsyncSession
    ) -> List[ModelType]:
        """Get all smart collections."""
        result = await db.execute(
            select(self.model).where(self.model.is_smart_collection == True)
        )
        return result.scalars().all()


class SettingCRUD(CRUDBase):
    """CRUD operations for Setting model."""
    
    async def get_by_key(
        self, 
        db: AsyncSession, 
        key: str
    ) -> Optional[ModelType]:
        """Get setting by key."""
        result = await db.execute(
            select(self.model).where(self.model.key == key)
        )
        return result.scalar_one_or_none()
    
    async def get_by_category(
        self, 
        db: AsyncSession, 
        category: str
    ) -> List[ModelType]:
        """Get all settings in a category."""
        result = await db.execute(
            select(self.model).where(self.model.category == category)
        )
        return result.scalars().all()
    
    async def set_value(
        self, 
        db: AsyncSession, 
        key: str, 
        value: str,
        category: str = "general"
    ) -> ModelType:
        """Set a setting value (create or update)."""
        existing = await self.get_by_key(db, key)
        if existing:
            existing.value = value
            db.add(existing)
            await db.commit()
            await db.refresh(existing)
            return existing
        else:
            from app.models import Setting
            new_setting = Setting(
                key=key,
                value=value,
                category=category
            )
            db.add(new_setting)
            await db.commit()
            await db.refresh(new_setting)
            return new_setting


# Initialize CRUD instances
from app.models import (
    MediaAsset, FileVersion, Person, Face, Collection, Setting,
    InsertMediaAsset, InsertFileVersion, InsertPerson, InsertFace,
    InsertCollection, InsertSetting
)

media_asset = MediaAssetCRUD(MediaAsset)
file_version = FileVersionCRUD(FileVersion)
person = PersonCRUD(Person)
face = FaceCRUD(Face)
collection = CollectionCRUD(Collection)
setting = SettingCRUD(Setting)
# Stub for event CRUD to resolve import error
event = None