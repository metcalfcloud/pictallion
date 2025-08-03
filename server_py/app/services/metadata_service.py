"""
Metadata Embedding Service

Handles metadata embedding into image and video files using EXIF/XMP standards.
Converts TypeScript MetadataEmbeddingService to Python with equivalent functionality.
"""

import logging
import asyncio
import json
import struct
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
from dataclasses import dataclass
import aiofiles
import aiofiles.os
from PIL import Image, ExifTags
from PIL.ExifTags import TAGS, GPSTAGS
import xml.etree.ElementTree as ET

from app.core.config import settings
from app.models.schemas import CombinedMetadata, AIMetadata, ExifMetadata
from app.models.media_asset import FileVersion

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingOptions:
    """Options for metadata embedding."""
    preserve_original: bool = True
    output_path: Optional[str] = None
    embed_in_place: bool = False


class MetadataEmbeddingService:
    """
    Service for embedding metadata into image and video files.
    
    Provides EXIF/XMP metadata embedding for images and sidecar file creation
    for videos, maintaining compatibility with the TypeScript implementation.
    """
    
    def __init__(self):
        self.data_dir = Path(settings.media_base_path).parent  # ./data
        self.media_dir = Path(settings.media_base_path)  # ./data/media
    
    async def embed_metadata_to_file(
        self,
        file_version: FileVersion,
        metadata: CombinedMetadata,
        options: EmbeddingOptions = None
    ) -> str:
        """
        Embed metadata into image or video file.
        
        Args:
            file_version: File version database record
            metadata: Combined metadata to embed
            options: Embedding options
            
        Returns:
            str: Path to output file with embedded metadata
        """
        if options is None:
            options = EmbeddingOptions()
        
        try:
            input_path = file_version.file_path
            output_path = (
                options.output_path or 
                (input_path if options.embed_in_place else self._generate_gold_path(file_version))
            )
            
            # Ensure output directory exists
            output_dir = Path(output_path).parent
            await aiofiles.os.makedirs(output_dir, exist_ok=True)
            
            if self._is_image_file(file_version.mime_type):
                return await self._embed_image_metadata(input_path, output_path, metadata, file_version)
            elif self._is_video_file(file_version.mime_type):
                return await self._embed_video_metadata(input_path, output_path, metadata, file_version)
            else:
                raise ValueError(f"Unsupported file type for metadata embedding: {file_version.mime_type}")
                
        except Exception as e:
            logger.error(f"Metadata embedding failed: {e}")
            raise Exception(f"Failed to embed metadata: {e}")
    
    async def _embed_image_metadata(
        self,
        input_path: str,
        output_path: str,
        metadata: CombinedMetadata,
        file_version: FileVersion
    ) -> str:
        """Embed metadata into image files using EXIF."""
        if file_version.mime_type == "image/jpeg":
            return await self._embed_jpeg_metadata(input_path, output_path, metadata, file_version)
        else:
            return await self._embed_non_jpeg_metadata(input_path, output_path, metadata, file_version)
    
    async def _embed_jpeg_metadata(
        self,
        input_path: str,
        output_path: str,
        metadata: CombinedMetadata,
        file_version: FileVersion
    ) -> str:
        """Embed metadata into JPEG files using PIL."""
        def _sync_embed_jpeg():
            """Synchronous JPEG metadata embedding for thread pool."""
            try:
                with Image.open(input_path) as img:
                    # Get existing EXIF data
                    exif_dict = img.getexif()
                    
                    # Update EXIF with new metadata
                    self._update_exif_data(exif_dict, metadata, file_version)
                    
                    # Save with updated EXIF
                    img.save(output_path, "JPEG", exif=exif_dict, quality=95, optimize=True)
                
                logger.info(f"Successfully embedded metadata into JPEG: {output_path}")
                return output_path
                
            except Exception as e:
                logger.error(f"JPEG metadata embedding failed: {e}")
                # Fallback to copying without embedding
                with open(input_path, 'rb') as src, open(output_path, 'wb') as dst:
                    dst.write(src.read())
                return output_path
        
        # Run in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_embed_jpeg)
    
    async def _embed_non_jpeg_metadata(
        self,
        input_path: str,
        output_path: str,
        metadata: CombinedMetadata,
        file_version: FileVersion
    ) -> str:
        """Embed metadata into non-JPEG images by converting to JPEG."""
        def _sync_embed_non_jpeg():
            """Synchronous non-JPEG metadata embedding for thread pool."""
            try:
                with Image.open(input_path) as img:
                    # Convert to RGB if necessary
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        if img.mode == 'RGBA':
                            background.paste(img, mask=img.split()[-1])
                        img = background
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Create EXIF data
                    exif_dict = img.getexif()
                    self._update_exif_data(exif_dict, metadata, file_version)
                    
                    # Save as JPEG with EXIF
                    jpeg_output = str(Path(output_path).with_suffix('.jpg'))
                    img.save(jpeg_output, "JPEG", exif=exif_dict, quality=95)
                
                logger.info(f"Successfully embedded metadata into image: {jpeg_output}")
                return jpeg_output
                
            except Exception as e:
                logger.error(f"Non-JPEG metadata embedding failed: {e}")
                # Fallback to copying original
                with open(input_path, 'rb') as src, open(output_path, 'wb') as dst:
                    dst.write(src.read())
                return output_path
        
        # Run in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_embed_non_jpeg)
    
    def _update_exif_data(
        self,
        exif_dict: Image.Exif,
        metadata: CombinedMetadata,
        file_version: FileVersion
    ) -> None:
        """Update EXIF dictionary with metadata."""
        try:
            # Image description
            if metadata.ai and metadata.ai.long_description:
                exif_dict[ExifTags.Base.ImageDescription.value] = metadata.ai.long_description
            
            # Keywords/Tags  
            if metadata.ai and metadata.ai.ai_tags:
                keywords = ";".join(metadata.ai.ai_tags)
                # Note: PIL doesn't directly support XPKeywords, so we use ImageDescription
                if file_version.keywords:
                    all_keywords = metadata.ai.ai_tags + file_version.keywords
                    keywords = ";".join(all_keywords)
                # Store in a custom field or use available field
                exif_dict[ExifTags.Base.ImageDescription.value] = f"{keywords}"
            
            # Rating (stored in a way that's compatible)
            if file_version.rating and file_version.rating > 0:
                # Store rating in UserComment since Rating tag isn't standard
                rating_info = f"Rating:{file_version.rating}"
                exif_dict[ExifTags.Base.UserComment.value] = rating_info.encode('utf-8')
            
            # Artist (people in photo)
            if metadata.ai and metadata.ai.detected_faces:
                people_names = [
                    face.get('personName') for face in metadata.ai.detected_faces 
                    if face.get('personName')
                ]
                if people_names:
                    exif_dict[ExifTags.Base.Artist.value] = ", ".join(people_names)
            
            # GPS data
            if metadata.ai and metadata.ai.gps_coordinates:
                gps_data = self._create_gps_exif(
                    metadata.ai.gps_coordinates.get('latitude', 0),
                    metadata.ai.gps_coordinates.get('longitude', 0)
                )
                # Note: GPS data in PIL requires more complex handling
                # This is a simplified version
                
            # Software signature
            exif_dict[ExifTags.Base.Software.value] = "Pictallion Photo Manager"
            
            # Custom metadata in UserComment (JSON format)
            custom_metadata = {
                "eventType": file_version.event_type,
                "eventName": file_version.event_name,
                "location": file_version.location,
                "perceptualHash": file_version.perceptual_hash,
                "aiConfidence": metadata.ai.ai_confidence_scores if metadata.ai else None,
                "detectedObjects": metadata.ai.detected_objects if metadata.ai else None,
                "detectedEvents": metadata.ai.detected_events if metadata.ai else None
            }
            
            # Encode custom metadata
            custom_json = json.dumps(custom_metadata)
            user_comment = f"ASCII\x00\x00\x00{custom_json}"
            exif_dict[ExifTags.Base.UserComment.value] = user_comment.encode('utf-8')
            
        except Exception as e:
            logger.error(f"Error updating EXIF data: {e}")
    
    async def _embed_video_metadata(
        self,
        input_path: str,
        output_path: str,
        metadata: CombinedMetadata,
        file_version: FileVersion
    ) -> str:
        """Handle video metadata embedding using sidecar files."""
        # Copy video file
        async with aiofiles.open(input_path, 'rb') as src:
            async with aiofiles.open(output_path, 'wb') as dst:
                content = await src.read()
                await dst.write(content)
        
        # Create XMP sidecar file
        xmp_path = f"{output_path}.xmp"
        xmp_content = self._create_xmp_sidecar(metadata, file_version)
        async with aiofiles.open(xmp_path, 'w', encoding='utf-8') as f:
            await f.write(xmp_content)
        
        # Create JSON metadata sidecar
        json_path = f"{output_path}.json"
        json_metadata = {
            **(metadata.dict() if metadata else {}),
            "rating": file_version.rating,
            "keywords": file_version.keywords,
            "eventType": file_version.event_type,
            "eventName": file_version.event_name,
            "location": file_version.location,
            "perceptualHash": file_version.perceptual_hash
        }
        
        async with aiofiles.open(json_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(json_metadata, indent=2, default=str))
        
        logger.info(f"Successfully created video metadata sidecars: {xmp_path}, {json_path}")
        return output_path
    
    async def extract_embedded_metadata(self, file_path: str) -> Optional[CombinedMetadata]:
        """
        Extract metadata from Gold tier files for database reconstruction.
        
        Args:
            file_path: Path to file with embedded metadata
            
        Returns:
            CombinedMetadata: Extracted metadata or None
        """
        try:
            if self._is_image_file(self._get_mime_type_from_path(file_path)):
                return await self._extract_image_metadata(file_path)
            elif self._is_video_file(self._get_mime_type_from_path(file_path)):
                return await self._extract_video_metadata(file_path)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to extract embedded metadata from {file_path}: {e}")
            return None
    
    async def _extract_image_metadata(self, image_path: str) -> Optional[CombinedMetadata]:
        """Extract metadata from image files."""
        def _sync_extract_image():
            """Synchronous image metadata extraction for thread pool."""
            try:
                with Image.open(image_path) as img:
                    exif_data = img.getexif()
                    
                    # Parse EXIF data
                    exif_metadata = self._parse_exif_data(exif_data)
                    ai_metadata = self._parse_ai_data(exif_data)
                    
                    return CombinedMetadata(
                        exif=exif_metadata,
                        ai=ai_metadata
                    )
                    
            except Exception as e:
                logger.error(f"Failed to extract image metadata from {image_path}: {e}")
                return None
        
        # Run in thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_extract_image)
    
    async def _extract_video_metadata(self, video_path: str) -> Optional[CombinedMetadata]:
        """Extract metadata from video sidecar files."""
        try:
            json_path = f"{video_path}.json"
            if await aiofiles.os.path.exists(json_path):
                async with aiofiles.open(json_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    data = json.loads(content)
                    return CombinedMetadata(**data)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to extract video metadata from {video_path}: {e}")
            return None
    
    def _generate_gold_path(self, file_version: FileVersion) -> str:
        """Generate Gold tier path for file."""
        date = datetime.now()
        year = date.year
        month = f"{date.month:02d}"
        
        filename = Path(file_version.file_path).name
        return str(self.media_dir / "gold" / str(year) / month / filename)
    
    def _is_image_file(self, mime_type: str) -> bool:
        """Check if file is an image."""
        return mime_type.startswith('image/')
    
    def _is_video_file(self, mime_type: str) -> bool:
        """Check if file is a video."""
        return mime_type.startswith('video/')
    
    def _get_mime_type_from_path(self, file_path: str) -> str:
        """Get MIME type from file extension."""
        ext = Path(file_path).suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/avi'
        }
        return mime_types.get(ext, 'application/octet-stream')
    
    def _create_gps_exif(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Create GPS EXIF data from coordinates."""
        lat_ref = 'N' if latitude >= 0 else 'S'
        lon_ref = 'E' if longitude >= 0 else 'W'
        
        lat_degrees = self._decimal_to_dms(abs(latitude))
        lon_degrees = self._decimal_to_dms(abs(longitude))
        
        return {
            'GPSLatitudeRef': lat_ref,
            'GPSLatitude': lat_degrees,
            'GPSLongitudeRef': lon_ref,
            'GPSLongitude': lon_degrees,
        }
    
    def _decimal_to_dms(self, decimal: float) -> Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int]]:
        """Convert decimal degrees to DMS format."""
        degrees = int(decimal)
        minutes = int((decimal - degrees) * 60)
        seconds = ((decimal - degrees) * 60 - minutes) * 60
        
        return (
            (degrees, 1),
            (minutes, 1),
            (int(round(seconds * 1000)), 1000)
        )
    
    def _create_xmp_sidecar(self, metadata: CombinedMetadata, file_version: FileVersion) -> str:
        """Create XMP sidecar content for videos."""
        ai_tags = metadata.ai.ai_tags if metadata.ai else []
        description = metadata.ai.long_description if metadata.ai else ""
        
        tag_elements = '\n          '.join(f'<rdf:li>{tag}</rdf:li>' for tag in ai_tags)
        
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="">
      <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">{description}</dc:description>
      <dc:subject xmlns:dc="http://purl.org/dc/elements/1.1/">
        <rdf:Bag>
          {tag_elements}
        </rdf:Bag>
      </dc:subject>
      <xmp:Rating xmlns:xmp="http://ns.adobe.com/xap/1.0/">{file_version.rating or 0}</xmp:Rating>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>'''
    
    def _parse_exif_data(self, exif_data: Image.Exif) -> ExifMetadata:
        """Parse EXIF data from image."""
        metadata = ExifMetadata()
        
        try:
            # Extract basic EXIF fields
            if ExifTags.Base.Make.value in exif_data:
                make = exif_data[ExifTags.Base.Make.value]
                model = exif_data.get(ExifTags.Base.Model.value, "")
                metadata.camera = f"{make} {model}".strip()
            
            if ExifTags.Base.DateTime.value in exif_data:
                metadata.date_time = exif_data[ExifTags.Base.DateTime.value]
                
            # Add more EXIF parsing as needed
            
        except Exception as e:
            logger.error(f"Error parsing EXIF data: {e}")
        
        return metadata
    
    def _parse_ai_data(self, exif_data: Image.Exif) -> Optional[AIMetadata]:
        """Parse AI metadata from EXIF UserComment field."""
        try:
            user_comment = exif_data.get(ExifTags.Base.UserComment.value)
            if user_comment:
                # Handle byte data
                if isinstance(user_comment, bytes):
                    user_comment = user_comment.decode('utf-8', errors='ignore')
                
                if user_comment.startswith("ASCII\x00\x00\x00"):
                    json_str = user_comment[8:]  # Skip "ASCII\0\0\0"
                    custom_data = json.loads(json_str)
                    
                    return AIMetadata(
                        ai_tags=[],
                        short_description="",
                        long_description="",
                        detected_objects=custom_data.get('detectedObjects', []),
                        detected_events=custom_data.get('detectedEvents', []),
                        perceptual_hash=custom_data.get('perceptualHash'),
                        ai_confidence_scores=custom_data.get('aiConfidence', {})
                    )
                    
        except Exception as e:
            logger.error(f"Failed to parse AI data from EXIF: {e}")
        
        return None
    
    async def batch_embed_metadata(
        self,
        file_versions: List[FileVersion],
        metadata_list: List[CombinedMetadata],
        options: EmbeddingOptions = None,
        max_concurrent: int = 3
    ) -> Dict[str, str]:
        """
        Embed metadata for multiple files concurrently.
        
        Args:
            file_versions: List of file version records
            metadata_list: List of metadata to embed (same order as file_versions)
            options: Embedding options
            max_concurrent: Maximum concurrent operations
            
        Returns:
            dict: Mapping of input file path to output file path
        """
        if len(file_versions) != len(metadata_list):
            raise ValueError("file_versions and metadata_list must have same length")
        
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def _embed_single(file_version: FileVersion, metadata: CombinedMetadata) -> Tuple[str, str]:
            async with semaphore:
                try:
                    output_path = await self.embed_metadata_to_file(file_version, metadata, options)
                    return file_version.file_path, output_path
                except Exception as e:
                    logger.error(f"Failed to embed metadata for {file_version.file_path}: {e}")
                    return file_version.file_path, ""
        
        # Process all files concurrently
        tasks = [
            _embed_single(fv, md) 
            for fv, md in zip(file_versions, metadata_list)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        result_map = {}
        for result in results:
            if isinstance(result, tuple):
                input_path, output_path = result
                if output_path:  # Only include successful embeddings
                    result_map[input_path] = output_path
        
        logger.info(f"Embedded metadata for {len(result_map)} files out of {len(file_versions)} requested")
        return result_map
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check metadata service health.
        
        Returns:
            dict: Health status information
        """
        try:
            # Test basic functionality
            can_process_images = True
            can_create_sidecars = True
            
            try:
                # Test image processing
                test_img = Image.new('RGB', (100, 100), color='red')
                test_exif = test_img.getexif()
                test_exif[ExifTags.Base.Software.value] = "Test"
                
            except Exception as e:
                logger.warning(f"Image processing test failed: {e}")
                can_process_images = False
            
            try:
                # Test sidecar creation
                test_metadata = CombinedMetadata()
                test_fv = FileVersion(
                    file_path="test.mp4",
                    mime_type="video/mp4",
                    rating=5,
                    keywords=["test"]
                )
                xmp_content = self._create_xmp_sidecar(test_metadata, test_fv)
                
            except Exception as e:
                logger.warning(f"Sidecar creation test failed: {e}")
                can_create_sidecars = False
            
            status = "healthy" if (can_process_images and can_create_sidecars) else "degraded"
            
            return {
                "status": status,
                "can_process_images": can_process_images,
                "can_create_sidecars": can_create_sidecars,
                "data_dir": str(self.data_dir),
                "media_dir": str(self.media_dir)
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "can_process_images": False,
                "can_create_sidecars": False
            }


# Global metadata service instance
metadata_service = MetadataEmbeddingService()