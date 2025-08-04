"""
File Manager Service

Handles file operations, directory management, and metadata extraction.
Converts TypeScript FileManager to Python with equivalent functionality.
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import aiofiles
import aiofiles.os
from app.core.config import settings
from app.models.schemas import CombinedMetadata, ExifMetadata
from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS

logger = logging.getLogger(__name__)


class FileManagerService:
    """
    Service for file operations and metadata extraction.

    Provides file management for Bronze/Silver/Gold tier system with
    EXIF metadata extraction and directory organization by date.
    """

    def __init__(self):
        self.data_dir = Path(settings.media_base_path).parent  # ./data
        self.media_dir = Path(settings.media_base_path)  # ./data/media

    async def initialize_directories(self) -> None:
        """Initialize required directory structure."""
        dirs = [
            self.data_dir,
            self.media_dir,
            self.media_dir / "silver",
            self.media_dir / "gold",
            self.media_dir / "archive",
        ]

        for dir_path in dirs:
            try:
                await aiofiles.os.makedirs(dir_path, exist_ok=True)
                logger.info(f"Ensured directory exists: {dir_path}")
            except Exception as e:
                logger.error(f"Failed to create directory {dir_path}: {e}")
                raise

    async def process_to_silver(self, temp_path: str, original_filename: str) -> str:
        """
        Process uploaded file directly to Silver tier with date organization.

        Args:
            temp_path: Path to temporary uploaded file
            original_filename: Original filename from upload

        Returns:
            str: Relative path from data directory to Silver file
        """
        logger.info(f"Processing file to Silver: {original_filename} from {temp_path}")

        # Extract photo date from EXIF metadata
        photo_date = None

        try:
            if self._is_image_file(original_filename):
                exif_data = await self._extract_exif_data(temp_path)

                logger.debug(f"EXIF data for {original_filename}: {exif_data}")

                # Priority: DateTimeOriginal > CreateDate > DateTime
                if exif_data.date_time_original:
                    photo_date = self._parse_exif_date(exif_data.date_time_original)
                    if photo_date:
                        logger.info(
                            f"Using photo date from EXIF DateTimeOriginal: {photo_date}"
                        )

                if not photo_date and exif_data.create_date:
                    photo_date = self._parse_exif_date(exif_data.create_date)
                    if photo_date:
                        logger.info(
                            f"Using photo date from EXIF CreateDate: {photo_date}"
                        )

                if not photo_date and exif_data.date_time:
                    photo_date = self._parse_exif_date(exif_data.date_time)
                    if photo_date:
                        logger.info(
                            f"Using photo date from EXIF DateTime: {photo_date}"
                        )

        except Exception as e:
            logger.warning(f"Could not extract EXIF data for {original_filename}: {e}")

        # Try to extract date from filename if no EXIF date found
        if not photo_date:
            photo_date = self._extract_date_from_filename(original_filename)
            if photo_date:
                logger.info(f"Using date from filename: {photo_date}")

        # Fall back to current date
        if not photo_date:
            photo_date = datetime.now()
            logger.info(f"No date found, using current date: {photo_date}")

        # Create Silver directory structure by date
        year = photo_date.year
        month = f"{photo_date.month:02d}"
        silver_dir = self.media_dir / "silver" / str(year) / month

        logger.info(f"Target Silver directory: {silver_dir}")

        try:
            await aiofiles.os.makedirs(silver_dir, exist_ok=True)
        except Exception as e:
            logger.error(f"Failed to create Silver directory {silver_dir}: {e}")
            raise

        # Generate unique filename if conflict exists
        silver_path = silver_dir / original_filename

        if await aiofiles.os.path.exists(silver_path):
            # File exists, add timestamp to avoid conflict
            stem = Path(original_filename).stem
            suffix = Path(original_filename).suffix
            timestamp = int(datetime.now().timestamp() * 1000)
            new_filename = f"{stem}_{timestamp}{suffix}"
            silver_path = silver_dir / new_filename

        logger.info(f"Moving {temp_path} to {silver_path}")

        try:
            # Move file from temp to silver
            await aiofiles.os.rename(temp_path, silver_path)

            # Calculate relative path from data directory
            relative_path = str(silver_path.relative_to(self.data_dir))
            logger.info(f"File moved successfully to Silver: {relative_path}")

            return relative_path

        except Exception as e:
            logger.error(f"Failed to move file to Silver: {e}")
            raise

    async def copy_to_silver(
        self,
        source_path: str,
        new_filename: Optional[str] = None,
        photo_date: Optional[datetime] = None,
    ) -> str:
        """
        Copy file to Silver tier with date organization.

        Args:
            source_path: Relative path from data directory
            new_filename: Optional new filename
            photo_date: Optional photo date for organization

        Returns:
            str: Relative path to copied Silver file
        """
        full_source_path = self.data_dir / source_path

        # Use provided date or current date
        date = photo_date or datetime.now()
        year_month = f"{date.year}/{date.month:02d}"
        silver_dir = self.media_dir / "silver" / year_month

        await aiofiles.os.makedirs(silver_dir, exist_ok=True)

        filename = new_filename or Path(source_path).name
        silver_path = silver_dir / filename

        # Generate unique filename if needed
        counter = 1
        original_stem = Path(filename).stem
        suffix = Path(filename).suffix

        while await aiofiles.os.path.exists(silver_path):
            unique_filename = f"{original_stem}_{counter}{suffix}"
            silver_path = silver_dir / unique_filename
            counter += 1

        # Copy file
        async with aiofiles.open(full_source_path, "rb") as src:
            async with aiofiles.open(silver_path, "wb") as dst:
                content = await src.read()
                await dst.write(content)

        return str(silver_path.relative_to(self.data_dir))

    async def copy_to_gold(
        self, silver_path: str, photo_date: Optional[datetime] = None
    ) -> str:
        """
        Copy file from Silver to Gold tier.

        Args:
            silver_path: Relative path to Silver file
            photo_date: Optional photo date for organization

        Returns:
            str: Relative path to copied Gold file
        """
        full_silver_path = self.data_dir / silver_path

        # Use provided date or current date
        date = photo_date or datetime.now()
        year_month = f"{date.year}/{date.month:02d}"
        gold_dir = self.media_dir / "gold" / year_month

        await aiofiles.os.makedirs(gold_dir, exist_ok=True)

        filename = Path(silver_path).name
        gold_path = gold_dir / filename

        # Generate unique filename if needed
        counter = 1
        original_stem = Path(filename).stem
        suffix = Path(filename).suffix

        while await aiofiles.os.path.exists(gold_path):
            unique_filename = f"{original_stem}_{counter}{suffix}"
            gold_path = gold_dir / unique_filename
            counter += 1

        # Copy file
        async with aiofiles.open(full_silver_path, "rb") as src:
            async with aiofiles.open(gold_path, "wb") as dst:
                content = await src.read()
                await dst.write(content)

        return str(gold_path.relative_to(self.data_dir))

    async def extract_metadata(self, file_path: str) -> CombinedMetadata:
        """
        Extract comprehensive metadata from a file.

        Args:
            file_path: Relative path from data directory

        Returns:
            CombinedMetadata: Combined EXIF and file metadata
        """
        full_path = self.data_dir / file_path

        try:
            # Get basic file stats
            stat_result = await aiofiles.os.stat(full_path)
            metadata = CombinedMetadata(
                exif=ExifMetadata(
                    date_time=datetime.fromtimestamp(stat_result.st_mtime).isoformat()
                )
            )

            # Extract EXIF data for images
            if self._is_image_file(file_path):
                try:
                    exif_data = await self._extract_exif_data(str(full_path))
                    metadata.exif = exif_data
                except Exception as e:
                    logger.warning(f"No EXIF data available for {file_path}: {e}")

            return metadata

        except Exception as e:
            logger.error(f"Error extracting metadata for {file_path}: {e}")
            return CombinedMetadata()

    async def _extract_exif_data(self, image_path: str) -> ExifMetadata:
        """
        Extract EXIF metadata from image file using PIL.

        Args:
            image_path: Full path to image file

        Returns:
            ExifMetadata: Extracted EXIF data
        """

        def _sync_extract_exif():
            """Synchronous EXIF extraction for thread pool execution."""
            try:
                with Image.open(image_path) as img:
                    exif_dict = img._getexif() or {}

                metadata = ExifMetadata()

                # Extract basic image info
                if hasattr(img, "_getexif") and img._getexif():
                    exif = {TAGS.get(k, k): v for k, v in img._getexif().items()}

                    # Camera information
                    make = self._safe_get_string(exif.get("Make"))
                    model = self._safe_get_string(exif.get("Model"))
                    if make and model:
                        metadata.camera = f"{make} {model}"
                    elif make:
                        metadata.camera = make
                    elif model:
                        metadata.camera = model

                    # Date/time information
                    metadata.date_time_original = self._safe_get_string(
                        exif.get("DateTimeOriginal")
                    )
                    metadata.create_date = self._safe_get_string(exif.get("DateTime"))
                    metadata.date_time = (
                        metadata.date_time_original or metadata.create_date
                    )

                    # Camera settings
                    if "FNumber" in exif:
                        metadata.aperture = self._format_aperture(exif["FNumber"])
                    if "ExposureTime" in exif:
                        metadata.shutter = self._format_shutter(exif["ExposureTime"])
                    if "ISOSpeedRatings" in exif:
                        metadata.iso = str(exif["ISOSpeedRatings"])
                    if "FocalLength" in exif:
                        metadata.focal_length = self._format_focal_length(
                            exif["FocalLength"]
                        )
                    if "LensModel" in exif:
                        metadata.lens = self._safe_get_string(exif["LensModel"])

                    # GPS information
                    gps_info = exif.get("GPSInfo")
                    if gps_info:
                        gps_data = {GPSTAGS.get(k, k): v for k, v in gps_info.items()}

                        if "GPSLatitude" in gps_data and "GPSLatitudeRef" in gps_data:
                            metadata.gps_latitude = self._convert_dms_to_dd(
                                gps_data["GPSLatitude"], gps_data["GPSLatitudeRef"]
                            )

                        if "GPSLongitude" in gps_data and "GPSLongitudeRef" in gps_data:
                            metadata.gps_longitude = self._convert_dms_to_dd(
                                gps_data["GPSLongitude"], gps_data["GPSLongitudeRef"]
                            )

                return metadata

            except Exception as e:
                logger.error(f"Error extracting EXIF from {image_path}: {e}")
                return ExifMetadata()

        # Run EXIF extraction in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_extract_exif)

    def _is_image_file(self, filename: str) -> bool:
        """Check if file is a supported image format."""
        ext = Path(filename).suffix.lower()
        return ext in [".jpg", ".jpeg", ".tiff", ".tif"]

    def _safe_get_string(self, value: Any) -> Optional[str]:
        """Safely convert value to string."""
        if value is None:
            return None
        str_val = str(value).strip()
        return str_val if str_val else None

    def _format_aperture(self, f_number: Any) -> Optional[str]:
        """Format aperture value."""
        try:
            if hasattr(f_number, "__iter__") and len(f_number) == 2:
                # Handle fraction format
                num, den = f_number
                f_val = num / den if den != 0 else num
            else:
                f_val = float(f_number)
            return f"f/{f_val:.1f}"
        except (ValueError, TypeError, ZeroDivisionError):
            return None

    def _format_shutter(self, exposure_time: Any) -> Optional[str]:
        """Format shutter speed."""
        try:
            if hasattr(exposure_time, "__iter__") and len(exposure_time) == 2:
                # Handle fraction format
                num, den = exposure_time
                time_val = num / den if den != 0 else num
            else:
                time_val = float(exposure_time)

            if time_val >= 1:
                return f"{time_val}s"
            else:
                return f"1/{int(1/time_val)}s"
        except (ValueError, TypeError, ZeroDivisionError):
            return None

    def _format_focal_length(self, focal_length: Any) -> Optional[str]:
        """Format focal length."""
        try:
            if hasattr(focal_length, "__iter__") and len(focal_length) == 2:
                # Handle fraction format
                num, den = focal_length
                fl_val = num / den if den != 0 else num
            else:
                fl_val = float(focal_length)
            return f"{fl_val:.0f}mm"
        except (ValueError, TypeError, ZeroDivisionError):
            return None

    def _convert_dms_to_dd(self, dms: Any, ref: str) -> Optional[float]:
        """Convert DMS (Degrees, Minutes, Seconds) to decimal degrees."""
        try:
            if not hasattr(dms, "__iter__") or len(dms) != 3:
                return None

            degrees, minutes, seconds = dms

            # Handle fraction format
            if hasattr(degrees, "__iter__"):
                degrees = degrees[0] / degrees[1] if degrees[1] != 0 else degrees[0]
            if hasattr(minutes, "__iter__"):
                minutes = minutes[0] / minutes[1] if minutes[1] != 0 else minutes[0]
            if hasattr(seconds, "__iter__"):
                seconds = seconds[0] / seconds[1] if seconds[1] != 0 else seconds[0]

            dd = float(degrees) + float(minutes) / 60 + float(seconds) / 3600

            # Apply hemisphere reference
            if ref in ["S", "W"]:
                dd = -dd

            # Validate range
            max_val = 90 if ref in ["N", "S"] else 180
            if abs(dd) > max_val:
                return None

            return round(dd, 6)

        except (ValueError, TypeError, ZeroDivisionError):
            return None

    def _parse_exif_date(self, date_str: str) -> Optional[datetime]:
        """Parse EXIF date string to datetime object."""
        if not date_str:
            return None

        try:
            # EXIF dates are in format "YYYY:MM:DD HH:MM:SS"
            normalized = date_str.replace(":", "-", 2)  # Replace first two colons
            parsed = datetime.fromisoformat(normalized)

            # Validate reasonable date range
            if 1900 <= parsed.year <= 2100:
                return parsed
        except ValueError:
            pass

        return None

    def _extract_date_from_filename(self, filename: str) -> Optional[datetime]:
        """Extract date from filename patterns."""
        try:
            # Pattern: YYYYMMDD_HHMMSS
            match = re.match(r"^(\d{8})_(\d{6})", filename)
            if match:
                date_str, time_str = match.groups()
                year = int(date_str[:4])
                month = int(date_str[4:6])
                day = int(date_str[6:8])
                hour = int(time_str[:2])
                minute = int(time_str[2:4])
                second = int(time_str[4:6])

                extracted = datetime(year, month, day, hour, minute, second)
                if extracted.year > 1900:
                    return extracted
        except ValueError:
            pass

        return None

    def get_file_url(self, relative_path: str) -> str:
        """Generate file URL for serving."""
        return f"/api/files/{relative_path}"

    async def health_check(self) -> Dict[str, Any]:
        """
        Check file manager service health.

        Returns:
            dict: Health status information
        """
        try:
            # Check if data directories are accessible
            await self.initialize_directories()

            return {
                "status": "healthy",
                "data_dir": str(self.data_dir),
                "media_dir": str(self.media_dir),
                "directories_initialized": True,
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "directories_initialized": False,
            }


# Global file manager service instance
file_manager_service = FileManagerService()
