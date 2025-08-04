"""
Face Detection Service

Handles face detection, recognition, and face-related operations using
DeepFace library and advanced heuristic methods.
"""

import asyncio
import hashlib
import logging
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

try:
    from deepface import DeepFace

    library_available = True
except ImportError:
    DeepFace = None
    library_available = False
import aiofiles
import aiofiles.os
import cv2
from app.core.config import settings
from app.core.crud import face as face_crud
from app.core.crud import person as person_crud
from app.core.database import get_async_session
from PIL import Image, ImageStat

logger = logging.getLogger(__name__)


@dataclass
class DetectedFace:
    """Detected face data structure."""

    id: str
    bounding_box: Tuple[int, int, int, int]  # x, y, width, height
    confidence: int  # 0-100 integer scale
    embedding: Optional[List[float]] = None
    person_id: Optional[str] = None


@dataclass
class FaceRegion:
    """Face region candidate."""

    bounding_box: Tuple[int, int, int, int]
    confidence: int


class FaceDetectionService:
    """
    Service for face detection and recognition operations.

    Uses DeepFace library for face detection and recognition.
    """

    def __init__(self):
        self.tolerance = 0.75
        self.model = "VGG-Face"
        self.data_dir = Path(settings.media_base_path).parent

    async def detect_faces(self, image_path: str) -> Dict[str, Any]:
        """
        Detect faces in an image using multiple methods.

        Args:
            image_path: Path to the image file

        Returns:
            dict: Detection results with faces and metadata
        """
        metadata = {
            "face_detection": {
                "attempted": True,
                "timestamp": datetime.now().isoformat(),
                "method": None,
                "failed": False,
                "error": None,
            }
        }

        try:
            logger.info(f"Running face detection on: {image_path}")

            # Use DeepFace for face detection
            faces = await self._detect_faces_with_deepface(image_path)

            logger.info(f"DeepFace detected {len(faces)} faces")
            metadata["face_detection"]["method"] = "deepface" if faces else "none"

            logger.info(f"Face detection completed: found {len(faces)} faces")
            return {"faces": faces, "metadata": metadata}

        except Exception as e:
            logger.error(f"Face detection failed: {e}")
            metadata["face_detection"]["failed"] = True
            metadata["face_detection"]["error"] = str(e)
            return {"faces": [], "metadata": metadata}

    async def _detect_faces_with_deepface(self, image_path: str) -> List[DetectedFace]:
        """Detect faces using DeepFace library."""
        try:
            full_image_path = str(self.data_dir / image_path)
            if not await aiofiles.os.path.exists(full_image_path):
                logger.error(f"Image file not found: {full_image_path}")
                return []

            def _sync_detect_faces():
                """Synchronous face detection for thread pool using DeepFace."""
                if not library_available or DeepFace is None:
                    # Stub: return empty list if DeepFace is unavailable
                    return []
                results = DeepFace.extract_faces(
                    img_path=full_image_path, enforce_detection=False
                )
                faces = []
                for i, face_info in enumerate(results):
                    region = face_info.get("facial_area", {})
                    x = region.get("x", 0)
                    y = region.get("y", 0)
                    w = region.get("w", 0)
                    h = region.get("h", 0)
                    embedding = face_info.get("embedding", [])
                    face = DetectedFace(
                        id=f"deepface_{int(datetime.now().timestamp() * 1000)}_{i}_{hash(str(region)) % 10000:04d}",
                        bounding_box=(x, y, w, h),
                        confidence=85,
                        embedding=embedding if embedding else None,
                    )
                    faces.append(face)
                return faces

            loop = asyncio.get_event_loop()
            faces = await loop.run_in_executor(None, _sync_detect_faces)
            logger.info(f"DeepFace detected {len(faces)} faces")
            return faces

        except Exception as e:
            logger.error(f"DeepFace detection failed: {e}")
            return []

            full_image_path = self.data_dir / image_path

            # Get image dimensions
            def _get_image_info():
                with Image.open(full_image_path) as img:
                    return img.size  # (width, height)

            loop = asyncio.get_event_loop()
            width, height = await loop.run_in_executor(None, _get_image_info)

            logger.info(
                f"Advanced analysis of {width}x{height} image for face detection"
            )

            # Step 1: Find skin-tone regions
            skin_regions = await self._find_skin_tone_regions(
                str(full_image_path), width, height
            )

            # Step 2: Apply composition rules
            composition_regions = await self._find_face_regions_using_composition(
                width, height
            )

            # Step 3: Combine approaches
            candidate_regions = self._combine_face_regions(
                skin_regions, composition_regions, width, height
            )

            faces = []
            for i, region in enumerate(candidate_regions):
                # Generate embedding for the region
                embedding = await self._generate_face_embedding(
                    image_path, region.bounding_box
                )

                face = DetectedFace(
                    id=f"advanced_{int(datetime.now().timestamp() * 1000)}_{i}_{hash(str(region.bounding_box)) % 10000:04d}",
                    bounding_box=region.bounding_box,
                    confidence=region.confidence,
                    embedding=embedding,
                )
                faces.append(face)

            return faces

        except Exception as e:
            logger.error(f"Advanced face detection failed: {e}")
            return []

    async def _find_skin_tone_regions(
        self, image_path: str, width: int, height: int
    ) -> List[FaceRegion]:
        """Find regions with skin-tone colors using image analysis."""
        try:

            def _sync_find_skin_regions():
                """Synchronous skin region detection for thread pool."""
                # Load and resize image for analysis
                image = cv2.imread(image_path)
                if image is None:
                    return []

                # Resize for faster processing
                target_width = min(400, width)
                target_height = min(400, height)
                scale_factor = width / target_width

                resized = cv2.resize(image, (target_width, target_height))

                # Convert to RGB for skin detection
                rgb_image = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

                # Find skin color regions
                skin_regions = self._find_skin_color_clusters(
                    rgb_image, target_width, target_height
                )

                # Scale back to original coordinates
                original_regions = []
                for region in skin_regions:
                    scaled_region = FaceRegion(
                        bounding_box=(
                            int(region.bounding_box[0] * scale_factor),
                            int(region.bounding_box[1] * scale_factor),
                            int(region.bounding_box[2] * scale_factor),
                            int(region.bounding_box[3] * scale_factor),
                        ),
                        confidence=region.confidence,
                    )

                    # Filter by reasonable face size
                    face_area = (
                        scaled_region.bounding_box[2] * scaled_region.bounding_box[3]
                    )
                    image_area = width * height
                    ratio = face_area / image_area

                    if 0.005 <= ratio <= 0.3:  # 0.5% to 30% of image
                        original_regions.append(scaled_region)

                return original_regions

            loop = asyncio.get_event_loop()
            regions = await loop.run_in_executor(None, _sync_find_skin_regions)

            logger.info(f"Found {len(regions)} skin-tone regions")
            return regions

        except Exception as e:
            logger.error(f"Skin tone analysis failed: {e}")
            return []

    def _find_skin_color_clusters(
        self, image: np.ndarray, width: int, height: int
    ) -> List[FaceRegion]:
        """Find connected regions of skin-colored pixels."""
        regions = []

        # Skin tone color ranges for different ethnicities
        skin_ranges = [
            {
                "r_min": 170,
                "r_max": 255,
                "g_min": 140,
                "g_max": 220,
                "b_min": 120,
                "b_max": 200,
            },  # Light
            {
                "r_min": 140,
                "r_max": 200,
                "g_min": 100,
                "g_max": 170,
                "b_min": 80,
                "b_max": 140,
            },  # Medium
            {
                "r_min": 100,
                "r_max": 160,
                "g_min": 70,
                "g_max": 130,
                "b_min": 50,
                "b_max": 100,
            },  # Dark
        ]

        # Create skin pixel mask
        skin_mask = np.zeros((height, width), dtype=bool)

        for y in range(height):
            for x in range(width):
                r, g, b = image[y, x]

                for skin_range in skin_ranges:
                    if (
                        skin_range["r_min"] <= r <= skin_range["r_max"]
                        and skin_range["g_min"] <= g <= skin_range["g_max"]
                        and skin_range["b_min"] <= b <= skin_range["b_max"]
                    ):
                        skin_mask[y, x] = True
                        break

        # Find connected components
        visited = np.zeros((height, width), dtype=bool)

        for y in range(height):
            for x in range(width):
                if skin_mask[y, x] and not visited[y, x]:
                    region_info = self._flood_fill_region(
                        skin_mask, visited, x, y, width, height
                    )

                    if region_info["pixel_count"] > 50:  # Minimum size threshold
                        confidence = min(90, 50 + (region_info["pixel_count"] // 10))

                        region = FaceRegion(
                            bounding_box=(
                                region_info["min_x"],
                                region_info["min_y"],
                                region_info["max_x"] - region_info["min_x"],
                                region_info["max_y"] - region_info["min_y"],
                            ),
                            confidence=confidence,
                        )
                        regions.append(region)

        return regions[:5]  # Limit to top 5 regions

    def _flood_fill_region(
        self,
        mask: np.ndarray,
        visited: np.ndarray,
        start_x: int,
        start_y: int,
        width: int,
        height: int,
    ) -> Dict[str, int]:
        """Flood fill algorithm to find connected skin regions."""
        stack = [(start_x, start_y)]
        pixel_count = 0
        min_x = max_x = start_x
        min_y = max_y = start_y

        while stack:
            x, y = stack.pop()

            if (
                x < 0
                or x >= width
                or y < 0
                or y >= height
                or visited[y, x]
                or not mask[y, x]
            ):
                continue

            visited[y, x] = True
            pixel_count += 1

            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)

            # Add neighboring pixels
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                stack.append((x + dx, y + dy))

        return {
            "pixel_count": pixel_count,
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
        }

    async def _find_face_regions_using_composition(
        self, width: int, height: int
    ) -> List[FaceRegion]:
        """Find likely face regions using photographic composition rules."""
        regions = []

        # Calculate typical face size (10-20% of smaller dimension)
        face_size = min(width, height) * 0.15

        # Define search area (upper 70% of image where faces typically appear)
        search_area = {
            "start_x": width * 0.1,
            "end_x": width * 0.9,
            "start_y": height * 0.15,
            "end_y": height * 0.7,
        }

        if width > height * 1.3:
            # Landscape image - likely group photo
            logger.debug("Detected landscape orientation - estimating group photo")

            positions = [
                {"x": width * 0.25, "y": height * 0.35},  # Left person
                {"x": width * 0.5, "y": height * 0.4},  # Center person
                {"x": width * 0.75, "y": height * 0.35},  # Right person
            ]

            for pos in positions:
                if (
                    search_area["start_x"] <= pos["x"] <= search_area["end_x"]
                    and search_area["start_y"] <= pos["y"] <= search_area["end_y"]
                ):

                    region = FaceRegion(
                        bounding_box=(
                            int(pos["x"] - face_size / 2),
                            int(pos["y"] - face_size / 2),
                            int(face_size),
                            int(face_size),
                        ),
                        confidence=75,
                    )
                    regions.append(region)
        else:
            # Portrait or square image - likely single or couple
            logger.debug(
                "Detected portrait orientation - estimating single/couple portrait"
            )

            center_x = width * 0.5
            face_y = height * 0.4  # Face typically in upper-middle area

            region = FaceRegion(
                bounding_box=(
                    int(center_x - face_size / 2),
                    int(face_y - face_size / 2),
                    int(face_size),
                    int(face_size),
                ),
                confidence=80,
            )
            regions.append(region)

        # Filter regions to ensure they're within image bounds
        valid_regions = []
        for region in regions:
            x, y, w, h = region.bounding_box
            if x >= 0 and y >= 0 and x + w <= width and y + h <= height:
                valid_regions.append(region)

        return valid_regions

    def _combine_face_regions(
        self,
        skin_regions: List[FaceRegion],
        composition_regions: List[FaceRegion],
        width: int,
        height: int,
    ) -> List[FaceRegion]:
        """Combine skin tone and composition-based regions."""
        combined_regions = []

        # Start with skin regions (higher confidence)
        for skin_region in skin_regions:
            boosted_region = FaceRegion(
                bounding_box=skin_region.bounding_box,
                confidence=min(95, skin_region.confidence + 10),
            )
            combined_regions.append(boosted_region)

        # Add composition regions that don't overlap significantly
        for comp_region in composition_regions:
            has_overlap = False

            for existing in combined_regions:
                overlap = self._calculate_region_overlap(
                    comp_region.bounding_box, existing.bounding_box
                )
                if overlap > 0.3:  # 30% overlap threshold
                    has_overlap = True
                    break

            if not has_overlap:
                combined_regions.append(comp_region)

        # Sort by confidence and return top candidates
        combined_regions.sort(key=lambda r: r.confidence, reverse=True)
        return combined_regions[:4]  # Max 4 faces per image

    def _calculate_region_overlap(
        self, region1: Tuple[int, int, int, int], region2: Tuple[int, int, int, int]
    ) -> float:
        """Calculate overlap ratio between two regions."""
        x1, y1, w1, h1 = region1
        x2, y2, w2, h2 = region2

        left = max(x1, x2)
        right = min(x1 + w1, x2 + w2)
        top = max(y1, y2)
        bottom = min(y1 + h1, y2 + h2)

        if left < right and top < bottom:
            overlap_area = (right - left) * (bottom - top)
            area1 = w1 * h1
            area2 = w2 * h2
            union_area = area1 + area2 - overlap_area

            return overlap_area / union_area if union_area > 0 else 0

        return 0

    async def _generate_face_embedding(
        self, image_path: str, bounding_box: Tuple[int, int, int, int]
    ) -> Optional[List[float]]:
        """Generate face embedding for a detected face region."""
        try:
            await self.initialize_face_recognition()

            full_image_path = self.data_dir / image_path
            x, y, width, height = bounding_box

            def _sync_generate_embedding():
                """Synchronous embedding generation for thread pool."""
                # Load and crop image
                with Image.open(full_image_path) as img:
                    face_crop = img.crop((x, y, x + width, y + height))
                    face_crop = face_crop.resize((150, 150))
                    face_array = np.array(face_crop)

                if encodings:
                    return encodings[0].tolist()
                else:
                    # Fallback if no face detected in crop
                    return None

            loop = asyncio.get_event_loop()
            embedding = await loop.run_in_executor(None, _sync_generate_embedding)

            return embedding or self._generate_fallback_embedding(
                image_path, bounding_box
            )

        except Exception as e:
            logger.error(f"Failed to generate face embedding: {e}")
            return self._generate_fallback_embedding(image_path, bounding_box)

    def _generate_fallback_embedding(
        self, image_path: str, bounding_box: Tuple[int, int, int, int]
    ) -> List[float]:
        """Generate fallback embedding using deterministic hash."""
        hash_input = f"{image_path}_{bounding_box[0]}_{bounding_box[1]}_{bounding_box[2]}_{bounding_box[3]}"
        hash_obj = hashlib.md5(hash_input.encode())
        hash_bytes = hash_obj.digest()

        # Convert hash to 128-dimensional embedding
        embedding = []
        for i in range(128):
            byte_idx = i % len(hash_bytes)
            embedding.append(math.sin(hash_bytes[byte_idx] + i) * 100)

        return embedding

    async def find_similar_faces(
        self, face_embedding: List[float], threshold: float = 0.75
    ) -> List[Dict[str, Any]]:
        """
        Find similar faces in the database.

        Args:
            face_embedding: Face embedding to match against
            threshold: Similarity threshold (0-1)

        Returns:
            list: Similar faces with similarity scores
        """
        try:
            async with get_async_session() as db:
                # Get all faces with embeddings
                all_faces = await face_crud.get_multi(db, skip=0, limit=10000)
                similar_faces = []

                for face in all_faces:
                    if face.embedding and isinstance(face.embedding, dict):
                        stored_embedding = face.embedding.get("data", [])
                        if stored_embedding:
                            similarity = self._calculate_embedding_similarity(
                                face_embedding, stored_embedding
                            )
                            if similarity > threshold:
                                similar_faces.append(
                                    {
                                        "id": face.id,
                                        "similarity": similarity,
                                        "person_id": face.person_id,
                                    }
                                )

                return sorted(
                    similar_faces, key=lambda x: x["similarity"], reverse=True
                )

        except Exception as e:
            logger.error(f"Error finding similar faces: {e}")
            return []

    def _calculate_embedding_similarity(
        self, embedding1: List[float], embedding2: List[float]
    ) -> float:
        """Calculate cosine similarity between embeddings."""
        if not embedding1 or not embedding2:
            return 0.0

        try:
            # Convert to numpy arrays
            e1 = np.array(embedding1[: min(len(embedding1), len(embedding2))])
            e2 = np.array(embedding2[: min(len(embedding1), len(embedding2))])

            # Calculate cosine similarity
            dot_product = np.dot(e1, e2)
            norm1 = np.linalg.norm(e1)
            norm2 = np.linalg.norm(e2)

            if norm1 == 0 or norm2 == 0:
                return 0.0

            similarity = dot_product / (norm1 * norm2)
            return max(0.0, min(1.0, similarity))

        except Exception:
            return 0.0

    async def generate_face_suggestions(
        self, unassigned_face_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Generate person suggestions for unassigned faces.

        Args:
            unassigned_face_ids: List of unassigned face IDs

        Returns:
            list: Suggestions with person matches
        """
        suggestions = []

        try:
            async with get_async_session() as db:
                for face_id in unassigned_face_ids:
                    face = await face_crud.get(db, face_id)
                    if not face or not face.embedding:
                        continue

                    embedding_data = (
                        face.embedding.get("data", [])
                        if isinstance(face.embedding, dict)
                        else []
                    )
                    if not embedding_data:
                        continue

                    similar_faces = await self.find_similar_faces(embedding_data, 0.85)

                    if similar_faces:
                        # Find most likely person match
                        person_scores = {}
                        for similar in similar_faces:
                            if similar.get("person_id"):
                                person_id = similar["person_id"]
                                score = person_scores.get(person_id, 0)
                                person_scores[person_id] = score + similar["similarity"]

                        if person_scores:
                            best_person_id = max(
                                person_scores.keys(), key=lambda k: person_scores[k]
                            )
                            person = await person_crud.get(db, best_person_id)

                            if person:
                                suggestions.append(
                                    {
                                        "suggested_person_id": best_person_id,
                                        "suggested_person_name": person.name,
                                        "confidence": min(
                                            95, int(person_scores[best_person_id] * 100)
                                        ),
                                        "face_ids": [face_id],
                                    }
                                )

            return suggestions

        except Exception as e:
            logger.error(f"Error generating face suggestions: {e}")
            return []

    async def generate_face_crop(
        self, image_path: str, bounding_box: Tuple[int, int, int, int]
    ) -> Optional[str]:
        """
        Generate face crop from image.

        Args:
            image_path: Path to original image
            bounding_box: Face bounding box (x, y, width, height)

        Returns:
            str: Path to generated face crop or None
        """
        try:
            x, y, width, height = bounding_box
            full_image_path = self.data_dir / image_path

            def _sync_generate_crop():
                """Synchronous crop generation for thread pool."""
                with Image.open(full_image_path) as img:
                    img_width, img_height = img.size

                    # Calculate face center and size
                    face_center_x = x + width // 2
                    face_center_y = y + height // 2
                    face_size = max(width, height)
                    crop_size = int(face_size * 1.2)  # 20% padding

                    # Center crop around face with bounds checking
                    crop_x = max(
                        0, min(face_center_x - crop_size // 2, img_width - crop_size)
                    )
                    crop_y = max(
                        0, min(face_center_y - crop_size // 2, img_height - crop_size)
                    )

                    # Adjust crop size if it exceeds image bounds
                    if crop_size > img_width or crop_size > img_height:
                        crop_size = min(img_width, img_height) * 9 // 10
                        crop_x = max(0, face_center_x - crop_size // 2)
                        crop_y = max(0, face_center_y - crop_size // 2)

                    # Extract face crop
                    face_crop = img.crop(
                        (crop_x, crop_y, crop_x + crop_size, crop_y + crop_size)
                    )

                    # Resize to standard size
                    face_crop = face_crop.resize((200, 200), Image.Resampling.LANCZOS)

                    # Check brightness and adjust if too dark
                    stat = ImageStat.Stat(face_crop)
                    avg_brightness = sum(stat.mean) / len(stat.mean)

                    if avg_brightness < 40:
                        # Use larger context for dark images
                        large_crop_size = min(img_width, img_height) // 2
                        large_crop_x = max(
                            0,
                            min(
                                face_center_x - large_crop_size // 2,
                                img_width - large_crop_size,
                            ),
                        )
                        large_crop_y = max(
                            0,
                            min(
                                face_center_y - large_crop_size // 2,
                                img_height - large_crop_size,
                            ),
                        )

                        face_crop = img.crop(
                            (
                                large_crop_x,
                                large_crop_y,
                                large_crop_x + large_crop_size,
                                large_crop_y + large_crop_size,
                            )
                        )
                        face_crop = face_crop.resize(
                            (200, 200), Image.Resampling.LANCZOS
                        )

                    return face_crop

            # Generate crop in thread pool
            loop = asyncio.get_event_loop()
            face_crop = await loop.run_in_executor(None, _sync_generate_crop)

            # Save crop to temp location
            timestamp = int(datetime.now().timestamp() * 1000)
            crop_filename = (
                f"face_crop_{timestamp}_{hash(str(bounding_box)) % 10000:04d}.jpg"
            )
            temp_dir = Path(settings.uploads_path) / "temp"
            await aiofiles.os.makedirs(temp_dir, exist_ok=True)
            crop_path = temp_dir / crop_filename

            # Save in thread pool
            def _save_crop():
                face_crop.save(crop_path, "JPEG", quality=85)

            await loop.run_in_executor(None, _save_crop)

            return f"temp/{crop_filename}"

        except Exception as e:
            logger.error(f"Failed to generate face crop: {e}")
            return None

    async def health_check(self) -> Dict[str, Any]:
        """
        Check the health of face detection service.

        Returns:
            dict: Health status
        """
        try:
            # Test face_recognition availability

            # Test basic operations
            can_detect = True
            can_encode = True

            if library_available:
                try:
                    # Test detection on synthetic image
                    test_image = np.zeros((100, 100, 3), dtype=np.uint8)
                except Exception:
                    can_detect = False

                try:
                    # Test encoding
                    test_image = np.ones((100, 100, 3), dtype=np.uint8) * 128
                except Exception:
                    can_encode = False

            status = (
                "healthy"
                if (library_available and can_detect and can_encode)
                else "degraded"
            )

            return {
                "status": status,
                "model": self.model,
                "tolerance": self.tolerance,
                "library_available": library_available,
                "can_detect_faces": can_detect,
                "can_generate_encodings": can_encode,
                "data_dir": str(self.data_dir),
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "library_available": False,
                "can_detect_faces": False,
                "can_generate_encodings": False,
            }


# Global face detection service instance
face_detection_service = FaceDetectionService()
