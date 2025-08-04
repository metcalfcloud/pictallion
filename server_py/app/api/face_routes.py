"""
Face Detection and Recognition API Routes

Handles face detection, recognition, person assignment, and face management.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

from typing import Any, Dict, List, Optional

from app.core.crud import face
from app.core.database import get_db
from app.models.schemas import InsertFace
from app.services.face_detection_service import FaceDetectionService
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/faces", tags=["Faces"])


def get_face_crud():
    return face


# Response models
class FaceResponse(BaseModel):
    """Enhanced face response with photo and person data."""

    id: str
    photo_id: str
    person_id: Optional[str] = None
    bounding_box: Dict[str, Any]
    confidence: int
    embedding: Optional[Dict[str, Any]] = None
    ignored: bool = False
    created_at: str
    updated_at: str
    face_crop_url: Optional[str] = None
    age_in_photo: Optional[int] = None
    person: Optional[Dict[str, Any]] = None
    photo: Optional[Dict[str, Any]] = None


class FaceAssignmentRequest(BaseModel):
    """Request to assign faces to a person."""

    face_ids: List[str]
    person_id: str


class FaceSuggestion(BaseModel):
    """Face assignment suggestion."""

    person_id: str
    confidence: int
    representative_face: str
    person_name: str


class FaceSuggestionsResponse(BaseModel):
    """Response for face suggestions."""

    face_id: str
    suggestions: List[FaceSuggestion]


class FaceGroupResponse(BaseModel):
    """Response for grouped faces."""

    assigned_groups: List[Dict[str, Any]]
    unassigned_groups: List[Dict[str, Any]]
    total_faces: int
    assigned_count: int
    unassigned_count: int


class BatchIgnoreRequest(BaseModel):
    """Batch ignore faces request."""

    face_ids: List[str]


class BatchAssignRequest(BaseModel):
    """Batch face assignment request."""

    assignments: List[Dict[str, str]]  # [{"face_id": "...", "person_id": "..."}]


# Dependencies
async def get_face_detection_service() -> FaceDetectionService:
    """Get face detection service instance."""
    return FaceDetectionService()


@router.get("/photo/{photo_id}", response_model=List[FaceResponse])
async def get_faces_for_photo(
    photo_id: str,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> List[FaceResponse]:
    """
    Get all faces for a specific photo with enhanced data.

    Includes person data, face crop URLs, and age-in-photo calculations.
    """
    try:
        # Get photo first
        photo = await crud.get_file_version(photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")

        # Get faces for photo
        faces = await crud.get_faces_by_photo(photo_id)

        # Enhance faces with additional data
        enhanced_faces = []
        for face in faces:
            face_dict = face.dict()

            # Add person data if available
            if face.person_id:
                person = await crud.get_person(face.person_id)
                face_dict["person"] = person.dict() if person else None

                # Calculate age in photo if person has birthdate
                if person and person.birthdate:
                    media_asset = await crud.get_media_asset(photo.media_asset_id)
                    photo_with_asset = {
                        **photo.dict(),
                        "media_asset": media_asset.dict() if media_asset else None,
                    }
                    photo_date = await face_service.extract_photo_date(photo_with_asset)

                    if photo_date:
                        face_dict["age_in_photo"] = (
                            await face_service.calculate_age_in_photo(
                                person.birthdate, photo_date
                            )
                        )

            # Generate face crop URL
            try:
                face_crop_url = await face_service.generate_face_crop(
                    photo.file_path, face.bounding_box
                )
                face_dict["face_crop_url"] = face_crop_url
            except Exception as crop_error:
                print(f"Failed to generate face crop for face {face.id}: {crop_error}")
                face_dict["face_crop_url"] = None

            # Add photo information
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            face_dict["photo"] = {
                **photo.dict(),
                "media_asset": media_asset.dict() if media_asset else None,
            }

            enhanced_faces.append(FaceResponse(**face_dict))

        return enhanced_faces

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch faces for photo: {str(e)}"
        )


@router.get("/", response_model=List[FaceResponse])
async def list_all_faces(
    include_ignored: bool = Query(False, description="Include ignored faces"),
    person_id: Optional[str] = Query(None, description="Filter by person ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> List[FaceResponse]:
    """List all faces with optional filtering."""
    try:
        if person_id:
            faces = await crud.get_faces_by_person(person_id)
        elif include_ignored:
            faces = await crud.get_all_faces(include_ignored=True)
        else:
            faces = await crud.get_all_faces(include_ignored=False)

        # Apply pagination
        paginated_faces = faces[offset : offset + limit]

        # Enhance faces with photo information and face crops
        enhanced_faces = []
        for face in paginated_faces:
            photo = await crud.get_file_version(face.photo_id)
            if not photo:
                continue

            face_dict = face.dict()

            # Generate face crop URL
            try:
                face_crop_url = await face_service.generate_face_crop(
                    photo.file_path, face.bounding_box
                )
                face_dict["face_crop_url"] = face_crop_url
            except Exception:
                face_dict["face_crop_url"] = None

            # Add person data if assigned
            if face.person_id:
                person = await crud.get_person(face.person_id)
                face_dict["person"] = person.dict() if person else None

                # Calculate age in photo
                if person and person.birthdate:
                    media_asset = await crud.get_media_asset(photo.media_asset_id)
                    photo_with_asset = {
                        **photo.dict(),
                        "media_asset": media_asset.dict() if media_asset else None,
                    }
                    photo_date = await face_service.extract_photo_date(photo_with_asset)

                    if photo_date:
                        face_dict["age_in_photo"] = (
                            await face_service.calculate_age_in_photo(
                                person.birthdate, photo_date
                            )
                        )

            # Add photo information
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            face_dict["photo"] = {
                **photo.dict(),
                "media_asset": media_asset.dict() if media_asset else None,
            }

            enhanced_faces.append(FaceResponse(**face_dict))

        return enhanced_faces

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch faces: {str(e)}")


@router.get("/unassigned", response_model=List[FaceResponse])
async def get_unassigned_faces(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> List[FaceResponse]:
    """Get faces that haven't been assigned to any person."""
    try:
        unassigned_faces = await crud.get_unassigned_faces(limit=limit)

        # Enhance with photo information and face crop URLs
        enhanced_faces = []
        for face in unassigned_faces:
            photo = await crud.get_file_version(face.photo_id)
            if not photo:
                continue

            face_dict = face.dict()

            # Generate face crop URL
            try:
                face_crop_url = await face_service.generate_face_crop(
                    photo.file_path, face.bounding_box
                )
                face_dict["face_crop_url"] = face_crop_url
            except Exception:
                face_dict["face_crop_url"] = photo.file_path  # Fallback to full image

            # Add photo information
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            face_dict["photo"] = {
                **photo.dict(),
                "media_asset": media_asset.dict() if media_asset else None,
            }

            enhanced_faces.append(FaceResponse(**face_dict))

        return enhanced_faces

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch unassigned faces: {str(e)}"
        )


@router.get("/ignored", response_model=List[FaceResponse])
async def get_ignored_faces(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> List[FaceResponse]:
    """Get faces that have been ignored."""
    try:
        ignored_faces = await crud.get_ignored_faces(limit=limit)

        # Enhance with photo information and face crop URLs
        enhanced_faces = []
        for face in ignored_faces:
            photo = await crud.get_file_version(face.photo_id)
            if not photo:
                continue

            face_dict = face.dict()

            # Generate face crop URL
            try:
                face_crop_url = await face_service.generate_face_crop(
                    photo.file_path, face.bounding_box
                )
                face_dict["face_crop_url"] = face_crop_url
            except Exception:
                face_dict["face_crop_url"] = photo.file_path

            # Add photo information
            media_asset = await crud.get_media_asset(photo.media_asset_id)
            face_dict["photo"] = {
                **photo.dict(),
                "media_asset": media_asset.dict() if media_asset else None,
            }

            enhanced_faces.append(FaceResponse(**face_dict))

        return enhanced_faces

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch ignored faces: {str(e)}"
        )


@router.post("/assign")
async def assign_faces_to_person(
    request: FaceAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
) -> Dict[str, Any]:
    """Assign multiple faces to a person."""
    try:
        # Verify person exists
        person = await crud.get_person(request.person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")

        assigned_count = 0
        for face_id in request.face_ids:
            try:
                await crud.assign_face_to_person(face_id, request.person_id)
                assigned_count += 1
            except Exception as face_error:
                print(f"Failed to assign face {face_id}: {face_error}")

        return {
            "success": True,
            "assigned": assigned_count,
            "total_requested": len(request.face_ids),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign faces: {str(e)}")


@router.get("/suggestions", response_model=List[FaceSuggestionsResponse])
async def get_face_suggestions(
    limit: int = Query(50, ge=1, le=200),
    confidence_threshold: float = Query(0.75, ge=0.5, le=0.95),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> List[FaceSuggestionsResponse]:
    """
    Get face assignment suggestions based on similarity.

    Uses face embeddings to suggest person assignments for unassigned faces.
    """
    try:
        unassigned_faces = await crud.get_unassigned_faces(limit=limit)
        people = await crud.get_people()

        if not unassigned_faces or not people:
            return []

        suggestions = []

        for face in unassigned_faces:
            if not face.embedding or not isinstance(face.embedding, (list, dict)):
                continue

            # Find similar faces assigned to people
            similar_faces = await face_service.find_similar_faces(
                face.embedding, threshold=confidence_threshold
            )

            if not similar_faces:
                continue

            # Group by person and calculate confidence scores
            person_matches = {}
            for similar in similar_faces:
                if similar.get("person_id"):
                    person_id = similar["person_id"]
                    if person_id not in person_matches:
                        person_matches[person_id] = {"count": 0, "total_similarity": 0}
                    person_matches[person_id]["count"] += 1
                    person_matches[person_id]["total_similarity"] += similar.get(
                        "similarity", 0
                    )

            if not person_matches:
                continue

            # Create suggestion entries
            face_suggestions = []
            for person_id, match in person_matches.items():
                person = next((p for p in people if p.id == person_id), None)
                if not person:
                    continue

                avg_similarity = match["total_similarity"] / match["count"]
                confidence = round(avg_similarity * 100)

                # Only include high-confidence suggestions
                if confidence >= 75:
                    # Get representative face for this person
                    representative_face_url = ""
                    if person.selected_thumbnail_face_id:
                        representative_face_url = (
                            f"/api/faces/{person.selected_thumbnail_face_id}/crop"
                        )

                    face_suggestions.append(
                        FaceSuggestion(
                            person_id=person.id,
                            confidence=confidence,
                            representative_face=representative_face_url,
                            person_name=person.name,
                        )
                    )

            if face_suggestions:
                # Sort by confidence and take top 3
                face_suggestions.sort(key=lambda x: x.confidence, reverse=True)
                suggestions.append(
                    FaceSuggestionsResponse(
                        face_id=face.id, suggestions=face_suggestions[:3]
                    )
                )

        return suggestions

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get face suggestions: {str(e)}"
        )


@router.get("/grouped", response_model=FaceGroupResponse)
async def get_grouped_faces(
    similarity_threshold: float = Query(0.95, ge=0.8, le=0.99),
    min_group_size: int = Query(3, ge=2, le=10),
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> FaceGroupResponse:
    """
    Get faces grouped by similarity and person assignment.

    Groups faces for better organization and review.
    """
    try:
        all_faces = await crud.get_all_faces()
        people = await crud.get_people()

        # Separate assigned and unassigned faces
        assigned_faces = [f for f in all_faces if f.person_id and not f.ignored]
        unassigned_faces = [f for f in all_faces if not f.person_id and not f.ignored]

        # Group assigned faces by person
        assigned_groups = {}
        for face in assigned_faces:
            person_id = face.person_id
            if person_id not in assigned_groups:
                person = next((p for p in people if p.id == person_id), None)
                assigned_groups[person_id] = {
                    "type": "person",
                    "person_id": person_id,
                    "person_name": person.name if person else "Unknown",
                    "faces": [],
                }
            assigned_groups[person_id]["faces"].append(face.dict())

        # Group unassigned faces by similarity
        unassigned_groups = []
        processed_face_ids = set()

        for face in unassigned_faces:
            if face.id in processed_face_ids or not face.embedding:
                continue

            # Find similar faces
            similar_faces = await face_service.find_similar_faces(
                face.embedding, threshold=similarity_threshold
            )

            # Filter to only include unassigned faces from current list
            similar_unassigned = [
                sf
                for sf in similar_faces
                if any(uf.id == sf.get("id") for uf in unassigned_faces)
                and sf.get("id") not in processed_face_ids
            ]

            # Create group with current face and similar faces
            group_faces = [face]
            processed_face_ids.add(face.id)

            for similar in similar_unassigned:
                similar_face = next(
                    (uf for uf in unassigned_faces if uf.id == similar.get("id")), None
                )
                if similar_face and similar_face.id not in processed_face_ids:
                    group_faces.append(similar_face)
                    processed_face_ids.add(similar_face.id)

            # Only create similarity groups with minimum required faces
            if len(group_faces) >= min_group_size:
                avg_confidence = 0
                if similar_unassigned:
                    avg_confidence = round(
                        sum(sf.get("similarity", 0) for sf in similar_unassigned)
                        / len(similar_unassigned)
                        * 100
                    )

                unassigned_groups.append(
                    {
                        "type": "similarity",
                        "group_id": f"similar_{face.id}",
                        "group_name": f"Likely Same Person ({len(group_faces)} faces)",
                        "faces": [f.dict() for f in group_faces],
                        "avg_confidence": avg_confidence,
                    }
                )
            elif len(group_faces) == 2:
                # Handle pairs with very high confidence
                if (
                    similar_unassigned
                    and similar_unassigned[0].get("similarity", 0) >= 0.97
                ):
                    unassigned_groups.append(
                        {
                            "type": "similarity",
                            "group_id": f"similar_{face.id}",
                            "group_name": f"Possible Match ({round(similar_unassigned[0].get('similarity', 0) * 100)}% confident)",
                            "faces": [f.dict() for f in group_faces],
                            "avg_confidence": round(
                                similar_unassigned[0].get("similarity", 0) * 100
                            ),
                        }
                    )
                else:
                    # Split into individual faces
                    for single_face in group_faces:
                        unassigned_groups.append(
                            {
                                "type": "single",
                                "group_id": f"single_{single_face.id}",
                                "group_name": "Unmatched Face",
                                "faces": [single_face.dict()],
                                "avg_confidence": 0,
                            }
                        )
            else:
                # Single face that doesn't match others
                unassigned_groups.append(
                    {
                        "type": "single",
                        "group_id": f"single_{face.id}",
                        "group_name": "Unmatched Face",
                        "faces": [face.dict()],
                        "avg_confidence": 0,
                    }
                )

        return FaceGroupResponse(
            assigned_groups=list(assigned_groups.values()),
            unassigned_groups=unassigned_groups,
            total_faces=len(all_faces),
            assigned_count=len(assigned_faces),
            unassigned_count=len(unassigned_faces),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get grouped faces: {str(e)}"
        )


@router.post("/{face_id}/ignore")
async def ignore_face(
    face_id: str, db: AsyncSession = Depends(get_db), crud=Depends(get_face_crud)
) -> Dict[str, Any]:
    """Mark a face as ignored."""
    try:
        face = await crud.get_face(face_id)
        if not face:
            raise HTTPException(status_code=404, detail="Face not found")

        await crud.ignore_face(face_id)
        return {"success": True, "message": "Face ignored successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ignore face: {str(e)}")


@router.post("/{face_id}/unignore")
async def unignore_face(
    face_id: str, db: AsyncSession = Depends(get_db), crud=Depends(get_face_crud)
) -> Dict[str, Any]:
    """Unmark a face as ignored."""
    try:
        face = await crud.get_face(face_id)
        if not face:
            raise HTTPException(status_code=404, detail="Face not found")

        await crud.unignore_face(face_id)
        return {"success": True, "message": "Face unignored successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to unignore face: {str(e)}"
        )


@router.post("/bulk-ignore")
async def bulk_ignore_faces(
    request: BatchIgnoreRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
) -> Dict[str, Any]:
    """Bulk ignore multiple faces."""
    try:
        ignored_count = 0
        for face_id in request.face_ids:
            try:
                await crud.ignore_face(face_id)
                ignored_count += 1
            except Exception:
                pass  # Continue with other faces

        return {
            "success": True,
            "ignored": ignored_count,
            "total_requested": len(request.face_ids),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to bulk ignore faces: {str(e)}"
        )


@router.post("/bulk-unignore")
async def bulk_unignore_faces(
    request: BatchIgnoreRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
) -> Dict[str, Any]:
    """Bulk unignore multiple faces."""
    try:
        unignored_count = 0
        for face_id in request.face_ids:
            try:
                await crud.unignore_face(face_id)
                unignored_count += 1
            except Exception:
                pass  # Continue with other faces

        return {
            "success": True,
            "unignored": unignored_count,
            "total_requested": len(request.face_ids),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to bulk unignore faces: {str(e)}"
        )


@router.post("/batch-assign")
async def batch_assign_faces(
    request: BatchAssignRequest,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> Dict[str, Any]:
    """Batch assign faces using suggestions or manual assignments."""
    try:
        result = await face_service.batch_assign_faces(request.assignments)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to batch assign faces: {str(e)}"
        )


@router.post("/reprocess")
async def reprocess_unassigned_faces(
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> Dict[str, Any]:
    """Reprocess unassigned faces after manual assignments."""
    try:
        suggestions = await face_service.reprocess_unassigned_faces()
        return {
            "message": "Faces reprocessed successfully",
            "suggestions": len(suggestions),
            "data": suggestions,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to reprocess faces: {str(e)}"
        )


@router.get("/{face_id}/crop")
async def get_face_crop(
    face_id: str,
    db: AsyncSession = Depends(get_db),
    crud=Depends(get_face_crud),
    face_service: FaceDetectionService = Depends(get_face_detection_service),
) -> Dict[str, str]:
    """Get face crop URL for a specific face."""
    try:
        face = await crud.get_face(face_id)
        if not face:
            raise HTTPException(status_code=404, detail="Face not found")

        photo = await crud.get_file_version(face.photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")

        crop_url = await face_service.generate_face_crop(
            photo.file_path, face.bounding_box
        )

        return {"crop_url": crop_url}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate face crop: {str(e)}"
        )
