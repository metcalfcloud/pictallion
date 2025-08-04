"""
People & Relationships API Routes

Handles people management, relationships, and enhanced people features.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.crud import person
from app.services.face_detection_service import FaceDetectionService

router = APIRouter(prefix="/api", tags=["People"])

def get_person_crud():
    return person

# Request/Response models
class CreatePersonRequest(BaseModel):
    """Request to create a new person."""
    name: str
    birthdate: Optional[str] = None  # ISO date string
    notes: Optional[str] = None
    is_public: bool = Field(True, alias="isPublic")

class UpdatePersonRequest(BaseModel):
    """Request to update person information."""
    name: Optional[str] = None
    birthdate: Optional[str] = None
    notes: Optional[str] = None
    is_public: Optional[bool] = Field(None, alias="isPublic")
    selected_thumbnail_face_id: Optional[str] = Field(None, alias="selectedThumbnailFaceId")

class PersonResponse(BaseModel):
    """Person data response."""
    id: str
    name: str
    birthdate: Optional[str] = None
    notes: Optional[str] = None
    is_public: bool = Field(..., alias="isPublic")
    selected_thumbnail_face_id: Optional[str] = Field(None, alias="selectedThumbnailFaceId")
    face_count: int = Field(..., alias="faceCount")
    photo_count: int = Field(..., alias="photoCount")
    cover_photo: Optional[str] = Field(None, alias="coverPhoto")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

class SetThumbnailRequest(BaseModel):
    """Request to set person thumbnail."""
    face_id: str = Field(..., alias="faceId")

class CreateRelationshipRequest(BaseModel):
    """Request to create a relationship."""
    person1_id: str = Field(..., alias="person1Id")
    person2_id: str = Field(..., alias="person2Id")
    relationship_type: str = Field(..., alias="relationshipType")
    notes: Optional[str] = None

class UpdateRelationshipRequest(BaseModel):
    """Request to update a relationship."""
    relationship_type: Optional[str] = Field(None, alias="relationshipType")
    notes: Optional[str] = None

class RelationshipResponse(BaseModel):
    """Relationship data response."""
    id: str
    person1_id: str = Field(..., alias="person1Id")
    person2_id: str = Field(..., alias="person2Id")
    relationship_type: str = Field(..., alias="relationshipType")
    notes: Optional[str] = None
    person1: Optional[Dict[str, Any]] = None
    person2: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

class MergePeopleRequest(BaseModel):
    """Request to merge two people."""
    source_person_id: str = Field(..., alias="sourcePersonId")
    target_person_id: str = Field(..., alias="targetPersonId")
    keep_source_data: bool = Field(False, alias="keepSourceData")

class PersonStatistics(BaseModel):
    """Person statistics and analytics."""
    total_people: int = Field(..., alias="totalPeople")
    people_with_faces: int = Field(..., alias="peopleWithFaces")
    average_photos_per_person: float = Field(..., alias="averagePhotosPerPerson")
    top_people: List[Dict[str, Any]] = Field(..., alias="topPeople")


# Dependencies
async def get_face_detection_service() -> FaceDetectionService:
    """Get face detection service instance."""
    return FaceDetectionService()


@router.get("/people", response_model=List[PersonResponse])
async def list_people(
    include_stats: bool = Query(True, alias="includeStats", description="Include face and photo counts"),
    is_public: Optional[bool] = Query(None, alias="isPublic", description="Filter by public status"),
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service)
):
    """
    List all people with statistics and cover photos.
    
    Includes face counts, photo counts, and cover photo generation.
    """
    try:
        people = await crud.get_people(db)
        
        # Apply filters
        if is_public is not None:
            people = [p for p in people if p.is_public == is_public]
        
        response_people = []
        
        for person in people:
            try:
                face_count = 0
                photo_count = 0
                cover_photo = None
                
                if include_stats:
                    # Get faces for this person
                    faces = await crud.get_faces_by_person(person.id)
                    face_count = len(faces)
                    
                    # Get unique photo count
                    photo_ids = list(set(face.photo_id for face in faces))
                    photo_count = len(photo_ids)
                    
                    # Generate cover photo (face crop for thumbnail)
                    if faces:
                        selected_face = faces[0]  # Default to first face
                        
                        # Use selected thumbnail face if available
                        if person.selected_thumbnail_face_id:
                            thumbnail_face = next(
                                (f for f in faces if f.id == person.selected_thumbnail_face_id), 
                                None
                            )
                            if thumbnail_face:
                                selected_face = thumbnail_face
                        
                        # Generate face crop
                        try:
                            photo = await crud.get_file_version(selected_face.photo_id)
                            if photo and selected_face.bounding_box:
                                cover_photo = await face_service.generate_face_crop(
                                    photo.file_path,
                                    selected_face.bounding_box
                                )
                        except Exception as e:
                            print(f"Failed to generate cover photo for person {person.id}: {e}")
                
                response_people.append(PersonResponse(
                    id=person.id,
                    name=person.name,
                    birthdate=person.birthdate.isoformat() if person.birthdate else None,
                    notes=person.notes,
                    isPublic=person.is_public,
                    selectedThumbnailFaceId=person.selected_thumbnail_face_id,
                    faceCount=face_count,
                    photoCount=photo_count,
                    coverPhoto=cover_photo,
                    createdAt=person.created_at,
                    updatedAt=person.updated_at
                ))
                
            except Exception as e:
                print(f"Error processing person {person.id}: {e}")
                # Return person with default stats on error
                response_people.append(PersonResponse(
                    id=person.id,
                    name=person.name,
                    birthdate=person.birthdate.isoformat() if person.birthdate else None,
                    notes=person.notes,
                    isPublic=person.is_public,
                    selectedThumbnailFaceId=person.selected_thumbnail_face_id,
                    faceCount=0,
                    photoCount=0,
                    coverPhoto=None,
                    createdAt=person.created_at,
                    updatedAt=person.updated_at
                ))
        
        return response_people
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch people: {str(e)}")


@router.post("/people", response_model=PersonResponse)
async def create_person(
    person_data: CreatePersonRequest,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Create a new person."""
    try:
        # Parse birthdate if provided
        birthdate = None
        if person_data.birthdate:
            try:
                birthdate = datetime.fromisoformat(person_data.birthdate.replace('Z', '+00:00')).date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid birthdate format. Use ISO format.")
        
        # Create person data for storage
        from app.models.schemas import InsertPerson
        insert_data = InsertPerson(
            name=person_data.name,
            birthdate=birthdate,
            notes=person_data.notes,
            is_public=person_data.is_public
        )
        
        person = await crud.create_person(insert_data)
        
        return PersonResponse(
            id=person.id,
            name=person.name,
            birthdate=person.birthdate.isoformat() if person.birthdate else None,
            notes=person.notes,
            isPublic=person.is_public,
            selectedThumbnailFaceId=person.selected_thumbnail_face_id,
            faceCount=0,
            photoCount=0,
            coverPhoto=None,
            createdAt=person.created_at,
            updatedAt=person.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create person: {str(e)}")


@router.get("/people/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service)
):
    """Get person by ID with full details."""
    try:
        person = await crud.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Get statistics
        faces = await crud.get_faces_by_person(person.id)
        face_count = len(faces)
        photo_ids = list(set(face.photo_id for face in faces))
        photo_count = len(photo_ids)
        
        # Generate cover photo
        cover_photo = None
        if faces:
            selected_face = faces[0]
            
            if person.selected_thumbnail_face_id:
                thumbnail_face = next(
                    (f for f in faces if f.id == person.selected_thumbnail_face_id), 
                    None
                )
                if thumbnail_face:
                    selected_face = thumbnail_face
            
            try:
                photo = await crud.get_file_version(selected_face.photo_id)
                if photo and selected_face.bounding_box:
                    cover_photo = await face_service.generate_face_crop(
                        photo.file_path,
                        selected_face.bounding_box
                    )
            except Exception as e:
                print(f"Failed to generate cover photo: {e}")
        
        return PersonResponse(
            id=person.id,
            name=person.name,
            birthdate=person.birthdate.isoformat() if person.birthdate else None,
            notes=person.notes,
            isPublic=person.is_public,
            selectedThumbnailFaceId=person.selected_thumbnail_face_id,
            faceCount=face_count,
            photoCount=photo_count,
            coverPhoto=cover_photo,
            createdAt=person.created_at,
            updatedAt=person.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch person: {str(e)}")


@router.put("/people/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: str,
    updates: UpdatePersonRequest,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Update person information."""
    try:
        # Check if person exists
        person = await crud.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Prepare update data
        update_data = {}
        if updates.name is not None:
            update_data["name"] = updates.name
        if updates.birthdate is not None:
            try:
                update_data["birthdate"] = datetime.fromisoformat(updates.birthdate.replace('Z', '+00:00')).date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid birthdate format. Use ISO format.")
        if updates.notes is not None:
            update_data["notes"] = updates.notes
        if updates.is_public is not None:
            update_data["is_public"] = updates.is_public
        if updates.selected_thumbnail_face_id is not None:
            update_data["selected_thumbnail_face_id"] = updates.selected_thumbnail_face_id
        
        updated_person = await crud.update_person(person_id, update_data)
        
        # Get updated statistics
        faces = await crud.get_faces_by_person(person_id)
        face_count = len(faces)
        photo_ids = list(set(face.photo_id for face in faces))
        photo_count = len(photo_ids)
        
        return PersonResponse(
            id=updated_person.id,
            name=updated_person.name,
            birthdate=updated_person.birthdate.isoformat() if updated_person.birthdate else None,
            notes=updated_person.notes,
            isPublic=updated_person.is_public,
            selectedThumbnailFaceId=updated_person.selected_thumbnail_face_id,
            faceCount=face_count,
            photoCount=photo_count,
            coverPhoto=None,  # Would need to regenerate
            createdAt=updated_person.created_at,
            updatedAt=updated_person.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update person: {str(e)}")


@router.delete("/people/{person_id}")
async def delete_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Delete a person and unassign all their faces."""
    try:
        # Check if person exists
        person = await crud.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Unassign all faces first
        faces = await crud.get_faces_by_person(person_id)
        for face in faces:
            await crud.assign_face_to_person(face.id, None)
        
        # Delete relationships
        relationships = await crud.get_relationships_by_person(person_id)
        for relationship in relationships:
            await crud.delete_relationship(relationship.id)
        
        # Delete the person
        await crud.delete_person(person_id)
        
        return {
            "success": True,
            "message": "Person deleted successfully",
            "unassigned_faces": len(faces),
            "deleted_relationships": len(relationships)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete person: {str(e)}")


@router.put("/people/{person_id}/thumbnail")
async def set_person_thumbnail(
    person_id: str,
    request: SetThumbnailRequest,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service)
):
    """Set the thumbnail face for a person."""
    try:
        # Verify person exists
        person = await crud.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Verify face exists and belongs to this person
        face = await crud.get_face(request.face_id)
        if not face:
            raise HTTPException(status_code=404, detail="Face not found")
        
        if face.person_id != person_id:
            raise HTTPException(status_code=400, detail="Face does not belong to this person")
        
        # Update person's selected thumbnail face
        await crud.update_person(person_id, {
            "selected_thumbnail_face_id": request.face_id
        })
        
        # Generate new cover photo
        cover_photo = None
        try:
            photo = await crud.get_file_version(face.photo_id)
            if photo and face.bounding_box:
                cover_photo = await face_service.generate_face_crop(
                    photo.file_path,
                    face.bounding_box
                )
        except Exception as e:
            print(f"Failed to generate cover photo: {e}")
        
        return {
            "success": True,
            "message": "Profile photo updated successfully",
            "cover_photo": cover_photo
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thumbnail: {str(e)}")


@router.get("/people/{person_id}/photos")
async def get_person_photos(
    person_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Get photos containing a specific person."""
    try:
        # Verify person exists
        person = await crud.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Get faces for this person
        faces = await crud.get_faces_by_person(person_id)
        
        # Get unique photos
        photo_ids = list(set(face.photo_id for face in faces))
        
        # Get photo details with pagination
        photos = []
        for i, photo_id in enumerate(photo_ids[offset:offset + limit]):
            photo = await crud.get_file_version(photo_id)
            if photo:
                media_asset = await crud.get_media_asset(photo.media_asset_id)
                
                # Get faces in this photo for this person
                person_faces_in_photo = [f for f in faces if f.photo_id == photo_id]
                
                photo_data = {
                    **photo.dict(),
                    "media_asset": media_asset.dict() if media_asset else None,
                    "person_faces": [f.dict() for f in person_faces_in_photo]
                }
                photos.append(photo_data)
        
        return {
            "person": {
                "id": person.id,
                "name": person.name
            },
            "photos": photos,
            "total_photos": len(photo_ids),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get person photos: {str(e)}")


@router.get("/people/{person_id}/relationships", response_model=List[RelationshipResponse])
async def get_person_relationships(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Get all relationships for a person."""
    try:
        # Verify person exists
        person = await crud.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        relationships = await crud.get_relationships_by_person(person_id)
        
        response_relationships = []
        for relationship in relationships:
            # Get related people
            person1 = await crud.get_person(relationship.person1_id)
            person2 = await crud.get_person(relationship.person2_id)
            
            response_relationships.append(RelationshipResponse(
                id=relationship.id,
                person1Id=relationship.person1_id,
                person2Id=relationship.person2_id,
                relationshipType=relationship.relationship_type,
                notes=relationship.notes,
                person1=person1.dict() if person1 else None,
                person2=person2.dict() if person2 else None,
                createdAt=relationship.created_at,
                updatedAt=relationship.updated_at
            ))
        
        return response_relationships
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch relationships: {str(e)}")


@router.post("/relationships", response_model=RelationshipResponse)
async def create_relationship(
    relationship_data: CreateRelationshipRequest,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Create a new relationship between two people."""
    try:
        # Verify both people exist
        person1 = await crud.get_person(relationship_data.person1_id)
        person2 = await crud.get_person(relationship_data.person2_id)
        
        if not person1:
            raise HTTPException(status_code=404, detail="Person 1 not found")
        if not person2:
            raise HTTPException(status_code=404, detail="Person 2 not found")
        
        if relationship_data.person1_id == relationship_data.person2_id:
            raise HTTPException(status_code=400, detail="Cannot create relationship with self")
        
        # Create relationship
        from app.models.schemas import InsertRelationship
        insert_data = InsertRelationship(
            person1_id=relationship_data.person1_id,
            person2_id=relationship_data.person2_id,
            relationship_type=relationship_data.relationship_type,
            notes=relationship_data.notes
        )
        
        relationship = await crud.create_relationship(insert_data)
        
        return RelationshipResponse(
            id=relationship.id,
            person1Id=relationship.person1_id,
            person2Id=relationship.person2_id,
            relationshipType=relationship.relationship_type,
            notes=relationship.notes,
            person1=person1.dict(),
            person2=person2.dict(),
            createdAt=relationship.created_at,
            updatedAt=relationship.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create relationship: {str(e)}")


@router.put("/relationships/{relationship_id}", response_model=RelationshipResponse)
async def update_relationship(
    relationship_id: str,
    updates: UpdateRelationshipRequest,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Update an existing relationship."""
    try:
        # Check if relationship exists
        relationship = await crud.get_relationship(relationship_id)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        # Prepare update data
        update_data = {}
        if updates.relationship_type is not None:
            update_data["relationship_type"] = updates.relationship_type
        if updates.notes is not None:
            update_data["notes"] = updates.notes
        
        updated_relationship = await crud.update_relationship(relationship_id, update_data)
        
        # Get related people
        person1 = await crud.get_person(updated_relationship.person1_id)
        person2 = await crud.get_person(updated_relationship.person2_id)
        
        return RelationshipResponse(
            id=updated_relationship.id,
            person1Id=updated_relationship.person1_id,
            person2Id=updated_relationship.person2_id,
            relationshipType=updated_relationship.relationship_type,
            notes=updated_relationship.notes,
            person1=person1.dict() if person1 else None,
            person2=person2.dict() if person2 else None,
            createdAt=updated_relationship.created_at,
            updatedAt=updated_relationship.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update relationship: {str(e)}")


@router.delete("/relationships/{relationship_id}")
async def delete_relationship(
    relationship_id: str,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Delete a relationship."""
    try:
        # Check if relationship exists
        relationship = await crud.get_relationship(relationship_id)
        if not relationship:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        await crud.delete_relationship(relationship_id)
        
        return {
            "success": True,
            "message": "Relationship deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete relationship: {str(e)}")


@router.post("/people/merge")
async def merge_people(
    request: MergePeopleRequest,
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """
    Merge two people into one.
    
    Combines faces, relationships, and metadata from source person into target person.
    """
    try:
        # Verify both people exist
        source_person = await crud.get_person(request.source_person_id)
        target_person = await crud.get_person(request.target_person_id)
        
        if not source_person:
            raise HTTPException(status_code=404, detail="Source person not found")
        if not target_person:
            raise HTTPException(status_code=404, detail="Target person not found")
        
        if request.source_person_id == request.target_person_id:
            raise HTTPException(status_code=400, detail="Cannot merge person with themselves")
        
        # Move all faces from source to target
        source_faces = await crud.get_faces_by_person(request.source_person_id)
        for face in source_faces:
            await crud.assign_face_to_person(face.id, request.target_person_id)
        
        # Handle relationships
        source_relationships = await crud.get_relationships_by_person(request.source_person_id)
        
        for relationship in source_relationships:
            # Check if target person already has a relationship with the other person
            other_person_id = (
                relationship.person2_id 
                if relationship.person1_id == request.source_person_id 
                else relationship.person1_id
            )
            
            # Check for existing relationship
            target_relationships = await crud.get_relationships_by_person(request.target_person_id)
            existing = next(
                (r for r in target_relationships 
                 if r.person1_id == other_person_id or r.person2_id == other_person_id),
                None
            )
            
            if not existing:
                # Create new relationship for target person
                from app.models.schemas import InsertRelationship
                new_relationship = InsertRelationship(
                    person1_id=request.target_person_id,
                    person2_id=other_person_id,
                    relationship_type=relationship.relationship_type,
                    notes=relationship.notes
                )
                await crud.create_relationship(new_relationship)
            
            # Delete old relationship
            await crud.delete_relationship(relationship.id)
        
        # Optionally merge person data
        if request.keep_source_data:
            update_data = {}
            if not target_person.birthdate and source_person.birthdate:
                update_data["birthdate"] = source_person.birthdate
            if not target_person.notes and source_person.notes:
                update_data["notes"] = source_person.notes
            
            if update_data:
                await crud.update_person(request.target_person_id, update_data)
        
        # Delete source person
        await crud.delete_person(request.source_person_id)
        
        return {
            "success": True,
            "message": f"Successfully merged {source_person.name} into {target_person.name}",
            "target_person_id": request.target_person_id,
            "merged_faces": len(source_faces),
            "merged_relationships": len(source_relationships)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to merge people: {str(e)}")


@router.get("/people/statistics", response_model=PersonStatistics)
async def get_people_statistics(
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Get people statistics and analytics."""
    try:
        people = await crud.get_people()
        total_people = len(people)
        
        people_with_faces = 0
        total_photos = 0
        top_people_data = []
        
        for person in people:
            faces = await crud.get_faces_by_person(person.id)
            if faces:
                people_with_faces += 1
                photo_count = len(set(face.photo_id for face in faces))
                total_photos += photo_count
                
                top_people_data.append({
                    "id": person.id,
                    "name": person.name,
                    "photo_count": photo_count,
                    "face_count": len(faces)
                })
        
        # Sort and get top 10 people by photo count
        top_people_data.sort(key=lambda x: x["photo_count"], reverse=True)
        top_people = top_people_data[:10]
        
        average_photos = total_photos / people_with_faces if people_with_faces > 0 else 0
        
        return PersonStatistics(
            totalPeople=total_people,
            peopleWithFaces=people_with_faces,
            averagePhotosPerPerson=round(average_photos, 1),
            topPeople=top_people
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@router.post("/people/bulk-update")
async def bulk_update_people(
    person_ids: List[str] = Body(..., alias="personIds"),
    updates: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    crud = Depends(get_person_crud)
):
    """Bulk update multiple people."""
    try:
        updated_count = 0
        errors = []
        
        for person_id in person_ids:
            try:
                person = await crud.get_person(person_id)
                if person:
                    await crud.update_person(person_id, updates)
                    updated_count += 1
                else:
                    errors.append(f"Person {person_id} not found")
            except Exception as e:
                errors.append(f"Person {person_id}: {str(e)}")
        
        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors,
            "message": f"Updated {updated_count} people"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk update people: {str(e)}")