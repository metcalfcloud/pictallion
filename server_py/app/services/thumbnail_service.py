"""
Thumbnail Service

Handles thumbnail generation and caching using Pillow.
Converts TypeScript ThumbnailService to Python with equivalent functionality.
"""

import logging
import asyncio
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO
from dataclasses import dataclass
import aiofiles  # type: ignore
import aiofiles.os  # type: ignore
from PIL import Image, ImageOps
from io import BytesIO

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ThumbnailOptions:
    """Options for thumbnail generation."""
    size: int
    quality: int
    format: str = "jpeg"
    width: Optional[int] = None
    height: Optional[int] = None


class ThumbnailService:
    """
    Service for thumbnail generation and caching.
    
    Provides fast thumbnail generation with caching and multiple quality presets.
    Uses Pillow for image processing instead of Sharp.
    """
    
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir or settings.thumbnails_path)
        # Do not create tasks in __init__; require explicit async initialization
    
    async def _ensure_cache_dir(self) -> None:
        """Ensure thumbnail cache directory exists."""
        try:
            await aiofiles.os.makedirs(self.cache_dir, exist_ok=True)
            logger.info(f"Thumbnail cache directory ensured: {self.cache_dir}")
        except Exception as e:
            logger.error(f"Failed to create thumbnail cache directory: {e}")
            raise
    
    def _get_cache_key(self, original_path: str, options: ThumbnailOptions) -> str:
        """Generate cache key for thumbnail."""
        data = f"{original_path}-{options.size}-{options.quality}-{options.format}"
        return hashlib.md5(data.encode()).hexdigest()
    
    def _get_cache_path(self, cache_key: str, format_ext: str = "jpeg") -> Path:
        """Get full cache file path."""
        return self.cache_dir / f"{cache_key}.{format_ext}"
    
    async def generate_thumbnail(
        self,
        original_path: str,
        options: ThumbnailOptions
    ) -> str:
        """
        Generate thumbnail with caching.
        
        Args:
            original_path: Path to original image
            options: Thumbnail generation options
            
        Returns:
            str: Path to generated thumbnail
        """
        cache_key = self._get_cache_key(original_path, options)
        cache_path = self._get_cache_path(cache_key, options.format)
        
        # Check if cached thumbnail exists
        if await aiofiles.os.path.exists(cache_path):
            logger.debug(f"Using cached thumbnail: {cache_path}")
            return str(cache_path)
        
        # Generate new thumbnail
        try:
            await self._create_thumbnail(original_path, cache_path, options)
            logger.info(f"Generated new thumbnail: {cache_path}")
            return str(cache_path)
        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {original_path}: {e}")
            raise
    
    async def _create_thumbnail(
        self,
        original_path: str,
        output_path: Path,
        options: ThumbnailOptions
    ) -> None:
        """Create thumbnail using Pillow in thread pool."""
        def _sync_create_thumbnail() -> None:
            """Synchronous thumbnail creation for thread pool."""
            try:
                with Image.open(original_path) as img:
                    # Convert to RGB if necessary (handles RGBA, etc.)
                    if img.mode in ('RGBA', 'LA', 'P'):
                        # Create white background for transparency
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Auto-orient image based on EXIF data
                    img = ImageOps.exif_transpose(img)
                    
                    # Calculate target size maintaining aspect ratio
                    target_size = (options.size, options.size)
                    
                    # Use thumbnail method with high-quality resampling
                    img.thumbnail(target_size, Image.Resampling.LANCZOS)
                    
                    # Create final image with exact dimensions (crop if needed)
                    final_img = Image.new('RGB', target_size, (255, 255, 255))
                    
                    # Center the image
                    x = (target_size[0] - img.width) // 2
                    y = (target_size[1] - img.height) // 2
                    final_img.paste(img, (x, y))
                    
                    # Save with specified quality
                    save_kwargs = {
                        'format': 'JPEG',
                        'quality': min(options.quality, 95),  # Cap quality for file size
                        'optimize': True,
                        'progressive': True
                    }
                    
                    final_img.save(output_path, "JPEG", **{k: v for k, v in save_kwargs.items() if k != "format"})
                    
            except Exception as e:
                logger.error(f"Error in sync thumbnail creation: {e}")
                raise
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _sync_create_thumbnail)
    
    async def get_thumbnail_stream(
        self,
        original_path: str,
        options: ThumbnailOptions
    ) -> bytes:
        """
        Get thumbnail as byte stream.
        
        Args:
            original_path: Path to original image
            options: Thumbnail generation options
            
        Returns:
            bytes: Thumbnail image data
        """
        thumbnail_path = await self.generate_thumbnail(original_path, options)
        
        async with aiofiles.open(thumbnail_path, 'rb') as f:
            return await f.read()  # type: ignore
    
    async def get_thumbnail_buffer(
        self,
        original_path: str,
        options: ThumbnailOptions
    ) -> BytesIO:
        """
        Get thumbnail as BytesIO buffer.
        
        Args:
            original_path: Path to original image
            options: Thumbnail generation options
            
        Returns:
            BytesIO: Thumbnail image buffer
        """
        data = await self.get_thumbnail_stream(original_path, options)
        return BytesIO(data)
    
    async def clear_cache(self) -> None:
        """Clear all cached thumbnails."""
        try:
            if await aiofiles.os.path.exists(self.cache_dir):
                files = await aiofiles.os.listdir(self.cache_dir)
                for filename in files:
                    file_path = self.cache_dir / filename
                    if await aiofiles.os.path.isfile(file_path):
                        await aiofiles.os.remove(file_path)
                logger.info(f"Cleared {len(files)} cached thumbnails")
        except Exception as e:
            logger.error(f"Failed to clear thumbnail cache: {e}")
            raise
    
    async def get_cache_stats(self) -> Dict[str, int]:
        """
        Get thumbnail cache statistics.
        
        Returns:
            dict: Cache statistics with file count and total size
        """
        try:
            if not await aiofiles.os.path.exists(self.cache_dir):
                return {"file_count": 0, "total_size": 0}
            
            files = await aiofiles.os.listdir(self.cache_dir)
            total_size = 0
            file_count = 0
            
            for filename in files:
                file_path = self.cache_dir / filename
                if await aiofiles.os.path.isfile(file_path):
                    stat_result = await aiofiles.os.stat(file_path)
                    total_size += stat_result.st_size
                    file_count += 1
            
            return {
                "file_count": file_count,
                "total_size": total_size
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"file_count": 0, "total_size": 0}
    
    def get_quality_preset(self, preset: str) -> ThumbnailOptions:
        """
        Get predefined quality preset.
        
        Args:
            preset: Quality preset name ('low', 'medium', 'high', 'thumbnail')
            
        Returns:
            ThumbnailOptions: Preset options
        """
        presets = {
            "low": ThumbnailOptions(
                size=150, 
                quality=60, 
                width=150, 
                height=150
            ),
            "medium": ThumbnailOptions(
                size=300, 
                quality=80, 
                width=300, 
                height=300
            ),
            "high": ThumbnailOptions(
                size=600, 
                quality=95, 
                width=600, 
                height=600
            ),
            "thumbnail": ThumbnailOptions(
                size=200, 
                quality=75, 
                width=200, 
                height=200
            )
        }
        
        return presets.get(preset, presets["medium"])
    
    async def get_thumbnail(
        self,
        original_path: str,
        options: ThumbnailOptions
    ) -> str:
        """
        Get thumbnail path (alias for generate_thumbnail).
        
        Args:
            original_path: Path to original image
            options: Thumbnail generation options
            
        Returns:
            str: Path to thumbnail file
        """
        size = options.width or options.height or options.size
        thumbnail_options = ThumbnailOptions(
            size=size,
            quality=options.quality,
            format="jpeg"
        )
        
        return await self.generate_thumbnail(original_path, thumbnail_options)
    
    async def batch_generate_thumbnails(
        self,
        file_paths: list[str],
        options: ThumbnailOptions,
        max_concurrent: int = 5
    ) -> Dict[str, str]:
        """
        Generate multiple thumbnails concurrently.
        
        Args:
            file_paths: List of image file paths
            options: Thumbnail generation options
            max_concurrent: Maximum concurrent operations
            
        Returns:
            dict: Mapping of original path to thumbnail path
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def _generate_single(file_path: str) -> tuple[str, str]:
            async with semaphore:
                try:
                    thumbnail_path = await self.generate_thumbnail(file_path, options)
                    return file_path, thumbnail_path
                except Exception as e:
                    logger.error(f"Failed to generate thumbnail for {file_path}: {e}")
                    return file_path, ""
        
        # Generate all thumbnails concurrently
        tasks = [_generate_single(path) for path in file_paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        thumbnail_map = {}
        for result in results:
            if isinstance(result, tuple):
                original_path, thumbnail_path = result
                if thumbnail_path:  # Only include successful generations
                    thumbnail_map[original_path] = thumbnail_path
        
        logger.info(f"Generated {len(thumbnail_map)} thumbnails out of {len(file_paths)} requested")
        return thumbnail_map
    
    async def cleanup_orphaned_thumbnails(
        self,
        valid_original_paths: set[str]
    ) -> int:
        """
        Remove thumbnails for which original files no longer exist.
        
        Args:
            valid_original_paths: Set of valid original file paths
            
        Returns:
            int: Number of orphaned thumbnails removed
        """
        try:
            if not await aiofiles.os.path.exists(self.cache_dir):
                return 0
            
            files = await aiofiles.os.listdir(self.cache_dir)
            removed_count = 0
            
            for filename in files:
                file_path = self.cache_dir / filename
                if await aiofiles.os.path.isfile(file_path):
                    # Check if any valid path would generate this cache key
                    is_orphaned = True
                    cache_key = Path(filename).stem
                    
                    # This is a simplified check - in practice you might want to
                    # store a mapping of cache keys to original paths
                    for original_path in valid_original_paths:
                        for preset in ["low", "medium", "high", "thumbnail"]:
                            options = self.get_quality_preset(preset)
                            if self._get_cache_key(original_path, options) == cache_key:
                                is_orphaned = False
                                break
                        if not is_orphaned:
                            break
                    
                    if is_orphaned:
                        await aiofiles.os.remove(file_path)
                        removed_count += 1
            
            logger.info(f"Cleaned up {removed_count} orphaned thumbnails")
            return removed_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned thumbnails: {e}")
            return 0
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check thumbnail service health.
        
        Returns:
            dict: Health status information
        """
        try:
            await self._ensure_cache_dir()
            cache_stats = await self.get_cache_stats()
            
            # Test thumbnail generation with a small test image
            test_image_path = None
            can_generate = True
            
            try:
                # Create a simple test image
                test_img = Image.new('RGB', (100, 100), color='red')
                test_path = self.cache_dir / "health_check_test.jpg"
                test_img.save(test_path)
                
                # Try to generate a thumbnail
                options = ThumbnailOptions(size=50, quality=80)
                await self.generate_thumbnail(str(test_path), options)
                
                # Clean up test files
                await aiofiles.os.remove(test_path)
                test_cache_key = self._get_cache_key(str(test_path), options)
                test_thumbnail = self._get_cache_path(test_cache_key)
                if await aiofiles.os.path.exists(test_thumbnail):
                    await aiofiles.os.remove(test_thumbnail)
                    
            except Exception as e:
                logger.warning(f"Thumbnail generation test failed: {e}")
                can_generate = False
            
            return {
                "status": "healthy" if can_generate else "degraded",
                "cache_dir": str(self.cache_dir),
                "cache_accessible": True,
                "can_generate_thumbnails": can_generate,
                "cache_stats": cache_stats
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "cache_accessible": False,
                "can_generate_thumbnails": False
            }


# Global thumbnail service instance
thumbnail_service = ThumbnailService()
# To initialize cache dir, call: await thumbnail_service._ensure_cache_dir() from an async context