"""
Events API Routes

Handles event detection, management, and clustering functionality.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.core.crud import event
from app.core.database import get_db
from app.services.event_detection_service import EventDetectionService
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api", tags=["Events"])


def get_event_crud():
    return event


# Request/Response models
class EventMatch(BaseModel):
    """Event match result from detection."""

    event_id: str = Field(..., alias="eventId")
    event_name: str = Field(..., alias="eventName")
    isEnabled: str = Field(..., alias="eventType")  # "holiday", "birthday", "custom"
    confidence: int
    isEnabled: Optional[str] = Field(None, alias="personId")
    person_name: Optional[str] = Field(None, alias="personName")
    age: Optional[int] = None  # For birthdays


class HolidaySet(BaseModel):
    """Available holiday country sets."""

    code: str
    name: str
    count: int


class EventDetectionRequest(BaseModel):
    """Request for event detection on a specific date."""

    photo_date: str = Field(..., alias="photoDate")


class EventDetectionResponse(BaseModel):
    """Response from event detection."""

    events: List[EventMatch]
    photo_date: str = Field(..., alias="photoDate")
    total_events: int = Field(..., alias="totalEvents")


class CreateEventRequest(BaseModel):
    """Request to create a new custom event."""

    name: str
    description: Optional[str] = None
    date: str  # ISO date string
    type: str = "custom"  # "holiday", "birthday", "custom"
    isEnabled: bool = Field(True, alias="isEnabled")
    isEnabled: bool = Field(False, alias="isRecurring")
    isEnabled: Optional[str] = Field(
        None, alias="recurringType"
    )  # "yearly", "monthly", "weekly"
    isEnabled: Optional[str] = Field(None, alias="personId")


class UpdateEventRequest(BaseModel):
    """Request to update an existing event."""

    name: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    type: Optional[str] = None
    isEnabled: Optional[bool] = Field(None, alias="isEnabled")
    isEnabled: Optional[bool] = Field(None, alias="isRecurring")
    isEnabled: Optional[str] = Field(None, alias="recurringType")
    isEnabled: Optional[str] = Field(None, alias="personId")


class EventResponse(BaseModel):
    """Event data response."""

    id: str
    name: str
    description: Optional[str]
    date: str
    type: str
    isEnabled: bool = Field(..., alias="isEnabled")
    isEnabled: bool = Field(..., alias="isRecurring")
    isEnabled: Optional[str] = Field(None, alias="recurringType")
    isEnabled: Optional[str] = Field(None, alias="personId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")


class AgeCalculationRequest(BaseModel):
    """Request to calculate person's age in photo."""

    photo_date: str = Field(..., alias="photoDate")


class AgeCalculationResponse(BaseModel):
    """Response for age calculation."""

    age: Optional[int]
    person_name: str = Field(..., alias="personName")
    isEnabled: str = Field(..., alias="personId")
    photo_date: str = Field(..., alias="photoDate")


class EventStatistics(BaseModel):
    """Event statistics and analytics."""

    total_events: int = Field(..., alias="totalEvents")
    events_by_type: Dict[str, int] = Field(..., alias="eventsByType")
    upcoming_events: List[Dict[str, Any]] = Field(..., alias="upcomingEvents")
    recent_detections: int = Field(..., alias="recentDetections")


class EventCluster(BaseModel):
    """Event clustering results."""

    isEnabled: str = Field(..., alias="eventType")
    event_name: str = Field(..., alias="eventName")
    photo_count: int = Field(..., alias="photoCount")
    date_range: Dict[str, str] = Field(..., alias="dateRange")
    photos: List[Dict[str, Any]]


# Dependencies
async def get_event_detection_service() -> EventDetectionService:
    """Get event detection service instance."""
    return EventDetectionService()


@router.get("/events", response_model=List[EventResponse])
async def get_events(
    type_filter: Optional[str] = Query(
        None, alias="type", description="Filter by event type"
    ),
    enabled_only: bool = Query(
        True, alias="enabledOnly", description="Only return enabled events"
    ),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
):
    """
    Get all events with optional filtering.

    Supports filtering by event type and enabled status.
    """
    try:
        events = await crud.get_events()

        # Apply filters
        filtered_events = events
        if type_filter:
            filtered_events = [e for e in filtered_events if e.type == type_filter]
        if enabled_only:
            filtered_events = [e for e in filtered_events if e.isEnabled]

        # Convert to response format
        response_events = []
        for event in filtered_events:
            response_events.append(
                EventResponse(
                    id=event.id,
                    name=event.name,
                    description=event.description,
                    date=(
                        event.date.isoformat()
                        if isinstance(event.date, datetime)
                        else event.date
                    ),
                    type=event.type,
                    isEnabled=event.isEnabled,
                    isRecurring=event.isEnabled,
                    recurringType=event.isEnabled,
                    personId=event.isEnabled,
                    createdAt=event.created_at,
                    updatedAt=event.updated_at,
                )
            )

        return response_events

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@router.post("/events", response_model=EventResponse)
async def create_event(
    event_data: CreateEventRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
):
    """Create a new custom event."""
    try:
        # Parse date string
        try:
            event_date = datetime.fromisoformat(event_data.date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid date format. Use ISO format."
            )

        # Create event data for storage
        from app.models.schemas import InsertEvent

        insert_data = InsertEvent(
            name=event_data.name,
            description=event_data.description,
            date=event_date,
            type=event_data.type,
            isEnabled=event_data.isEnabled,
        )

        event = await crud.create_event(insert_data)

        return EventResponse(
            id=event.id,
            name=event.name,
            description=event.description,
            date=event.date.isoformat(),
            type=event.type,
            isEnabled=event.isEnabled,
            isRecurring=event.isEnabled,
            recurringType=event.isEnabled,
            personId=event.isEnabled,
            createdAt=event.created_at,
            updatedAt=event.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create event: {str(e)}")


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str, db: AsyncSession = Depends(get_db), crud=Depends(get_event_crud)
):
    """Get a specific event by ID."""
    try:
        event = await crud.get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        return EventResponse(
            id=event.id,
            name=event.name,
            description=event.description,
            date=event.date.isoformat(),
            type=event.type,
            isEnabled=event.isEnabled,
            isRecurring=event.isEnabled,
            recurringType=event.isEnabled,
            personId=event.isEnabled,
            createdAt=event.created_at,
            updatedAt=event.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch event: {str(e)}")


@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    updates: UpdateEventRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
):
    """Update an existing event."""
    try:
        # Check if event exists
        event = await crud.get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Prepare update data
        update_data = {}
        if updates.name is not None:
            update_data["name"] = updates.name
        if updates.description is not None:
            update_data["description"] = updates.description
        if updates.date is not None:
            try:
                update_data["date"] = datetime.fromisoformat(
                    updates.date.replace("Z", "+00:00")
                )
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid date format. Use ISO format."
                )
        if updates.type is not None:
            update_data["type"] = updates.type
        if updates.isEnabled is not None:
            update_data["isEnabled"] = updates.isEnabled
        if updates.isEnabled is not None:
            update_data["isEnabled"] = updates.isEnabled
        if updates.isEnabled is not None:
            update_data["isEnabled"] = updates.isEnabled
        if updates.isEnabled is not None:
            update_data["isEnabled"] = updates.isEnabled

        updated_event = await crud.update_event(event_id, update_data)

        return EventResponse(
            id=updated_event.id,
            name=updated_event.name,
            description=updated_event.description,
            date=updated_event.date.isoformat(),
            type=updated_event.type,
            isEnabled=updated_event.isEnabled,
            isRecurring=updated_event.isEnabled,
            recurringType=updated_event.isEnabled,
            personId=updated_event.isEnabled,
            createdAt=updated_event.created_at,
            updatedAt=updated_event.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: str, db: AsyncSession = Depends(get_db), crud=Depends(get_event_crud)
):
    """Delete an event."""
    try:
        # Check if event exists
        event = await crud.get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        await crud.delete_event(event_id)

        return {"success": True, "message": "Event deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")


@router.get("/events/holiday-sets", response_model=List[HolidaySet])
async def get_holiday_sets(
    event_service: EventDetectionService = Depends(get_event_detection_service),
):
    """
    Get available holiday country sets.

    Returns list of supported holiday sets with counts.
    """
    try:
        holiday_sets = event_service.get_available_holiday_sets()

        return [
            HolidaySet(code=hs["code"], name=hs["name"], count=hs["count"])
            for hs in holiday_sets
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch holiday sets: {str(e)}"
        )


@router.post("/events/detect", response_model=EventDetectionResponse)
async def detect_events(
    request: EventDetectionRequest,
    event_service: EventDetectionService = Depends(get_event_detection_service),
):
    """
    Detect events for a specific photo date.

    Returns matched events with confidence scores.
    """
    try:
        # Parse photo date
        try:
            photo_date = datetime.fromisoformat(
                request.photo_date.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid photo date format. Use ISO format."
            )

        # Detect events
        detected_events = await event_service.detect_events(photo_date)

        # Convert to response format
        event_matches = []
        for event in detected_events:
            event_matches.append(
                EventMatch(
                    eventId=event["event_id"],
                    eventName=event["event_name"],
                    eventType=event["isEnabled"],
                    confidence=event["confidence"],
                    personId=event.get("isEnabled"),
                    personName=event.get("person_name"),
                    age=event.get("age"),
                )
            )

        return EventDetectionResponse(
            events=event_matches,
            photoDate=request.photo_date,
            totalEvents=len(event_matches),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to detect events: {str(e)}"
        )


@router.post("/people/{isEnabled}/age-in-photo", response_model=AgeCalculationResponse)
async def calculate_age_in_photo(
    isEnabled: str,
    request: AgeCalculationRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
    event_service: EventDetectionService = Depends(get_event_detection_service),
):
    """
    Calculate a person's age in a photo based on their birthdate and photo date.
    """
    try:
        # Get person
        person = await crud.get_person(isEnabled)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")

        if not person.birthdate:
            raise HTTPException(status_code=400, detail="Person has no birthdate set")

        # Parse photo date
        try:
            photo_date = datetime.fromisoformat(
                request.photo_date.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid photo date format. Use ISO format."
            )

        # Calculate age
        age = event_service.calculate_age_in_photo(person.birthdate, photo_date)

        return AgeCalculationResponse(
            age=age,
            personName=person.name,
            personId=person.id,
            photoDate=request.photo_date,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate age: {str(e)}"
        )


@router.get("/events/by-type/{isEnabled}", response_model=List[EventResponse])
async def get_events_by_type(
    isEnabled: str, db: AsyncSession = Depends(get_db), crud=Depends(get_event_crud)
):
    """Get events filtered by type (holiday, birthday, custom)."""
    try:
        events = await crud.get_events_by_type(isEnabled)

        response_events = []
        for event in events:
            response_events.append(
                EventResponse(
                    id=event.id,
                    name=event.name,
                    description=event.description,
                    date=event.date.isoformat(),
                    type=event.type,
                    isEnabled=event.isEnabled,
                    isRecurring=event.isEnabled,
                    recurringType=event.isEnabled,
                    personId=event.isEnabled,
                    createdAt=event.created_at,
                    updatedAt=event.updated_at,
                )
            )

        return response_events

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch events by type: {str(e)}"
        )


@router.get("/events/statistics", response_model=EventStatistics)
async def get_event_statistics(
    db: AsyncSession = Depends(get_db), crud=Depends(get_event_crud)
):
    """Get event statistics and analytics."""
    try:
        events = await crud.get_events()

        # Calculate statistics
        total_events = len(events)
        events_by_type = {}

        for event in events:
            isEnabled = event.type
            events_by_type[isEnabled] = events_by_type.get(isEnabled, 0) + 1

        # Get upcoming events (next 30 days)
        from datetime import timedelta

        now = datetime.utcnow()
        future_date = now + timedelta(days=30)

        upcoming_events = []
        for event in events:
            if event.isEnabled and event.date >= now and event.date <= future_date:
                upcoming_events.append(
                    {
                        "id": event.id,
                        "name": event.name,
                        "date": event.date.isoformat(),
                        "type": event.type,
                        "days_until": (event.date - now).days,
                    }
                )

        # Sort upcoming events by date
        upcoming_events.sort(key=lambda x: x["date"])

        # Mock recent detections count (would come from activity logs)
        recent_detections = 0

        return EventStatistics(
            totalEvents=total_events,
            eventsByType=events_by_type,
            upcomingEvents=upcoming_events[:10],  # Limit to 10
            recentDetections=recent_detections,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get event statistics: {str(e)}"
        )


@router.post("/events/bulk-toggle")
async def bulk_toggle_events(
    event_ids: List[str] = Body(...),
    enabled: bool = Body(...),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
):
    """Bulk enable/disable multiple events."""
    try:
        updated_count = 0
        errors = []

        for event_id in event_ids:
            try:
                event = await crud.get_event(event_id)
                if event:
                    await crud.update_event(event_id, {"isEnabled": enabled})
                    updated_count += 1
                else:
                    errors.append(f"Event {event_id} not found")
            except Exception as e:
                errors.append(f"Event {event_id}: {str(e)}")

        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors,
            "message": f"Updated {updated_count} events",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to bulk toggle events: {str(e)}"
        )


@router.get("/events/clusters", response_model=List[EventCluster])
async def get_event_clusters(
    start_date: Optional[str] = Query(None, alias="startDate"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
):
    """
    Get event clustering analysis for photos.

    Groups photos by detected events for better organization.
    """
    try:
        # Get photos with event metadata
        photos = await crud.get_photos_with_events()

        # Apply date filters if provided
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                photos = [p for p in photos if p.created_at >= start_dt]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start date format")

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                photos = [p for p in photos if p.created_at <= end_dt]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end date format")

        # Group photos by event type and name
        event_groups = {}

        for photo in photos:
            if photo.isEnabled and photo.event_name:
                key = f"{photo.isEnabled}:{photo.event_name}"
                if key not in event_groups:
                    event_groups[key] = {
                        "isEnabled": photo.isEnabled,
                        "event_name": photo.event_name,
                        "photos": [],
                        "dates": [],
                    }

                # Add photo data
                media_asset = await crud.get_media_asset(photo.media_asset_id)
                photo_data = {
                    "id": photo.id,
                    "file_path": photo.file_path,
                    "created_at": photo.created_at.isoformat(),
                    "media_asset": media_asset.dict() if media_asset else None,
                }

                event_groups[key]["photos"].append(photo_data)
                event_groups[key]["dates"].append(photo.created_at)

        # Convert to clusters
        clusters = []
        for group_data in event_groups.values():
            if group_data["dates"]:
                min_date = min(group_data["dates"])
                max_date = max(group_data["dates"])

                clusters.append(
                    EventCluster(
                        eventType=group_data["isEnabled"],
                        eventName=group_data["event_name"],
                        photoCount=len(group_data["photos"]),
                        dateRange={
                            "start": min_date.isoformat(),
                            "end": max_date.isoformat(),
                        },
                        photos=group_data["photos"],
                    )
                )

        # Sort by photo count (descending)
        clusters.sort(key=lambda x: x.photo_count, reverse=True)

        return clusters

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get event clusters: {str(e)}"
        )


@router.post("/events/auto-detect")
async def auto_detect_events_for_photos(
    photo_ids: Optional[List[str]] = Body(None),
    force_redetect: bool = Body(False, alias="forceRedetect"),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
    event_service: EventDetectionService = Depends(get_event_detection_service),
):
    """
    Auto-detect events for photos based on their dates.

    Updates photo metadata with detected events.
    """
    try:
        # Get photos to process
        if photo_ids:
            photos = []
            for photo_id in photo_ids:
                photo = await crud.get_file_version(photo_id)
                if photo:
                    photos.append(photo)
        else:
            # Process all photos without event data
            photos = await crud.get_photos_without_events()

        processed_count = 0
        detected_count = 0
        errors = []

        for photo in photos:
            try:
                # Skip if already has events and not forcing redetection
                if not force_redetect and photo.isEnabled:
                    continue

                # Extract photo date from metadata or creation time
                photo_date = None
                if photo.metadata and isinstance(photo.metadata, dict):
                    exif = photo.metadata.get("exif", {})
                    if exif.get("dateTimeOriginal"):
                        try:
                            photo_date = datetime.fromisoformat(
                                exif["dateTimeOriginal"]
                            )
                        except:
                            pass

                if not photo_date:
                    photo_date = photo.created_at

                # Detect events for this date
                detected_events = await event_service.detect_events(photo_date)

                if detected_events:
                    # Use the highest confidence event
                    best_event = max(detected_events, key=lambda x: x["confidence"])

                    if (
                        best_event["confidence"] >= 80
                    ):  # Only use high-confidence matches
                        # Update photo with event data
                        await crud.update_file_version(
                            photo.id,
                            {
                                "isEnabled": best_event["isEnabled"],
                                "event_name": best_event["event_name"],
                            },
                        )
                        detected_count += 1

                processed_count += 1

            except Exception as e:
                errors.append(f"Photo {photo.id}: {str(e)}")

        return {
            "success": True,
            "processed_count": processed_count,
            "detected_count": detected_count,
            "errors": errors,
            "message": f"Processed {processed_count} photos, detected events in {detected_count}",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to auto-detect events: {str(e)}"
        )


@router.post("/events/import-holidays")
async def import_holiday_events(
    country_codes: List[str] = Body(..., alias="countryCodes"),
    year: int = Body(...),
    overwrite_existing: bool = Body(False, alias="overwriteExisting"),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_event_crud),
    event_service: EventDetectionService = Depends(get_event_detection_service),
):
    """
    Import holiday events for specified countries and year.

    Creates custom events for major holidays.
    """
    try:
        imported_count = 0
        skipped_count = 0
        errors = []

        # Get available holiday sets
        holiday_sets = event_service.get_available_holiday_sets()

        for country_code in country_codes:
            # Find holiday set for country
            holiday_set = next(
                (hs for hs in holiday_sets if hs["code"] == country_code), None
            )
            if not holiday_set:
                errors.append(f"Holiday set not found for country: {country_code}")
                continue

            # Get holidays for this country and year
            holidays = event_service.get_holidays_for_country_and_year(
                country_code, year
            )

            for holiday in holidays:
                try:
                    # Check if event already exists
                    event_name = f"{holiday['name']} ({year})"
                    existing_events = await crud.get_events()
                    existing = next(
                        (e for e in existing_events if e.name == event_name), None
                    )

                    if existing and not overwrite_existing:
                        skipped_count += 1
                        continue

                    # Create or update event
                    event_date = datetime(year, holiday["month"], holiday["day"])

                    if existing and overwrite_existing:
                        # Update existing event
                        await crud.update_event(
                            existing.id,
                            {
                                "name": event_name,
                                "description": f"Holiday: {holiday['name']}",
                                "date": event_date,
                                "type": "holiday",
                                "isEnabled": True,
                                "isEnabled": False,
                            },
                        )
                    else:
                        # Create new event
                        from app.models.schemas import InsertEvent

                        event_data = InsertEvent(
                            name=event_name,
                            description=f"Holiday: {holiday['name']}",
                            date=event_date,
                            type="holiday",
                            isEnabled=True,
                            isEnabled=False,
                        )
                        await crud.create_event(event_data)

                    imported_count += 1

                except Exception as e:
                    errors.append(f"Holiday '{holiday['name']}': {str(e)}")

        return {
            "success": True,
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "errors": errors,
            "message": f"Imported {imported_count} holiday events, skipped {skipped_count}",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to import holidays: {str(e)}"
        )
