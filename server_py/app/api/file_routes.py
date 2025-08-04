"""
File Serving API Routes

Handles file serving, thumbnails, and static file delivery.
Converted from TypeScript Express routes to maintain 100% API compatibility.
"""

import os
import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.services.thumbnail_service import ThumbnailService

router = APIRouter(prefix="/api/files", tags=["Files"])

# Initialize thumbnail service
thumbnail_service = ThumbnailService()


@router.get("/media/{tier}/{date}/{filename}")
async def serve_media_file(
    tier: str,
    date: str,
    filename: str,
    request: Request,
    quality: Optional[str] = Query(None, description="Thumbnail quality: low, medium, high"),
    w: Optional[int] = Query(None, description="Thumbnail width"),
    h: Optional[int] = Query(None, description="Thumbnail height")
):
    """
    Serve media files with thumbnail support.
    
    Matches TypeScript backend file serving with thumbnail generation:
    - /api/files/media/{tier}/{date}/{filename} - Original file
    - /api/files/media/{tier}/{date}/{filename}?w=300 - Thumbnail
    - /api/files/media/{tier}/{date}/{filename}?quality=low - Quality control
    """
    try:
        # Construct file path
        file_path = Path(settings.media_base_path) / tier / date / filename
        
        # Security check to prevent directory traversal
        media_base = Path(settings.media_base_path).resolve()
        if not file_path.resolve().is_relative_to(media_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if file exists
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Handle thumbnail requests
        if w or h or quality:
            try:
                thumbnail_size = w or h or 300
                thumbnail_quality = {
                    'low': 60,
                    'medium': 80,
                    'high': 90
                }.get(quality, 80)
                
                thumbnail_options = {
                    'size': thumbnail_size,
                    'quality': thumbnail_quality,
                    'format': 'jpeg'
                }
                
                thumbnail_path = await thumbnail_service.generate_thumbnail(
                    str(file_path), 
                    thumbnail_options
                )
                
                if thumbnail_path and Path(thumbnail_path).exists():
                    # Set appropriate headers for caching
                    headers = {
                        'Cache-Control': 'public, max-age=604800',  # 1 week
                        'Content-Type': 'image/jpeg',
                        'ETag': f'"{Path(thumbnail_path).name}"'
                    }
                    
                    return FileResponse(
                        path=thumbnail_path,
                        headers=headers,
                        filename=f"thumb_{filename}"
                    )
                    
            except Exception as error:
                # Log thumbnail generation failure, fall back to original
                print(f"Thumbnail generation failed: {error}")
        
        # Serve original file
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        # Set cache headers for original files
        headers = {
            'Cache-Control': 'public, max-age=86400',  # 1 day for originals
            'Content-Type': mime_type
        }
        
        return FileResponse(
            path=str(file_path),
            headers=headers,
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve file: {str(e)}")


@router.get("/temp/{filename}")
async def serve_temp_file(filename: str):
    """
    Serve temporary files (like face crops).
    
    Matches TypeScript backend temporary file serving.
    """
    try:
        file_path = Path(settings.uploads_path) / filename
        
        # Security check
        uploads_base = Path(settings.uploads_path).resolve()
        if not file_path.resolve().is_relative_to(uploads_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        # Temporary files have shorter cache time
        headers = {
            'Cache-Control': 'public, max-age=3600',  # 1 hour
            'Content-Type': mime_type
        }
        
        return FileResponse(
            path=str(file_path),
            headers=headers,
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve temp file: {str(e)}")


@router.get("/thumbnails/{filename}")
async def serve_thumbnail(filename: str):
    """
    Serve pre-generated thumbnails.
    
    Direct thumbnail serving for cached thumbnails.
    """
    try:
        file_path = Path(settings.thumbnails_path) / filename
        
        # Security check
        thumbnails_base = Path(settings.thumbnails_path).resolve()
        if not file_path.resolve().is_relative_to(thumbnails_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        
        # Thumbnails are typically JPEG
        headers = {
            'Cache-Control': 'public, max-age=2592000',  # 30 days for thumbnails
            'Content-Type': 'image/jpeg',
            'ETag': f'"{filename}"'
        }
        
        return FileResponse(
            path=str(file_path),
            headers=headers,
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve thumbnail: {str(e)}")


@router.head("/media/{tier}/{date}/{filename}")
async def head_media_file(tier: str, date: str, filename: str):
    """
    HEAD request for media files to check existence without downloading.
    
    Used by frontend for file existence checks.
    """
    try:
        file_path = Path(settings.media_base_path) / tier / date / filename
        
        # Security check
        media_base = Path(settings.media_base_path).resolve()
        if not file_path.resolve().is_relative_to(media_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file info
        file_stat = file_path.stat()
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        headers = {
            'Content-Length': str(file_stat.st_size),
            'Content-Type': mime_type or 'application/octet-stream',
            'Last-Modified': file_stat.st_mtime,
            'Cache-Control': 'public, max-age=86400'
        }
        
        return Response(headers=headers)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file info: {str(e)}")


@router.get("/download/{tier}/{date}/{filename}")
async def download_media_file(tier: str, date: str, filename: str):
    """
    Force download of media files.
    
    Returns file with Content-Disposition: attachment to force download.
    """
    try:
        file_path = Path(settings.media_base_path) / tier / date / filename
        
        # Security check
        media_base = Path(settings.media_base_path).resolve()
        if not file_path.resolve().is_relative_to(media_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        return FileResponse(
            path=str(file_path),
            media_type=mime_type,
            filename=filename,
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


@router.get("/info/{tier}/{date}/{filename}")
async def get_file_info(tier: str, date: str, filename: str):
    """
    Get file information without downloading.
    
    Returns file metadata like size, type, modification date.
    """
    try:
        file_path = Path(settings.media_base_path) / tier / date / filename
        
        # Security check
        media_base = Path(settings.media_base_path).resolve()
        if not file_path.resolve().is_relative_to(media_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        file_stat = file_path.stat()
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        return {
            'filename': filename,
            'size': file_stat.st_size,
            'mime_type': mime_type,
            'modified': file_stat.st_mtime,
            'tier': tier,
            'date': date,
            'path': f"/api/files/media/{tier}/{date}/{filename}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file info: {str(e)}")


# Stream large files for better performance
async def stream_file(file_path: Path, chunk_size: int = 8192):
    """Stream file in chunks for large files."""
    with open(file_path, 'rb') as file:
        while True:
            chunk = file.read(chunk_size)
            if not chunk:
                break
            yield chunk


@router.get("/stream/{tier}/{date}/{filename}")
async def stream_media_file(
    tier: str, 
    date: str, 
    filename: str,
    request: Request
):
    """
    Stream media files for large files or video content.
    
    Supports range requests for video streaming and large file delivery.
    """
    try:
        file_path = Path(settings.media_base_path) / tier / date / filename
        
        # Security check
        media_base = Path(settings.media_base_path).resolve()
        if not file_path.resolve().is_relative_to(media_base):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        file_stat = file_path.stat()
        file_size = file_stat.st_size
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        # Handle range requests (for video streaming)
        range_header = request.headers.get('Range')
        if range_header:
            # Parse range header
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1
            
            content_length = end - start + 1
            
            def stream_range():
                with open(file_path, 'rb') as file:
                    file.seek(start)
                    remaining = content_length
                    while remaining > 0:
                        chunk_size = min(8192, remaining)
                        chunk = file.read(chunk_size)
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            
            return StreamingResponse(
                stream_range(),
                status_code=206,
                headers={
                    'Content-Range': f'bytes {start}-{end}/{file_size}',
                    'Accept-Ranges': 'bytes',
                    'Content-Length': str(content_length),
                    'Content-Type': mime_type or 'application/octet-stream'
                }
            )
        
        # Regular streaming without range
        return StreamingResponse(
            stream_file(file_path),
            media_type=mime_type or 'application/octet-stream',
            headers={
                'Content-Length': str(file_size),
                'Accept-Ranges': 'bytes'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream file: {str(e)}")