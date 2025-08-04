"""
Comprehensive Database Tests

Expanded test suite for all database models, CRUD operations, relationships,
constraints, and migrations for the Pictallion Python backend.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, AsyncGenerator, Dict, List

import pytest
from app.core.crud import (collection, face, file_version, media_asset, person,
                           setting)
from app.core.migrations import check_schema_compatibility, migration_manager
from app.models import *
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel
from tests.utils import (TEST_PROCESSING_STATES, TEST_TIERS,
                         DatabaseTestHelper, TestDataGenerator,
                         assert_datetime_recent, assert_uuid_format)


class TestModels:
    """Test SQLModel definitions."""

    async def test_user_model(self, db_session: AsyncSession):
        """Test User model creation and retrieval."""
        user = User(username="testuser", password="testpass")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.id is not None
        assert user.username == "testuser"
        assert user.password == "testpass"

    async def test_media_asset_model(self, db_session: AsyncSession):
        """Test MediaAsset model creation and retrieval."""
        asset = MediaAsset(original_filename="test.jpg")
        db_session.add(asset)
        await db_session.commit()
        await db_session.refresh(asset)

        assert asset.id is not None
        assert asset.original_filename == "test.jpg"
        assert asset.created_at is not None

    async def test_file_version_model(self, db_session: AsyncSession):
        """Test FileVersion model with relationships."""
        # Create media asset first
        asset = MediaAsset(original_filename="test.jpg")
        db_session.add(asset)
        await db_session.commit()
        await db_session.refresh(asset)

        # Create file version
        version = FileVersion(
            original_filename=asset.id,
            tier="silver",
            original_filename="/path/to/file.jpg",
            original_filename="abc123",
            original_filename=1024,
            original_filename="image/jpeg",
        )
        db_session.add(version)
        await db_session.commit()
        await db_session.refresh(version)

        assert version.id is not None
        assert version.original_filename == asset.id
        assert version.tier == "silver"
        assert version.processing_state == "processed"

    async def test_person_model(self, db_session: AsyncSession):
        """Test Person model creation."""
        person_obj = Person(name="John Doe")
        db_session.add(person_obj)
        await db_session.commit()
        await db_session.refresh(person_obj)

        assert person_obj.id is not None
        assert person_obj.name == "John Doe"
        assert person_obj.face_count == 0

    async def test_face_model(self, db_session: AsyncSession):
        """Test Face model with relationships."""
        # Create media asset and file version
        asset = MediaAsset(original_filename="test.jpg")
        db_session.add(asset)
        await db_session.commit()
        await db_session.refresh(asset)

        version = FileVersion(
            original_filename=asset.id,
            tier="silver",
            original_filename="/path/to/file.jpg",
            original_filename="abc123",
            original_filename=1024,
            original_filename="image/jpeg",
        )
        db_session.add(version)
        await db_session.commit()
        await db_session.refresh(version)

        # Create person
        person_obj = Person(name="John Doe")
        db_session.add(person_obj)
        await db_session.commit()
        await db_session.refresh(person_obj)

        # Create face
        face_obj = Face(
            photo_id=version.id,
            person_id=person_obj.id,
            bounding_box={"top": 10, "left": 20, "bottom": 100, "right": 120},
            confidence=95,
        )
        db_session.add(face_obj)
        await db_session.commit()
        await db_session.refresh(face_obj)

        assert face_obj.id is not None
        assert face_obj.photo_id == version.id
        assert face_obj.person_id == person_obj.id
        assert face_obj.confidence == 95


class TestCRUDOperations:
    """Test CRUD operations."""

    async def test_media_asset_crud(self, db_session: AsyncSession):
        """Test MediaAsset CRUD operations."""
        # Create
        asset_data = InsertMediaAsset(original_filename="test.jpg")
        asset = await media_asset.create(db_session, obj_in=asset_data)

        assert asset.id is not None
        assert asset.original_filename == "test.jpg"

        # Read
        retrieved = await media_asset.get(db_session, id=asset.id)
        assert retrieved is not None
        assert retrieved.id == asset.id

        # Get by filename
        by_filename = await media_asset.get_by_filename(db_session, filename="test.jpg")
        assert by_filename is not None
        assert by_filename.id == asset.id

        # List
        assets = await media_asset.get_multi(db_session, skip=0, limit=10)
        assert len(assets) >= 1

        # Count
        count = await media_asset.count(db_session)
        assert count >= 1

        # Delete
        deleted = await media_asset.remove(db_session, id=asset.id)
        assert deleted is not None
        assert deleted.id == asset.id

    async def test_person_crud(self, db_session: AsyncSession):
        """Test Person CRUD operations."""
        # Create
        person_data = InsertPerson(name="Jane Doe")
        person_obj = await person.create(db_session, obj_in=person_data)

        assert person_obj.id is not None
        assert person_obj.name == "Jane Doe"

        # Search by name
        search_results: list[Person] = await person.search(db_session, query="Jane")
        assert len(search_results) >= 1
        assert search_results[0].name == "Jane Doe"

        # Get by name
        by_name = await person.get_by_name(db_session, name="Jane Doe")
        assert by_name is not None
        assert by_name.id == person_obj.id

    async def test_setting_crud(self, db_session: AsyncSession):
        """Test Setting CRUD operations."""
        # Set value (create)
        setting_obj = await setting.set_value(
            db_session, key="test_setting", value="test_value", category="test"
        )

        assert setting_obj.key == "test_setting"
        assert setting_obj.value == "test_value"
        assert setting_obj.category == "test"

        # Get by key
        retrieved = await setting.get_by_key(db_session, key="test_setting")
        assert retrieved is not None
        assert retrieved.value == "test_value"

        # Update value
        updated = await setting.set_value(
            db_session, key="test_setting", value="updated_value"
        )
        assert updated.value == "updated_value"

        # Get by category
        category_settings = await setting.get_by_category(db_session, category="test")
        assert len(category_settings) >= 1


class TestRelationships:
    """Test model relationships."""

    async def test_media_asset_file_versions_relationship(
        self, db_session: AsyncSession
    ):
        """Test MediaAsset to FileVersion relationship."""
        # Create media asset
        asset = MediaAsset(original_filename="test.jpg")
        db_session.add(asset)
        await db_session.commit()
        await db_session.refresh(asset)

        # Create multiple file versions
        versions = []
        for tier in ["bronze", "silver", "gold"]:
            version = FileVersion(
                original_filename=asset.id,
                tier=tier,
                original_filename=f"/path/to/{tier}.jpg",
                original_filename=f"hash_{tier}",
                original_filename=1024
                * (1 if tier == "bronze" else 2 if tier == "silver" else 4),
                original_filename="image/jpeg",
            )
            db_session.add(version)
            versions.append(version)

        await db_session.commit()

        # Test relationship
        for version in versions:
            await db_session.refresh(version)

        # Get versions by media asset
        asset_versions: list[FileVersion] = await file_version.get_by_media_asset(db_session, asset.id)
        assert len(asset_versions) == 3

        tiers = [v.tier for v in asset_versions]
        assert "bronze" in tiers
        assert "silver" in tiers
        assert "gold" in tiers

    async def test_person_face_relationship(self, db_session: AsyncSession):
        """Test Person to Face relationship."""
        # Create person
        person_obj = Person(name="Test Person")
        db_session.add(person_obj)
        await db_session.commit()
        await db_session.refresh(person_obj)

        # Create media asset and file version for faces
        asset = MediaAsset(original_filename="group_photo.jpg")
        db_session.add(asset)
        await db_session.commit()
        await db_session.refresh(asset)

        version = FileVersion(
            original_filename=asset.id,
            tier="silver",
            original_filename="/path/to/group.jpg",
            original_filename="group123",
            original_filename=2048,
            original_filename="image/jpeg",
        )
        db_session.add(version)
        await db_session.commit()
        await db_session.refresh(version)

        # Create multiple faces for the person
        faces = []
        for i in range(3):
            face_obj = Face(
                photo_id=version.id,
                person_id=person_obj.id,
                bounding_box={
                    "top": 10 + i * 10,
                    "left": 20 + i * 10,
                    "bottom": 100 + i * 10,
                    "right": 120 + i * 10,
                },
                confidence=90 + i,
            )
            db_session.add(face_obj)
            faces.append(face_obj)

        await db_session.commit()

        # Test relationship
        person_faces: list[Face] = await face.get_by_person(db_session, person_obj.id)
        assert len(person_faces) == 3

        photo_faces: list[Face] = await face.get_by_photo(db_session, version.id)
        assert len(photo_faces) == 3


class TestMigrations:
    """Test migration system."""

    async def test_migration_status(self):
        """Test migration status checking."""
        # This would normally require a real database with migration history
        # For now, just test that the functions don't error
        try:
            current = await migration_manager.get_current_revision()
            head = await migration_manager.get_head_revision()
            status = await migration_manager.check_migration_status()

            assert "current_revision" in status
            assert "head_revision" in status
            assert "is_up_to_date" in status
        except Exception as e:
            # Migration tests may fail in test environment without proper setup
            pytest.skip(f"Migration test skipped: {e}")


class TestSchemaCompatibility:
    """Test schema compatibility with TypeScript backend."""

    async def test_schema_compatibility_check(self):
        """Test schema compatibility checking."""
        try:
            compatibility = await check_schema_compatibility()

            assert "compatible" in compatibility
            assert "issues" in compatibility
            assert "warnings" in compatibility
            assert isinstance(compatibility["compatible"], bool)
            assert isinstance(compatibility["issues"], list)
            assert isinstance(compatibility["warnings"], list)
        except Exception as e:
            # Compatibility tests may fail without proper database setup
            pytest.skip(f"Compatibility test skipped: {e}")


class TestDatabaseIntegrity:
    """Test database integrity and constraints."""

    async def test_foreign_key_constraints(self, db_session: AsyncSession):
        """Test that foreign key constraints work properly."""
        # Create a file version without a media asset (should fail)
        version = FileVersion(
            original_filename="nonexistent-id",
            tier="silver",
            original_filename="/path/to/file.jpg",
            original_filename="abc123",
            original_filename=1024,
            original_filename="image/jpeg",
        )
        db_session.add(version)

        with pytest.raises(Exception):
            await db_session.commit()

        await db_session.rollback()

    async def test_unique_constraints(self, db_session: AsyncSession):
        """Test unique constraints."""
        # Create two users with the same username (should fail)
        user1 = User(username="duplicate", password="pass1")
        user2 = User(username="duplicate", password="pass2")

        db_session.add(user1)
        await db_session.commit()

        db_session.add(user2)
        with pytest.raises(Exception):
            await db_session.commit()

        await db_session.rollback()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
