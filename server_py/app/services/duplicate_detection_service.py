"""
Enhanced Duplicate Detection Service for Pictallion

Handles intelligent duplicate detection using multiple algorithms:
- MD5 hash comparison for exact duplicates
- Perceptual hashing for visual similarity detection
- Burst photo detection using industry-standard methodology
- Metadata analysis for conflict resolution
"""

import asyncio
import hashlib
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import aiofiles
import aiofiles.os
import numpy as np
from PIL import ExifTags, Image
from sqlmodel import select

from ..core.config import get_settings
from ..core.database import get_session
from ..models.file_version import FileVersion
from ..models.media_asset import MediaAsset


@dataclass
class DuplicateConflict:
    """Represents a duplicate conflict that needs resolution"""

    id: str
    existing_photo: Dict[str, Any]
    new_file: Dict[str, Any]
    conflict_type: str  # 'identical_md5', 'visually_identical', 'similar_metadata'
    similarity: float
    suggested_action: str  # 'keep_existing', 'replace_with_new', 'keep_both'
    reasoning: str


@dataclass
class PerceptualHashResult:
    """Result of perceptual hash generation"""

    hash: str
    similarity: float


class DuplicateDetectionService:
    """Enhanced duplicate detection service with perceptual hashing and burst detection"""

    def __init__(self):
        self.settings = get_settings()

    async def generate_perceptual_hash(self, image_path: str) -> str:
        """
        Generate perceptual hash for an image using a simple algorithm
        This creates a hash based on the visual content rather than exact bytes

        Args:
            image_path: Path to the image file

        Returns:
            Perceptual hash string or empty string if generation fails
        """
        try:
            # Use asyncio thread pool for CPU-intensive image processing
            def _process_image():
                with Image.open(image_path) as img:
                    # Resize image to 8x8 and convert to grayscale for comparison
                    img = img.resize((8, 8), Image.Resampling.LANCZOS)
                    img = img.convert("L")  # Convert to grayscale

                    # Get pixel data as numpy array
                    pixels = np.array(img)

                    # Calculate average pixel value
                    average = np.mean(pixels)

                    # Create hash by comparing each pixel to average
                    hash_bits = []
                    for row in pixels:
                        for pixel in row:
                            hash_bits.append("1" if pixel > average else "0")

                    return "".join(hash_bits)

            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _process_image)

        except Exception as e:
            print(f"Error generating perceptual hash: {e}")
            return ""

    def calculate_perceptual_similarity(self, hash1: str, hash2: str) -> float:
        """
        Calculate similarity between two perceptual hashes (Hamming distance)

        Args:
            hash1: First perceptual hash
            hash2: Second perceptual hash

        Returns:
            Similarity percentage (0-100)
        """
        if not hash1 or not hash2 or len(hash1) != len(hash2):
            return 0.0

        differences = sum(1 for i in range(len(hash1)) if hash1[i] != hash2[i])
        similarity = ((len(hash1) - differences) / len(hash1)) * 100
        return round(similarity, 2)

    async def extract_file_metadata(self, file_path: str) -> Dict[str, Any]:
        """
        Extract metadata from a file for comparison purposes

        Args:
            file_path: Path to the file

        Returns:
            Metadata dictionary
        """
        try:
            print(f"Extract metadata called with file_path: {file_path}")

            # For temp files, extract metadata directly
            if "uploads/temp/" in file_path:
                print(f"Processing as temp file: {file_path}")
                return await self._extract_direct_metadata(file_path)

            print(f"Processing as data directory file: {file_path}")
            # For files in data directory, use file manager
            from .file_manager_service import file_manager_service

            metadata = await file_manager_service.extract_metadata(file_path)
            print(
                f"Extracted metadata for duplicate detection - {file_path}: {metadata}"
            )
            return metadata

        except Exception as e:
            print(f"Error extracting metadata for duplicate detection: {e}")
            return {"exif": None, "dateTime": None, "location": None}

    async def _extract_direct_metadata(self, file_path: str) -> Dict[str, Any]:
        """
        Extract metadata directly from temp files

        Args:
            file_path: Path to the temp file

        Returns:
            Metadata dictionary
        """
        try:
            # Check if file exists
            if not await aiofiles.os.path.exists(file_path):
                print(f"File does not exist: {file_path}")
                return {"exif": {"dateTime": datetime.now().isoformat()}}

            stat_info = await aiofiles.os.stat(file_path)

            metadata = {
                "exif": {
                    "dateTime": datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                }
            }

            # Try to extract EXIF data for images
            file_ext = Path(file_path).suffix.lower()
            is_image = file_ext in [".jpg", ".jpeg", ".tiff"]

            # For temp files without extensions, check if it's an image by reading file header
            if not is_image and not file_ext:
                async with aiofiles.open(file_path, "rb") as f:
                    header = await f.read(4)
                    # Check for JPEG signature
                    is_image = (
                        len(header) >= 3
                        and header[0] == 0xFF
                        and header[1] == 0xD8
                        and header[2] == 0xFF
                    )

            if is_image:
                try:
                    # Use asyncio thread pool for EXIF extraction
                    def _extract_exif():
                        with Image.open(file_path) as img:
                            exif_dict = {}

                            # Get EXIF data
                            if hasattr(img, "_getexif") and img._getexif() is not None:
                                exif = img._getexif()

                                for tag_id, value in exif.items():
                                    tag = ExifTags.TAGS.get(tag_id, tag_id)

                                    if tag == "Make":
                                        exif_dict["make"] = str(value)
                                    elif tag == "Model":
                                        exif_dict["model"] = str(value)
                                    elif tag == "DateTime":
                                        exif_dict["dateTime"] = str(value)
                                    elif tag == "DateTimeOriginal":
                                        exif_dict["dateTimeOriginal"] = str(value)
                                    elif tag == "CreateDate":
                                        exif_dict["createDate"] = str(value)
                                    elif tag == "FNumber":
                                        exif_dict["aperture"] = f"f/{value}"
                                    elif tag == "ExposureTime":
                                        exif_dict["shutter"] = (
                                            f"1/{round(1/value)}s"
                                            if value > 0
                                            else str(value)
                                        )
                                    elif tag == "ISOSpeedRatings":
                                        exif_dict["iso"] = str(value)
                                    elif tag == "FocalLength":
                                        exif_dict["focalLength"] = f"{value}mm"
                                    elif tag == "LensModel":
                                        exif_dict["lens"] = str(value)
                                    elif tag == "Software":
                                        exif_dict["software"] = str(value)
                                    elif tag == "Orientation":
                                        exif_dict["orientation"] = str(value)

                                # Set camera from make and model
                                if "make" in exif_dict and "model" in exif_dict:
                                    exif_dict["camera"] = (
                                        f"{exif_dict['make']} {exif_dict['model']}"
                                    )

                                # Set dateTaken from various date fields
                                for date_field in [
                                    "dateTimeOriginal",
                                    "createDate",
                                    "dateTime",
                                ]:
                                    if date_field in exif_dict:
                                        exif_dict["dateTaken"] = exif_dict[date_field]
                                        break

                            return exif_dict

                    loop = asyncio.get_event_loop()
                    exif_data = await loop.run_in_executor(None, _extract_exif)

                    if exif_data:
                        metadata["exif"].update(exif_data)

                except Exception as exif_error:
                    print(f"No EXIF data available: {exif_error}")

            return metadata

        except Exception as e:
            print(f"Error extracting direct metadata for {file_path}: {e}")
            return {"exif": None, "dateTime": None, "location": None}

    def _convert_dms_to_dd(self, dms: List[float], ref: str) -> float:
        """Convert DMS coordinates to decimal degrees"""
        dd = dms[0] + dms[1] / 60 + dms[2] / 3600
        if ref in ["S", "W"]:
            dd = dd * -1
        return dd

    async def check_for_duplicates(
        self, temp_file_path: str, original_filename: str, file_hash: str
    ) -> List[DuplicateConflict]:
        """
        Check for duplicates during upload process
        Returns conflicts that need user resolution

        Args:
            temp_file_path: Path to the temporary uploaded file
            original_filename: Original filename of the uploaded file
            file_hash: MD5 hash of the file

        Returns:
            List of duplicate conflicts
        """
        print(
            f"=== DUPLICATE CHECK START: {original_filename} with hash {file_hash} ==="
        )
        conflicts: List[DuplicateConflict] = []

        try:
            async with get_session() as session:
                # First check for exact MD5 duplicates - these should be auto-skipped
                result = await session.execute(
                    select(FileVersion).where(FileVersion.file_hash == file_hash)
                )
                exact_duplicate = result.scalar_one_or_none()

                if exact_duplicate:
                    # Get the associated media asset
                    asset_result = await session.execute(
                        select(MediaAsset).where(
                            MediaAsset.id == exact_duplicate.media_asset_id
                        )
                    )
                    asset = asset_result.scalar_one_or_none()

                    if asset:
                        print(f"=== FOUND EXACT MD5 DUPLICATE ===")
                        print(
                            f"Existing file: {asset.original_filename} (hash: {exact_duplicate.file_hash})"
                        )
                        print(f"New file: {original_filename} (hash: {file_hash})")
                        print(f"Auto-skipping MD5 identical file: {original_filename}")
                        print(f"=== AUTO-SKIP TRIGGERED ===")
                        # Return empty conflicts array to indicate auto-skip
                        return []

                # Check for perceptual duplicates (only for images)
                file_ext = Path(original_filename).suffix.lower()
                is_image = file_ext in [".jpg", ".jpeg", ".png", ".tiff"]

                if is_image:
                    new_perceptual_hash = await self.generate_perceptual_hash(
                        temp_file_path
                    )
                    # Extract metadata for new file for burst detection
                    new_file_metadata = await self._extract_direct_metadata(
                        temp_file_path
                    )

                    if new_perceptual_hash:
                        # Get all existing photos to compare perceptual hashes
                        result = await session.execute(select(FileVersion))
                        all_photos = result.scalars().all()
                        print(
                            f"Found {len(all_photos)} existing photos to compare against"
                        )

                        # Track which perceptual hashes we've already created conflicts for
                        conflicted_hashes = set()

                        for photo in all_photos:
                            # Skip if this is already an exact duplicate
                            if photo.file_hash == file_hash:
                                print(
                                    f"Skipping exact duplicate comparison: {photo.file_hash} === {file_hash}"
                                )
                                continue

                            # Only compare with images
                            if not photo.mime_type or not photo.mime_type.startswith(
                                "image/"
                            ):
                                continue

                            existing_perceptual_hash = photo.perceptual_hash

                            # Generate perceptual hash for existing photo if not available
                            if not existing_perceptual_hash:
                                full_path = os.path.join(
                                    self.settings.data_directory, photo.file_path
                                )
                                try:
                                    if await aiofiles.os.path.exists(full_path):
                                        existing_perceptual_hash = (
                                            await self.generate_perceptual_hash(
                                                full_path
                                            )
                                        )

                                        # Store the perceptual hash for future use
                                        if existing_perceptual_hash:
                                            photo.perceptual_hash = (
                                                existing_perceptual_hash
                                            )
                                            session.add(photo)
                                            await session.commit()
                                except Exception:
                                    continue  # Skip if file doesn't exist

                            if existing_perceptual_hash:
                                similarity = self.calculate_perceptual_similarity(
                                    new_perceptual_hash, existing_perceptual_hash
                                )

                                # Get the asset for this photo to check burst patterns
                                photo_asset_result = await session.execute(
                                    select(MediaAsset).where(
                                        MediaAsset.id == photo.media_asset_id
                                    )
                                )
                                photo_asset = photo_asset_result.scalar_one_or_none()

                                if not photo_asset:
                                    continue

                                # Skip if we've already created a conflict for this perceptual hash
                                if existing_perceptual_hash in conflicted_hashes:
                                    print(
                                        f"Skipping duplicate conflict for hash {existing_perceptual_hash} - already conflicted"
                                    )
                                    continue

                                # Require 100% perceptual match to avoid false positives with burst photos
                                print(
                                    f"Similarity check: {similarity}% between {original_filename} and {photo_asset.original_filename}"
                                )

                                if similarity >= 100.0:
                                    # Check if this might be a burst photo
                                    is_burst_photo = await self._is_burst_photo(
                                        original_filename,
                                        photo_asset.original_filename,
                                        photo.created_at.isoformat(),
                                        photo.metadata,
                                        new_file_metadata,
                                    )

                                    if is_burst_photo:
                                        print(
                                            f"Detected burst photo sequence: {original_filename} vs {photo_asset.original_filename} ({similarity}%) - allowing as separate photos"
                                        )
                                        continue  # Skip conflict creation for confirmed burst photos

                                    # Only create conflicts for 100% perceptual matches that aren't burst photos
                                    print(
                                        f"Perfect perceptual match non-burst conflict: {original_filename} vs {photo_asset.original_filename} ({similarity}%)"
                                    )

                                    reasoning = self._analyze_metadata_differences(
                                        photo.metadata,
                                        original_filename,
                                        photo_asset.original_filename,
                                    )

                                    # Get file size for new file
                                    stat_info = await aiofiles.os.stat(temp_file_path)

                                    conflict = DuplicateConflict(
                                        id=str(uuid.uuid4()),
                                        existing_photo={
                                            "id": photo.id,
                                            "filePath": photo.file_path,
                                            "tier": photo.tier,
                                            "fileHash": photo.file_hash,
                                            "perceptualHash": existing_perceptual_hash,
                                            "metadata": photo.metadata,
                                            "mediaAsset": {
                                                "originalFilename": photo_asset.original_filename
                                            },
                                            "createdAt": photo.created_at.isoformat(),
                                            "fileSize": photo.file_size or 0,
                                        },
                                        new_file={
                                            "tempPath": temp_file_path,
                                            "originalFilename": original_filename,
                                            "fileHash": file_hash,
                                            "perceptualHash": new_perceptual_hash,
                                            "fileSize": stat_info.st_size,
                                            "metadata": new_file_metadata,
                                        },
                                        conflict_type="visually_identical",
                                        similarity=similarity,
                                        suggested_action=self._suggest_action(
                                            reasoning,
                                            original_filename,
                                            photo_asset.original_filename,
                                        ),
                                        reasoning=reasoning,
                                    )

                                    conflicts.append(conflict)
                                    conflicted_hashes.add(existing_perceptual_hash)

            print(
                f"=== DUPLICATE CHECK COMPLETE: {original_filename} - {len(conflicts)} conflicts found ==="
            )
            return conflicts

        except Exception as e:
            print(f"Error checking for duplicates: {e}")
            return []

    def _analyze_metadata_differences(
        self,
        existing_metadata: Dict[str, Any],
        new_filename: str,
        existing_filename: str,
    ) -> str:
        """
        Analyze metadata differences to determine likely original

        Args:
            existing_metadata: Metadata of existing file
            new_filename: Name of new file
            existing_filename: Name of existing file

        Returns:
            Analysis reasoning string
        """
        reasons = []

        # Check filename patterns that suggest editing
        editing_keywords = ["edited", "modified", "copy", "version", "final", "export"]
        new_has_editing_keywords = any(
            keyword in new_filename.lower() for keyword in editing_keywords
        )
        existing_has_editing_keywords = any(
            keyword in existing_filename.lower() for keyword in editing_keywords
        )

        if new_has_editing_keywords and not existing_has_editing_keywords:
            reasons.append(
                "New file appears to be edited version (filename contains editing keywords)"
            )
        elif not new_has_editing_keywords and existing_has_editing_keywords:
            reasons.append(
                "Existing file appears to be edited version (filename contains editing keywords)"
            )

        # Check EXIF modification dates
        if (
            existing_metadata
            and existing_metadata.get("exif", {}).get("modifyDate")
            and existing_metadata.get("exif", {}).get("dateTimeOriginal")
        ):

            try:
                modify_date = datetime.fromisoformat(
                    existing_metadata["exif"]["modifyDate"]
                )
                original_date = datetime.fromisoformat(
                    existing_metadata["exif"]["dateTimeOriginal"]
                )
                if modify_date > original_date:
                    reasons.append(
                        "Existing file shows signs of modification (modify date after original date)"
                    )
            except (ValueError, TypeError):
                pass

        # Check for editing software indicators
        if existing_metadata and existing_metadata.get("exif", {}).get("software"):
            editing_software = ["Photoshop", "GIMP", "Lightroom", "Capture One"]
            software = existing_metadata["exif"]["software"].lower()
            if any(editor.lower() in software for editor in editing_software):
                reasons.append("Existing file processed with photo editing software")

        if not reasons:
            reasons.append(
                "Files appear visually identical with different metadata - manual review recommended"
            )

        return "; ".join(reasons)

    def _suggest_action(
        self, reasoning: str, new_filename: str, existing_filename: str
    ) -> str:
        """
        Suggest action based on analysis

        Args:
            reasoning: Analysis reasoning
            new_filename: Name of new file
            existing_filename: Name of existing file

        Returns:
            Suggested action: 'keep_existing', 'replace_with_new', or 'keep_both'
        """
        if "New file appears to be edited" in reasoning:
            return "keep_existing"  # Keep original
        elif "Existing file appears to be edited" in reasoning:
            return "replace_with_new"  # Replace with original
        else:
            return "keep_both"  # Let user decide

    async def _is_burst_photo(
        self,
        new_filename: str,
        existing_filename: str,
        existing_created_at: str,
        existing_metadata: Optional[Dict[str, Any]] = None,
        new_metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Industry-standard burst photo detection following Google HDR+ methodology
        Based on: timing proximity + visual similarity + camera metadata + filename patterns

        Args:
            new_filename: Name of new file
            existing_filename: Name of existing file
            existing_created_at: Creation timestamp of existing file
            existing_metadata: Metadata of existing file
            new_metadata: Metadata of new file

        Returns:
            True if files are likely part of a burst sequence
        """
        try:
            # 1. TIMING ANALYSIS (Primary Factor)
            # Industry standard: burst photos are captured within ±30 seconds
            max_burst_interval = 30 * 1000  # 30 seconds in milliseconds

            def get_photo_time(
                metadata: Optional[Dict[str, Any]],
                filename: str,
                fallback_timestamp: Optional[str] = None,
            ) -> float:
                """Extract photo timestamp with priority order"""
                if metadata and metadata.get("exif"):
                    exif = metadata["exif"]
                    # Priority order for timestamp extraction
                    for date_field in ["dateTimeOriginal", "dateTaken", "dateTime"]:
                        if exif.get(date_field):
                            try:
                                return (
                                    datetime.fromisoformat(
                                        str(exif[date_field])
                                    ).timestamp()
                                    * 1000
                                )
                            except (ValueError, TypeError):
                                continue

                # Extract from filename if timestamp format (YYYYMMDD_HHMMSS_ID pattern)
                timestamp_match = re.search(r"(\d{8})_(\d{6})_", filename)
                if timestamp_match:
                    try:
                        date_str = timestamp_match.group(1)  # YYYYMMDD
                        time_str = timestamp_match.group(2)  # HHMMSS

                        year = int(date_str[:4])
                        month = int(date_str[4:6])
                        day = int(date_str[6:8])
                        hour = int(time_str[:2])
                        minute = int(time_str[2:4])
                        second = int(time_str[4:6])

                        extracted_date = datetime(
                            year, month, day, hour, minute, second
                        )
                        return extracted_date.timestamp() * 1000
                    except (ValueError, IndexError):
                        pass

                # Fall back to file timestamp
                if fallback_timestamp:
                    try:
                        return (
                            datetime.fromisoformat(fallback_timestamp).timestamp()
                            * 1000
                        )
                    except (ValueError, TypeError):
                        pass

                return datetime.now().timestamp() * 1000

            time1 = get_photo_time(
                existing_metadata, existing_filename, existing_created_at
            )
            time2 = get_photo_time(new_metadata, new_filename)
            time_diff = abs(time1 - time2)

            # If photos are taken more than 30 seconds apart, unlikely to be burst
            if time_diff > max_burst_interval:
                return False

            # 2. FILENAME PATTERN ANALYSIS (Google HDR+ style)
            name1 = (
                existing_filename.lower()
                .replace(".jpg", "")
                .replace(".jpeg", "")
                .replace(".png", "")
                .replace(".tiff", "")
            )
            name2 = (
                new_filename.lower()
                .replace(".jpg", "")
                .replace(".jpeg", "")
                .replace(".png", "")
                .replace(".tiff", "")
            )

            # Google Pixel pattern: YYYYMMDD_HHMMSS_HEXID
            pixel_pattern = re.compile(r"^(\d{8}_\d{6})_([A-F0-9]{8})$", re.IGNORECASE)
            match1 = pixel_pattern.match(name1)
            match2 = pixel_pattern.match(name2)

            if match1 and match2:
                # Same timestamp prefix but different hex IDs = burst sequence
                if match1.group(1) == match2.group(1) and match1.group(
                    2
                ) != match2.group(2):
                    return True

            # Sequential numbering patterns (common in burst photography)
            def extract_base_and_sequence(filename: str) -> Optional[Tuple[str, int]]:
                """Extract base name and sequence number from filename"""
                # Pattern 1: IMG_1234_BURST001.jpg
                burst_match = re.search(r"^(.+_burst)(\d+)$", filename, re.IGNORECASE)
                if burst_match:
                    return (burst_match.group(1), int(burst_match.group(2)))

                # Pattern 2: DSC_1234-5.jpg (common in professional cameras)
                dash_match = re.search(r"^(.+)-(\d+)$", filename)
                if dash_match:
                    return (dash_match.group(1), int(dash_match.group(2)))

                # Pattern 3: IMG_1234_001.jpg
                underscore_match = re.search(r"^(.+_)(\d+)$", filename)
                if underscore_match:
                    return (underscore_match.group(1), int(underscore_match.group(2)))

                # Pattern 4: Traditional sequential: IMG1234.jpg -> IMG1235.jpg
                seq_match = re.search(r"^(.+?)(\d+)$", filename)
                if seq_match:
                    return (seq_match.group(1), int(seq_match.group(2)))

                return None

            file1_info = extract_base_and_sequence(name1)
            file2_info = extract_base_and_sequence(name2)

            if file1_info and file2_info and file1_info[0] == file2_info[0]:
                sequence_diff = abs(file1_info[1] - file2_info[1])
                # Industry standard: burst sequences typically have gaps of 1-10
                if 1 <= sequence_diff <= 10:
                    return True

            # 3. CAMERA METADATA ANALYSIS (HDR+ approach)
            if (
                existing_metadata
                and existing_metadata.get("exif")
                and new_metadata
                and new_metadata.get("exif")
            ):

                exif1 = existing_metadata["exif"]
                exif2 = new_metadata["exif"]

                # Same camera and lens = higher burst likelihood
                same_camera = exif1.get("make") == exif2.get("make") and exif1.get(
                    "model"
                ) == exif2.get("model")
                same_lens = exif1.get("lens") == exif2.get("lens") or exif1.get(
                    "focalLength"
                ) == exif2.get("focalLength")

                # Similar camera settings (burst photos typically have consistent settings)
                similar_settings = (
                    exif1.get("iso") == exif2.get("iso")
                    and exif1.get("aperture") == exif2.get("aperture")
                    and exif1.get("whiteBalance") == exif2.get("whiteBalance")
                )

                # If we have timing proximity + same camera + similar settings = likely burst
                if (
                    time_diff <= 10000
                    and same_camera
                    and (same_lens or similar_settings)
                ):  # 10 seconds
                    return True

            # 4. RAPID SUCCESSION DETECTION
            # Industry standard: photos within 5 seconds are very likely burst
            if time_diff <= 5000:  # 5 seconds
                return True

            # 5. FILENAME PATTERNS FOR COMMON CAMERA BRANDS
            common_burst_patterns = [
                re.compile(r"IMG_\d{4}_BURST\d{3}", re.IGNORECASE),  # iPhone burst mode
                re.compile(r"DSC\d+_BURST", re.IGNORECASE),  # Sony cameras
                re.compile(r"P\d{7}_BURST", re.IGNORECASE),  # Panasonic
                re.compile(r"_HDR\d*", re.IGNORECASE),  # HDR sequences
                re.compile(r"_BRACKET\d*", re.IGNORECASE),  # Exposure bracketing
                re.compile(r"PANO_\d+_\d+", re.IGNORECASE),  # Panorama sequences
            ]

            for pattern in common_burst_patterns:
                if pattern.search(existing_filename) and pattern.search(new_filename):
                    return True

            return False

        except Exception as e:
            print(f"Error checking burst photo pattern: {e}")
            return False

    async def process_duplicate_resolution(
        self, conflict_id: str, action: str, conflict: DuplicateConflict
    ) -> Dict[str, Any]:
        """
        Process user's resolution of duplicate conflicts

        Args:
            conflict_id: ID of the conflict being resolved
            action: User's chosen action ('keep_existing', 'replace_with_new', 'keep_both')
            conflict: The duplicate conflict object

        Returns:
            Result dictionary with success status and message
        """
        try:
            if action == "keep_existing":
                # Remove the new file and return existing asset info
                await aiofiles.os.remove(conflict.new_file["tempPath"])

                async with get_session() as session:
                    result = await session.execute(
                        select(FileVersion).where(
                            FileVersion.id == conflict.existing_photo["id"]
                        )
                    )
                    existing_file = result.scalar_one_or_none()

                    return {
                        "success": True,
                        "message": "Kept existing file, new file discarded",
                        "assetId": (
                            existing_file.media_asset_id if existing_file else None
                        ),
                    }

            elif action == "replace_with_new":
                return await self._replace_existing_file(conflict)

            elif action == "keep_both":
                return await self._import_as_new_file(conflict)

            else:
                raise ValueError("Invalid action")

        except Exception as e:
            print(f"Error processing duplicate resolution: {e}")
            return {
                "success": False,
                "message": f"Failed to process resolution: {str(e)}",
            }

    async def _replace_existing_file(
        self, conflict: DuplicateConflict
    ) -> Dict[str, Any]:
        """Replace existing file with new file"""
        # Only allow replacement if existing file is in silver tier
        if conflict.existing_photo["tier"] != "silver":
            raise ValueError("Can only replace files in Silver tier")

        from .file_manager_service import file_manager_service

        # Remove the old file
        old_file_path = os.path.join(
            self.settings.data_directory, conflict.existing_photo["filePath"]
        )
        try:
            await aiofiles.os.remove(old_file_path)
        except FileNotFoundError:
            print("Old file already removed or not found")

        # Process new file to silver tier
        silver_path = await file_manager_service.process_to_silver(
            conflict.new_file["tempPath"], conflict.new_file["originalFilename"]
        )

        # Extract metadata from new file
        metadata = await file_manager_service.extract_metadata(silver_path)

        # Update the existing file version with new file data
        async with get_session() as session:
            result = await session.execute(
                select(FileVersion).where(
                    FileVersion.id == conflict.existing_photo["id"]
                )
            )
            existing_file = result.scalar_one_or_none()

            if not existing_file:
                raise ValueError("Existing file not found")

            # Update file version
            existing_file.file_path = silver_path
            existing_file.file_hash = conflict.new_file["fileHash"]
            existing_file.file_size = conflict.new_file["fileSize"]
            existing_file.metadata = metadata
            existing_file.perceptual_hash = conflict.new_file["perceptualHash"]

            session.add(existing_file)

            # Update media asset with new filename
            asset_result = await session.execute(
                select(MediaAsset).where(MediaAsset.id == existing_file.media_asset_id)
            )
            asset = asset_result.scalar_one_or_none()

            if asset:
                asset.original_filename = conflict.new_file["originalFilename"]
                session.add(asset)

            await session.commit()

            return {
                "success": True,
                "message": "File replaced with new version and marked for reprocessing",
                "assetId": existing_file.media_asset_id,
            }

    async def _import_as_new_file(self, conflict: DuplicateConflict) -> Dict[str, Any]:
        """Import new file despite similarity"""
        from .file_manager_service import file_manager_service

        async with get_session() as session:
            # Create new media asset
            media_asset = MediaAsset(
                original_filename=conflict.new_file["originalFilename"]
            )
            session.add(media_asset)
            await session.flush()  # Get the ID

            # Process file to Silver tier
            silver_path = await file_manager_service.process_to_silver(
                conflict.new_file["tempPath"], conflict.new_file["originalFilename"]
            )

            # Extract metadata with AI processing
            metadata = await file_manager_service.extract_metadata(silver_path)

            # Add AI analysis for images
            ai_metadata = None
            ai_short_description = None
            file_ext = Path(conflict.new_file["originalFilename"]).suffix.lower()
            mime_type = (
                "image/jpeg"
                if file_ext in [".jpg", ".jpeg"]
                else "image/png" if file_ext == ".png" else "image/jpeg"
            )

            if mime_type.startswith("image/"):
                try:
                    from .ai_service import ai_service

                    ai_metadata = await ai_service.analyze_image(silver_path, "openai")
                    ai_short_description = (
                        ai_metadata.get("shortDescription") if ai_metadata else None
                    )
                except Exception as ai_error:
                    print(
                        f"AI analysis failed for {conflict.new_file['originalFilename']}: {ai_error}"
                    )

            combined_metadata = {
                **metadata,
                "ai": ai_metadata,
            }

            # Create Silver file version
            file_version = FileVersion(
                media_asset_id=media_asset.id,
                tier="silver",
                file_path=silver_path,
                file_hash=conflict.new_file["fileHash"],
                file_size=conflict.new_file["fileSize"],
                mime_type=mime_type,
                metadata=combined_metadata,
                perceptual_hash=conflict.new_file["perceptualHash"],
                ai_short_description=ai_short_description,
                is_reviewed=False,
            )

            session.add(file_version)
            await session.commit()

            return {
                "success": True,
                "message": "File imported as new asset despite similarity",
                "assetId": media_asset.id,
            }


# Global service instance
duplicate_detection_service = DuplicateDetectionService()


# Convenience functions
async def check_for_duplicates(
    temp_file_path: str, original_filename: str, file_hash: str
) -> List[DuplicateConflict]:
    """Check for duplicates during upload process"""
    return await duplicate_detection_service.check_for_duplicates(
        temp_file_path, original_filename, file_hash
    )


async def process_duplicate_resolution(
    conflict_id: str, action: str, conflict: DuplicateConflict
) -> Dict[str, Any]:
    """Process user's resolution of duplicate conflicts"""
    return await duplicate_detection_service.process_duplicate_resolution(
        conflict_id, action, conflict
    )


async def generate_perceptual_hash(image_path: str) -> str:
    """Generate perceptual hash for an image"""
    return await duplicate_detection_service.generate_perceptual_hash(image_path)
