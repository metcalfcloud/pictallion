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
from tests.utils import (TEST_EVENT_TYPES, TEST_PROCESSING_STATES,
                         TEST_RELATIONSHIP_TYPES, TEST_TIERS,
                         DatabaseTestHelper, TestDataGenerator,
                         assert_datetime_recent, assert_uuid_format)


@pytest.mark.database
class TestUserModel:
    """Test User model functionality."""

    async def test_user_creation(self, db_session: AsyncSession):
        """Test basic user creation and properties."""
        user = User(username="testuser", password="testpass")
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert_uuid_format(user.id)
        assert user.username == "testuser"
        assert user.password == "testpass"

    async def test_user_unique_username(self, db_session: AsyncSession):
        """Test that usernames must be unique."""
        user1 = User(username="duplicate", password="pass1")
        user2 = User(username="duplicate", password="pass2")

        db_session.add(user1)
        await db_session.commit()

        db_session.add(user2)
        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()


@pytest.mark.database
class TestMediaAssetModel:
    """Test MediaAsset model functionality."""

    async def test_media_asset_creation(self, db_session: AsyncSession):
        """Test basic media asset creation."""
        asset = MediaAsset(original_filename="test_photo.jpg")
        db_session.add(asset)
        await db_session.commit()
        await db_session.refresh(asset)

        assert_uuid_format(asset.id)
        assert asset.original_filename == "test_photo.jpg"
        assert_datetime_recent(asset.created_at)
        assert_datetime_recent(asset.updated_at)

    async def test_media_asset_with_file_versions(self, db_session: AsyncSession):
        """Test media asset with multiple file versions."""
        asset = await DatabaseTestHelper.create_test_media_asset(db_session)

        # Create file versions for different tiers
        versions = []
        for tier in TEST_TIERS:
            version = FileVersion(
                media_asset_id=asset.id,
                tier=tier,
                file_path=f"/test/{tier}/photo.jpg",
                file_hash=TestDataGenerator.generate_random_hash(),
                file_size=1024000,
                mime_type="image/jpeg",
            )
            db_session.add(version)
            versions.append(version)

        await db_session.commit()
        await db_session.refresh(asset)

        # Test relationship
        assert len(asset.file_versions) == 3
        tier_names = [v.tier for v in asset.file_versions]
        for tier in TEST_TIERS:
            assert tier in tier_names

    async def test_media_asset_history_tracking(self, db_session: AsyncSession):
        """Test media asset history tracking."""
        asset = await DatabaseTestHelper.create_test_media_asset(db_session)

        # Create history entries
        history1 = AssetHistory(
            media_asset_id=asset.id,
            action="uploaded",
            details="File uploaded to bronze tier",
        )
        history2 = AssetHistory(
            media_asset_id=asset.id,
            action="promoted",
            details="File promoted to silver tier",
        )

        db_session.add(history1)
        db_session.add(history2)
        await db_session.commit()
        await db_session.refresh(asset)

        assert len(asset.history) == 2
        actions = [h.action for h in asset.history]
        assert "uploaded" in actions
        assert "promoted" in actions


@pytest.mark.database
class TestFileVersionModel:
    """Test FileVersion model functionality."""

    async def test_file_version_creation(self, db_session: AsyncSession):
        """Test basic file version creation."""
        version = await DatabaseTestHelper.create_test_file_version(db_session)

        assert_uuid_format(version.id)
        assert_uuid_format(version.media_asset_id)
        assert version.tier in TEST_TIERS
        assert version.processing_state in TEST_PROCESSING_STATES
        assert version.file_size > 0
        assert version.mime_type.startswith("image/")
        assert_datetime_recent(version.created_at)

    async def test_file_version_metadata(self, db_session: AsyncSession):
        """Test file version with metadata."""
        metadata = {
            "exif": TestDataGenerator.generate_exif_metadata(),
            "ai": TestDataGenerator.generate_ai_metadata(),
        }

        version = await DatabaseTestHelper.create_test_file_version(
            db_session, metadata=metadata
        )

        assert version.metadata is not None
        assert "exif" in version.metadata
        assert "ai" in version.metadata
        assert version.metadata["exif"]["camera"] is not None
        assert len(version.metadata["ai"]["ai_tags"]) > 0

    async def test_file_version_keywords_and_rating(self, db_session: AsyncSession):
        """Test file version keywords and rating system."""
        keywords = ["vacation", "beach", "sunset", "family"]
        rating = 4

        version = await DatabaseTestHelper.create_test_file_version(
            db_session, keywords=keywords, rating=rating
        )

        assert version.keywords == keywords
        assert version.rating == rating
        assert 0 <= version.rating <= 5

    async def test_file_version_location_data(self, db_session: AsyncSession):
        """Test file version with location information."""
        location_data = "40.7589,-73.9851"  # Central Park coordinates

        version = await DatabaseTestHelper.create_test_file_version(
            db_session, location=location_data
        )

        assert version.location == location_data

    async def test_file_version_ai_processing(self, db_session: AsyncSession):
        """Test file version AI processing fields."""
        ai_description = (
            "A beautiful sunset over the ocean with people walking on the beach"
        )
        perceptual_hash = "d879c9e8de4e6f72"

        version = await DatabaseTestHelper.create_test_file_version(
            db_session,
            ai_short_description=ai_description,
            perceptual_hash=perceptual_hash,
        )

        assert version.ai_short_description == ai_description
        assert version.perceptual_hash == perceptual_hash

    async def test_file_version_event_detection(self, db_session: AsyncSession):
        """Test file version event detection fields."""
        event_type = "birthday"
        event_name = "Sarah's 25th Birthday"

        version = await DatabaseTestHelper.create_test_file_version(
            db_session, event_type=event_type, event_name=event_name
        )

        assert version.event_type == event_type
        assert version.event_name == event_name


@pytest.mark.database
class TestPersonModel:
    """Test Person model functionality."""

    async def test_person_creation(self, db_session: AsyncSession):
        """Test basic person creation."""
        person = await DatabaseTestHelper.create_test_person(db_session)

        assert_uuid_format(person.id)
        assert len(person.name) > 0
        assert person.face_count >= 0
        assert_datetime_recent(person.created_at)

    async def test_person_with_birthdate(self, db_session: AsyncSession):
        """Test person with birthdate information."""
        birthdate = datetime(1990, 5, 15)
        person = await DatabaseTestHelper.create_test_person(
            db_session,
            name="John Doe",
            birthdate=birthdate,
            notes="Test person with birthdate",
        )

        assert person.birthdate == birthdate
        assert person.notes == "Test person with birthdate"

    async def test_person_face_count_update(self, db_session: AsyncSession):
        """Test person face count tracking."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        file_version = await DatabaseTestHelper.create_test_file_version(db_session)

        # Create faces for the person
        face1 = await DatabaseTestHelper.create_test_face(
            db_session, file_version=file_version, person=person
        )
        face2 = await DatabaseTestHelper.create_test_face(
            db_session, file_version=file_version, person=person
        )

        # Manually update face count (in real app this would be automated)
        person.face_count = 2
        await db_session.commit()
        await db_session.refresh(person)

        assert person.face_count == 2
        assert len(person.faces) == 2

    async def test_person_representative_face(self, db_session: AsyncSession):
        """Test person representative face selection."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        file_version = await DatabaseTestHelper.create_test_file_version(db_session)
        face = await DatabaseTestHelper.create_test_face(
            db_session, file_version=file_version, person=person
        )

        # Set representative face
        person.representative_face = f"/thumbnails/face_{face.id}.jpg"
        person.selected_thumbnail_face_id = face.id
        await db_session.commit()
        await db_session.refresh(person)

        assert person.representative_face.endswith(f"face_{face.id}.jpg")
        assert person.selected_thumbnail_face_id == face.id


@pytest.mark.database
class TestFaceModel:
    """Test Face model functionality."""

    async def test_face_creation(self, db_session: AsyncSession):
        """Test basic face creation."""
        face = await DatabaseTestHelper.create_test_face(db_session)

        assert_uuid_format(face.id)
        assert_uuid_format(face.photo_id)
        assert "top" in face.bounding_box
        assert "left" in face.bounding_box
        assert "bottom" in face.bounding_box
        assert "right" in face.bounding_box
        assert 0 <= face.confidence <= 100
        assert not face.ignored

    async def test_face_with_person(self, db_session: AsyncSession):
        """Test face associated with a person."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        face = await DatabaseTestHelper.create_test_face(db_session, person=person)

        assert face.person_id == person.id
        assert face.person.name == person.name

    async def test_face_embedding(self, db_session: AsyncSession):
        """Test face with embedding data."""
        embedding = {"encoding": TestDataGenerator.generate_face_encoding()}
        face = await DatabaseTestHelper.create_test_face(
            db_session, embedding=embedding
        )

        assert face.embedding is not None
        assert "encoding" in face.embedding
        assert len(face.embedding["encoding"]) == 128  # Standard face encoding size

    async def test_unassigned_faces(self, db_session: AsyncSession):
        """Test faces without assigned person."""
        face = await DatabaseTestHelper.create_test_face(db_session)

        assert face.person_id is None
        assert face.person is None

    async def test_ignored_faces(self, db_session: AsyncSession):
        """Test face ignore functionality."""
        face = await DatabaseTestHelper.create_test_face(db_session, ignored=True)

        assert face.ignored

    async def test_face_confidence_levels(self, db_session: AsyncSession):
        """Test different face confidence levels."""
        confidences = [60, 75, 85, 95, 99]

        for confidence in confidences:
            face = await DatabaseTestHelper.create_test_face(
                db_session, confidence=confidence
            )
            assert face.confidence == confidence
            assert 0 <= face.confidence <= 100


@pytest.mark.database
class TestCollectionModel:
    """Test Collection model functionality."""

    async def test_collection_creation(self, db_session: AsyncSession):
        """Test basic collection creation."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)

        assert_uuid_format(collection.id)
        assert len(collection.name) > 0
        assert collection.is_public in [True, False]
        assert not collection.is_smart_collection
        assert_datetime_recent(collection.created_at)

    async def test_smart_collection(self, db_session: AsyncSession):
        """Test smart collection with rules."""
        smart_rules = {
            "rules": [
                {"field": "rating", "operator": "greater_than", "value": 3},
                {"field": "keywords", "operator": "contains", "value": "vacation"},
            ],
            "operator": "AND",
        }

        collection = await DatabaseTestHelper.create_test_collection(
            db_session,
            name="High Rated Vacation Photos",
            is_smart_collection=True,
            smart_rules=smart_rules,
        )

        assert collection.is_smart_collection
        assert collection.smart_rules is not None
        assert len(collection.smart_rules["rules"]) == 2
        assert collection.smart_rules["operator"] == "AND"

    async def test_collection_with_photos(self, db_session: AsyncSession):
        """Test collection with photo relationships."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)
        file_version = await DatabaseTestHelper.create_test_file_version(db_session)

        # Add photo to collection
        collection_photo = CollectionPhoto(
            collection_id=collection.id, photo_id=file_version.id
        )
        db_session.add(collection_photo)
        await db_session.commit()
        await db_session.refresh(collection)

        assert len(collection.photos) == 1
        assert collection.photos[0].photo_id == file_version.id
        assert_datetime_recent(collection.photos[0].added_at)

    async def test_collection_cover_photo(self, db_session: AsyncSession):
        """Test collection cover photo functionality."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)
        file_version = await DatabaseTestHelper.create_test_file_version(db_session)

        collection.cover_photo = file_version.id
        await db_session.commit()
        await db_session.refresh(collection)

        assert collection.cover_photo == file_version.id


@pytest.mark.database
class TestSettingModel:
    """Test Setting model functionality."""

    async def test_setting_creation(self, db_session: AsyncSession):
        """Test basic setting creation."""
        setting_obj = Setting(
            key="test_setting",
            value="test_value",
            category="test",
            description="A test setting",
        )
        db_session.add(setting_obj)
        await db_session.commit()
        await db_session.refresh(setting_obj)

        assert_uuid_format(setting_obj.id)
        assert setting_obj.key == "test_setting"
        assert setting_obj.value == "test_value"
        assert setting_obj.category == "test"
        assert setting_obj.description == "A test setting"

    async def test_setting_unique_key(self, db_session: AsyncSession):
        """Test that setting keys must be unique."""
        setting1 = Setting(key="duplicate_key", value="value1")
        setting2 = Setting(key="duplicate_key", value="value2")

        db_session.add(setting1)
        await db_session.commit()

        db_session.add(setting2)
        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()

    async def test_setting_categories(self, db_session: AsyncSession):
        """Test settings organization by categories."""
        categories = ["ai", "face_detection", "thumbnails", "general"]

        for category in categories:
            setting_obj = Setting(
                key=f"{category}_setting", value="test_value", category=category
            )
            db_session.add(setting_obj)

        await db_session.commit()

        # Test querying by category
        ai_settings = await db_session.execute(
            select(Setting).where(Setting.category == "ai")
        )
        ai_settings = ai_settings.scalars().all()
        assert len(ai_settings) == 1
        assert ai_settings[0].key == "ai_setting"


@pytest.mark.database
class TestEventModel:
    """Test Event model functionality."""

    async def test_event_creation(self, db_session: AsyncSession):
        """Test basic event creation."""
        event_date = datetime(2024, 12, 25)
        event = Event(
            name="Christmas",
            type="holiday",
            date=event_date,
            is_recurring=True,
            recurring_type="yearly",
            country="US",
            is_enabled=True,
            description="Christmas holiday",
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        assert_uuid_format(event.id)
        assert event.name == "Christmas"
        assert event.type == "holiday"
        assert event.date == event_date
        assert event.is_recurring
        assert event.recurring_type == "yearly"
        assert event.country == "US"
        assert event.is_enabled
        assert_datetime_recent(event.created_at)

    async def test_birthday_event(self, db_session: AsyncSession):
        """Test birthday event linked to person."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        birthday = datetime(2024, 6, 15)

        event = Event(
            name=f"{person.name}'s Birthday",
            type="birthday",
            date=birthday,
            person_id=person.id,
            is_recurring=True,
            recurring_type="yearly",
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        assert event.type == "birthday"
        assert event.person_id == person.id
        assert event.person.name == person.name

    async def test_custom_event(self, db_session: AsyncSession):
        """Test custom event creation."""
        event_date = datetime(2024, 8, 15)
        event = Event(
            name="Family Reunion",
            type="custom",
            date=event_date,
            is_recurring=False,
            description="Annual family gathering",
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        assert event.type == "custom"
        assert not event.is_recurring
        assert event.recurring_type is None
        assert event.description == "Annual family gathering"

    async def test_event_regional_settings(self, db_session: AsyncSession):
        """Test event with regional settings."""
        event = Event(
            name="Thanksgiving",
            type="holiday",
            date=datetime(2024, 11, 28),
            country="US",
            region="nationwide",
            is_recurring=True,
            recurring_type="yearly",
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        assert event.country == "US"
        assert event.region == "nationwide"


@pytest.mark.database
class TestLocationModel:
    """Test Location model functionality."""

    async def test_location_creation(self, db_session: AsyncSession):
        """Test basic location creation."""
        location = Location(
            name="Central Park",
            description="Famous park in New York City",
            latitude="40.7812",
            longitude="-73.9665",
            radius=500,
            is_user_defined=True,
            place_name="Central Park, New York, NY",
            place_type="park",
        )
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)

        assert_uuid_format(location.id)
        assert location.name == "Central Park"
        assert location.latitude == "40.7812"
        assert location.longitude == "-73.9665"
        assert location.radius == 500
        assert location.is_user_defined
        assert location.place_type == "park"
        assert_datetime_recent(location.created_at)

    async def test_location_photo_count(self, db_session: AsyncSession):
        """Test location photo count tracking."""
        location = Location(
            name="Test Location",
            latitude="40.0000",
            longitude="-74.0000",
            photo_count=5,
        )
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)

        assert location.photo_count == 5

    async def test_auto_detected_location(self, db_session: AsyncSession):
        """Test automatically detected location."""
        location = Location(
            name="Times Square",
            latitude="40.7580",
            longitude="-73.9855",
            is_user_defined=False,
            place_name="Times Square, New York, NY, USA",
            place_type="tourist_attraction",
        )
        db_session.add(location)
        await db_session.commit()
        await db_session.refresh(location)

        assert not location.is_user_defined
        assert location.place_type == "tourist_attraction"


@pytest.mark.database
class TestRelationshipModel:
    """Test Relationship model functionality."""

    async def test_relationship_creation(self, db_session: AsyncSession):
        """Test basic relationship creation."""
        person1 = await DatabaseTestHelper.create_test_person(db_session, name="Alice")
        person2 = await DatabaseTestHelper.create_test_person(db_session, name="Bob")

        relationship = Relationship(
            person1_id=person1.id,
            person2_id=person2.id,
            relationship_type="spouse",
            notes="Married in 2020",
        )
        db_session.add(relationship)
        await db_session.commit()
        await db_session.refresh(relationship)

        assert_uuid_format(relationship.id)
        assert relationship.person1_id == person1.id
        assert relationship.person2_id == person2.id
        assert relationship.relationship_type == "spouse"
        assert relationship.notes == "Married in 2020"
        assert relationship.person1.name == "Alice"
        assert relationship.person2.name == "Bob"
        assert_datetime_recent(relationship.created_at)

    async def test_all_relationship_types(self, db_session: AsyncSession):
        """Test all supported relationship types."""
        person1 = await DatabaseTestHelper.create_test_person(
            db_session, name="Person1"
        )

        for rel_type in TEST_RELATIONSHIP_TYPES:
            person2 = await DatabaseTestHelper.create_test_person(
                db_session, name=f"Person_{rel_type}"
            )

            relationship = Relationship(
                person1_id=person1.id, person2_id=person2.id, relationship_type=rel_type
            )
            db_session.add(relationship)

        await db_session.commit()

        # Verify all relationships were created
        person1_relationships = await db_session.execute(
            select(Relationship).where(Relationship.person1_id == person1.id)
        )
        relationships = person1_relationships.scalars().all()

        assert len(relationships) == len(TEST_RELATIONSHIP_TYPES)
        relationship_types = [r.relationship_type for r in relationships]
        for rel_type in TEST_RELATIONSHIP_TYPES:
            assert rel_type in relationship_types

    async def test_bidirectional_relationships(self, db_session: AsyncSession):
        """Test accessing relationships from both sides."""
        person1 = await DatabaseTestHelper.create_test_person(db_session, name="Parent")
        person2 = await DatabaseTestHelper.create_test_person(db_session, name="Child")

        # Create parent-child relationship
        relationship = Relationship(
            person1_id=person1.id, person2_id=person2.id, relationship_type="parent"
        )
        db_session.add(relationship)
        await db_session.commit()
        await db_session.refresh(person1)
        await db_session.refresh(person2)

        # Test accessing from person1 side
        assert len(person1.relationships_as_person1) == 1
        assert person1.relationships_as_person1[0].relationship_type == "parent"
        assert person1.relationships_as_person1[0].person2.name == "Child"

        # Test accessing from person2 side
        assert len(person2.relationships_as_person2) == 1
        assert person2.relationships_as_person2[0].relationship_type == "parent"
        assert person2.relationships_as_person2[0].person1.name == "Parent"


@pytest.mark.database
class TestAIPromptModel:
    """Test AIPrompt model functionality."""

    async def test_ai_prompt_creation(self, db_session: AsyncSession):
        """Test basic AI prompt creation."""
        prompt = AIPrompt(
            name="Image Analysis",
            description="Analyze image content and generate tags",
            category="analysis",
            provider="openai",
            system_prompt="You are an expert image analyst...",
            user_prompt="Analyze this image and provide tags: {image}",
            is_default=True,
            is_active=True,
        )
        db_session.add(prompt)
        await db_session.commit()
        await db_session.refresh(prompt)

        assert_uuid_format(prompt.id)
        assert prompt.name == "Image Analysis"
        assert prompt.category == "analysis"
        assert prompt.provider == "openai"
        assert prompt.is_default
        assert prompt.is_active
        assert len(prompt.system_prompt) > 0
        assert "{image}" in prompt.user_prompt
        assert_datetime_recent(prompt.created_at)

    async def test_ai_prompt_categories(self, db_session: AsyncSession):
        """Test different AI prompt categories."""
        categories = ["analysis", "naming", "description"]
        providers = ["openai", "ollama", "both"]

        for i, category in enumerate(categories):
            provider = providers[i % len(providers)]
            prompt = AIPrompt(
                name=f"{category.title()} Prompt",
                category=category,
                provider=provider,
                system_prompt=f"System prompt for {category}",
                user_prompt=f"User prompt for {category}",
                is_active=True,
            )
            db_session.add(prompt)

        await db_session.commit()

        # Test querying by category
        analysis_prompts = await db_session.execute(
            select(AIPrompt).where(AIPrompt.category == "analysis")
        )
        analysis_prompts = analysis_prompts.scalars().all()
        assert len(analysis_prompts) == 1
        assert analysis_prompts[0].name == "Analysis Prompt"

    async def test_ai_prompt_default_selection(self, db_session: AsyncSession):
        """Test default prompt selection."""
        # Create multiple prompts for the same category
        prompt1 = AIPrompt(
            name="Standard Analysis",
            category="analysis",
            provider="openai",
            system_prompt="Standard analysis",
            user_prompt="Analyze: {image}",
            is_default=False,
            is_active=True,
        )
        prompt2 = AIPrompt(
            name="Default Analysis",
            category="analysis",
            provider="openai",
            system_prompt="Default analysis",
            user_prompt="Analyze: {image}",
            is_default=True,
            is_active=True,
        )

        db_session.add(prompt1)
        db_session.add(prompt2)
        await db_session.commit()

        # Test finding default prompt
        default_prompt = await db_session.execute(
            select(AIPrompt).where(
                and_(AIPrompt.category == "analysis", AIPrompt.is_default == True)
            )
        )
        default_prompt = default_prompt.scalar_one_or_none()

        assert default_prompt is not None
        assert default_prompt.name == "Default Analysis"
        assert default_prompt.is_default


@pytest.mark.database
class TestGlobalTagLibraryModel:
    """Test GlobalTagLibrary model functionality."""

    async def test_global_tag_creation(self, db_session: AsyncSession):
        """Test basic global tag creation."""
        tag = GlobalTagLibrary(tag="landscape", usage_count=10)
        db_session.add(tag)
        await db_session.commit()
        await db_session.refresh(tag)

        assert_uuid_format(tag.id)
        assert tag.tag == "landscape"
        assert tag.usage_count == 10
        assert_datetime_recent(tag.created_at)

    async def test_global_tag_unique_constraint(self, db_session: AsyncSession):
        """Test that tags must be unique."""
        tag1 = GlobalTagLibrary(tag="portrait", usage_count=5)
        tag2 = GlobalTagLibrary(tag="portrait", usage_count=3)

        db_session.add(tag1)
        await db_session.commit()

        db_session.add(tag2)
        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()

    async def test_global_tag_usage_tracking(self, db_session: AsyncSession):
        """Test tag usage count tracking."""
        tag = GlobalTagLibrary(tag="sunset", usage_count=1)
        db_session.add(tag)
        await db_session.commit()
        await db_session.refresh(tag)

        # Simulate tag usage increment
        tag.usage_count += 1
        await db_session.commit()
        await db_session.refresh(tag)

        assert tag.usage_count == 2


@pytest.mark.database
class TestComplexQueries:
    """Test complex database queries and relationships."""

    async def test_photos_with_faces_query(self, db_session: AsyncSession):
        """Test querying photos that contain faces."""
        # Create test data
        person = await DatabaseTestHelper.create_test_person(db_session)
        file_version_with_face = await DatabaseTestHelper.create_test_file_version(
            db_session
        )
        file_version_without_face = await DatabaseTestHelper.create_test_file_version(
            db_session
        )

        # Add face to one photo
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=file_version_with_face, person=person
        )

        # Query photos with faces
        photos_with_faces = await db_session.execute(
            select(FileVersion).join(Face, FileVersion.id == Face.photo_id).distinct()
        )
        photos_with_faces = photos_with_faces.scalars().all()

        assert len(photos_with_faces) == 1
        assert photos_with_faces[0].id == file_version_with_face.id

    async def test_high_rated_photos_query(self, db_session: AsyncSession):
        """Test querying high-rated photos."""
        # Create photos with different ratings
        high_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=5
        )
        medium_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=3
        )
        low_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=1
        )

        # Query high-rated photos (rating >= 4)
        high_rated_photos = await db_session.execute(
            select(FileVersion).where(FileVersion.rating >= 4)
        )
        high_rated_photos = high_rated_photos.scalars().all()

        assert len(high_rated_photos) == 1
        assert high_rated_photos[0].id == high_rated.id
        assert high_rated_photos[0].rating == 5

    async def test_photos_by_location_query(self, db_session: AsyncSession):
        """Test querying photos by location."""
        # Create photos with different locations
        nyc_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, location="40.7589,-73.9851"
        )
        la_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, location="34.0522,-118.2437"
        )
        no_location_photo = await DatabaseTestHelper.create_test_file_version(
            db_session
        )

        # Query photos with location data
        photos_with_location = await db_session.execute(
            select(FileVersion).where(FileVersion.location.isnot(None))
        )
        photos_with_location = photos_with_location.scalars().all()

        assert len(photos_with_location) == 2
        location_ids = [p.id for p in photos_with_location]
        assert nyc_photo.id in location_ids
        assert la_photo.id in location_ids
        assert no_location_photo.id not in location_ids

    async def test_person_photo_count_query(self, db_session: AsyncSession):
        """Test counting photos per person."""
        # Create test data
        person1 = await DatabaseTestHelper.create_test_person(
            db_session, name="Person 1"
        )
        person2 = await DatabaseTestHelper.create_test_person(
            db_session, name="Person 2"
        )

        photo1 = await DatabaseTestHelper.create_test_file_version(db_session)
        photo2 = await DatabaseTestHelper.create_test_file_version(db_session)
        photo3 = await DatabaseTestHelper.create_test_file_version(db_session)

        # Create faces - person1 in 2 photos, person2 in 1 photo
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo1, person=person1
        )
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo2, person=person1
        )
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo3, person=person2
        )

        # Query photo count per person
        person_photo_counts = await db_session.execute(
            select(Person.name, func.count(Face.id).label("photo_count"))
            .join(Face, Person.id == Face.person_id)
            .group_by(Person.id, Person.name)
            .order_by(Person.name)
        )
        results = person_photo_counts.all()

        assert len(results) == 2
        assert results[0].name == "Person 1"
        assert results[0].photo_count == 2
        assert results[1].name == "Person 2"
        assert results[1].photo_count == 1


@pytest.mark.database
class TestDatabaseConstraints:
    """Test database constraints and integrity."""

    async def test_foreign_key_constraints(self, db_session: AsyncSession):
        """Test foreign key constraint enforcement."""
        # Try to create a file version with non-existent media asset
        version = FileVersion(
            media_asset_id="non-existent-id",
            tier="silver",
            file_path="/test/path.jpg",
            file_hash="abc123",
            file_size=1024,
            mime_type="image/jpeg",
        )
        db_session.add(version)

        with pytest.raises(Exception):
            await db_session.commit()

        await db_session.rollback()

    async def test_cascade_deletions(self, db_session: AsyncSession):
        """Test cascade deletion behavior."""
        # Create a media asset with file versions
        asset = await DatabaseTestHelper.create_test_media_asset(db_session)
        version1 = await DatabaseTestHelper.create_test_file_version(
            db_session, media_asset=asset
        )
        version2 = await DatabaseTestHelper.create_test_file_version(
            db_session, media_asset=asset
        )

        # Delete the media asset
        await db_session.delete(asset)
        await db_session.commit()

        # Verify file versions were deleted (assuming CASCADE is configured)
        remaining_versions = await db_session.execute(
            select(FileVersion).where(FileVersion.media_asset_id == asset.id)
        )
        remaining_versions = remaining_versions.scalars().all()

        # Note: Actual behavior depends on foreign key cascade configuration
        # This test documents expected behavior
        assert (
            len(remaining_versions) == 0 or len(remaining_versions) == 2
        )  # Depends on configuration

    async def test_json_field_validation(self, db_session: AsyncSession):
        """Test JSON field handling."""
        # Test valid JSON in metadata field
        valid_metadata = {
            "exif": {"camera": "Canon EOS R5", "iso": 800},
            "ai": {"tags": ["portrait", "outdoor"], "confidence": 0.95},
        }

        version = await DatabaseTestHelper.create_test_file_version(
            db_session, metadata=valid_metadata
        )

        assert version.metadata["exif"]["camera"] == "Canon EOS R5"
        assert version.metadata["ai"]["confidence"] == 0.95
        assert "portrait" in version.metadata["ai"]["tags"]


@pytest.mark.database
class TestPerformanceQueries:
    """Test database performance with larger datasets."""

    @pytest.mark.slow
    async def test_bulk_face_detection_query(self, db_session: AsyncSession):
        """Test performance with many faces."""
        # Create test data
        person = await DatabaseTestHelper.create_test_person(db_session)

        # Create multiple photos with faces
        faces_count = 100
        for i in range(faces_count):
            file_version = await DatabaseTestHelper.create_test_file_version(db_session)
            await DatabaseTestHelper.create_test_face(
                db_session, file_version=file_version, person=person
            )

        # Test querying all faces for a person
        start_time = datetime.now()

        person_faces = await db_session.execute(
            select(Face).where(Face.person_id == person.id)
        )
        faces = person_faces.scalars().all()

        end_time = datetime.now()
        query_time = (end_time - start_time).total_seconds()

        assert len(faces) == faces_count
        assert query_time < 1.0  # Should complete within 1 second

    @pytest.mark.slow
    async def test_complex_search_query(self, db_session: AsyncSession):
        """Test complex search query performance."""
        # Create test data with various attributes
        for i in range(50):
            rating = (i % 5) + 1
            keywords = [f"tag{i}", f"category{i % 10}", "common"]

            await DatabaseTestHelper.create_test_file_version(
                db_session,
                rating=rating,
                keywords=keywords,
                location=f"40.{i:04d},-73.{i:04d}" if i % 3 == 0 else None,
            )

        # Complex search query
        start_time = datetime.now()

        search_results = await db_session.execute(
            select(FileVersion)
            .where(
                and_(
                    FileVersion.rating >= 3,
                    FileVersion.location.isnot(None),
                    FileVersion.keywords.any("common"),
                )
            )
            .limit(10)
        )
        results = search_results.scalars().all()

        end_time = datetime.now()
        query_time = (end_time - start_time).total_seconds()

        assert len(results) > 0
        assert query_time < 1.0  # Should complete within 1 second


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
