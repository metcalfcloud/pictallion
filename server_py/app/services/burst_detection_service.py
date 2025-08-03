"""
Burst Photo Detection Service for Pictallion

Analyzes photos from all tiers for burst sequences. Groups photos with 95%+ similarity
taken within ±10 seconds. Handles cross-tier detection and mixed-tier groups using
multiple similarity factors: filename patterns, file size, EXIF data, and time proximity.
"""

import uuid
import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from sqlmodel import select
from ..core.database import get_session
from ..models.file_version import FileVersion
from ..models.media_asset import MediaAsset


@dataclass
class BurstGroup:
    """Represents a group of burst photos"""
    id: str
    photos: List[Dict[str, Any]]
    suggested_best: str  # ID of the photo to promote
    average_similarity: float
    time_span: int  # in milliseconds
    group_reason: str


@dataclass
class BurstAnalysis:
    """Analysis result for burst photo detection"""
    groups: List[BurstGroup]
    total_photos: int
    ungrouped_photos: List[Dict[str, Any]]


class BurstPhotoDetectionService:
    """Service for detecting burst photo sequences"""
    
    async def analyze_burst_photos(self, all_photos: List[Dict[str, Any]]) -> BurstAnalysis:
        """
        Analyze photos from all tiers for burst sequences
        Groups photos with 95%+ similarity taken within ±10 seconds
        Handles cross-tier detection and mixed-tier groups
        
        Args:
            all_photos: List of photo dictionaries with metadata
            
        Returns:
            BurstAnalysis with grouped and ungrouped photos
        """
        try:
            if not all_photos:
                return self._generate_empty_analysis()
            
            # Group photos by mediaAssetId first to handle same original photo across tiers
            photos_by_asset: Dict[str, List[Dict[str, Any]]] = {}
            for photo in all_photos:
                asset_id = photo.get('mediaAssetId') or photo.get('media_asset_id')
                if asset_id not in photos_by_asset:
                    photos_by_asset[asset_id] = []
                photos_by_asset[asset_id].append(photo)
            
            # For burst detection, use one representative photo per media asset
            # Priority: unprocessed bronze > processed bronze > silver > gold
            representative_photos = []
            for versions in photos_by_asset.values():
                def get_priority(photo: Dict[str, Any]) -> tuple:
                    """Get priority tuple for sorting (lower is better)"""
                    tier_priority = {'bronze': 0, 'silver': 1, 'gold': 2}
                    state_priority = {'unprocessed': 0, 'processed': 1, 'promoted': 2, 'rejected': 3}
                    
                    tier = photo.get('tier', 'silver')
                    processing_state = photo.get('processingState') or photo.get('processing_state', 'unprocessed')
                    
                    tier_val = tier_priority.get(tier, 1)
                    state_val = state_priority.get(processing_state, 0) if tier == 'bronze' else 0
                    
                    return (tier_val, state_val)
                
                # Sort and take the first (highest priority) photo
                sorted_versions = sorted(versions, key=get_priority)
                representative_photos.append(sorted_versions[0])
            
            # Sort photos by creation time for efficient processing
            def get_created_at_time(photo: Dict[str, Any]) -> float:
                """Extract creation time as timestamp"""
                created_at = photo.get('createdAt') or photo.get('created_at')
                if isinstance(created_at, str):
                    try:
                        return datetime.fromisoformat(created_at.replace('Z', '+00:00')).timestamp()
                    except ValueError:
                        return datetime.now().timestamp()
                elif hasattr(created_at, 'timestamp'):
                    return created_at.timestamp()
                return datetime.now().timestamp()
            
            sorted_photos = sorted(representative_photos, key=get_created_at_time)
            
            burst_groups: List[BurstGroup] = []
            processed_photos = set()
            ungrouped_photos = []
            
            for i, current_photo in enumerate(sorted_photos):
                if current_photo['id'] in processed_photos:
                    continue
                
                # Find photos within 10 seconds window using extracted timestamps
                time_window = 10 * 1000  # 10 seconds in milliseconds
                current_time = self._get_photo_time(current_photo)
                candidate_photos = [current_photo]
                
                # Look for photos within time window
                for j in range(i + 1, len(sorted_photos)):
                    compare_photo = sorted_photos[j]
                    if compare_photo['id'] in processed_photos:
                        continue
                    
                    compare_time = self._get_photo_time(compare_photo)
                    time_diff = abs(compare_time - current_time)
                    
                    if time_diff > time_window:
                        break  # Photos are sorted by time, so no more matches possible
                    
                    # Check similarity
                    similarity = await self._calculate_photo_similarity(current_photo, compare_photo)
                    if similarity >= 0.95:
                        candidate_photos.append(compare_photo)
                
                # If we found similar photos, create a burst group
                if len(candidate_photos) > 1:
                    group = await self._create_burst_group(candidate_photos)
                    burst_groups.append(group)
                    for photo in candidate_photos:
                        processed_photos.add(photo['id'])
                else:
                    ungrouped_photos.append(current_photo)
                    processed_photos.add(current_photo['id'])
            
            return BurstAnalysis(
                groups=burst_groups,
                total_photos=len(representative_photos),
                ungrouped_photos=ungrouped_photos
            )
            
        except Exception as e:
            print(f"Error analyzing burst photos: {e}")
            return self._generate_empty_analysis()
    
    def _get_photo_time(self, photo: Dict[str, Any]) -> float:
        """
        Extract photo timestamp with priority order
        
        Args:
            photo: Photo dictionary
            
        Returns:
            Timestamp in milliseconds
        """
        # First try EXIF datetime fields
        metadata = photo.get('metadata', {})
        exif = metadata.get('exif', {})
        
        for date_field in ['dateTime', 'dateTimeOriginal']:
            if exif.get(date_field):
                try:
                    return datetime.fromisoformat(str(exif[date_field])).timestamp() * 1000
                except (ValueError, TypeError):
                    continue
        
        # Try to extract from filename if it has timestamp format (YYYYMMDD_HHMMSS)
        media_asset = photo.get('mediaAsset', {})
        if not media_asset:
            media_asset = photo.get('media_asset', {})
        
        filename = media_asset.get('originalFilename', '') or media_asset.get('original_filename', '')
        timestamp_match = re.search(r'^(\d{8})_(\d{6})', filename)
        
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
                
                extracted_date = datetime(year, month, day, hour, minute, second)
                return extracted_date.timestamp() * 1000
            except (ValueError, IndexError):
                pass
        
        # Fall back to upload time as last resort
        created_at = photo.get('createdAt') or photo.get('created_at')
        if isinstance(created_at, str):
            try:
                return datetime.fromisoformat(created_at.replace('Z', '+00:00')).timestamp() * 1000
            except ValueError:
                return datetime.now().timestamp() * 1000
        elif hasattr(created_at, 'timestamp'):
            return created_at.timestamp() * 1000
        
        return datetime.now().timestamp() * 1000
    
    async def _calculate_photo_similarity(self, photo1: Dict[str, Any], photo2: Dict[str, Any]) -> float:
        """
        Calculate similarity between two photos
        Uses multiple factors: filename similarity, file size, EXIF data, time proximity
        
        Args:
            photo1: First photo dictionary
            photo2: Second photo dictionary
            
        Returns:
            Similarity score (0.0 to 1.0)
        """
        similarity_score = 0.0
        factors_checked = 0
        
        # File hash comparison (if available)
        hash1 = photo1.get('fileHash') or photo1.get('file_hash')
        hash2 = photo2.get('fileHash') or photo2.get('file_hash')
        
        if hash1 and hash2:
            if hash1 == hash2:
                return 1.0  # Identical files
        
        # Time proximity is important but not enough alone for burst photos
        time1 = self._get_photo_time(photo1)
        time2 = self._get_photo_time(photo2)
        time_diff = abs(time1 - time2)
        
        # More strict time-based scoring
        if time_diff <= 5000:  # Within 5 seconds - very strong indicator
            similarity_score += 0.4
            factors_checked += 1
        elif time_diff <= 30000:  # Within 30 seconds - moderate indicator
            similarity_score += 0.2
            factors_checked += 1
        elif time_diff <= 60000:  # Within 1 minute - weak indicator
            similarity_score += 0.1
            factors_checked += 1
        
        # Filename similarity (burst photos often have sequential names)
        def get_filename(photo: Dict[str, Any]) -> str:
            """Extract filename from photo"""
            media_asset = photo.get('mediaAsset', {})
            if not media_asset:
                media_asset = photo.get('media_asset', {})
            return (media_asset.get('originalFilename') or 
                   media_asset.get('original_filename', '')).lower()
        
        name1 = get_filename(photo1)
        name2 = get_filename(photo2)
        
        # Extract base names and numbers for burst detection
        def extract_base_and_number(filename: str) -> Dict[str, Any]:
            """Extract base name and sequence number from filename"""
            without_ext = re.sub(r'\.(jpg|jpeg|png|tiff)$', '', filename, flags=re.IGNORECASE)
            match = re.search(r'^(.+?)[-_]?(\d+)$', without_ext)
            if match:
                return {'base': match.group(1), 'number': int(match.group(2))}
            return {'base': without_ext, 'number': None}
        
        file1 = extract_base_and_number(name1)
        file2 = extract_base_and_number(name2)
        
        # Strong similarity: exact base name with sequential numbers
        if (file1['base'] == file2['base'] and 
            file1['number'] is not None and 
            file2['number'] is not None):
            
            number_diff = abs(file1['number'] - file2['number'])
            if number_diff <= 3:  # Sequential or very close numbers
                similarity_score += 0.4
                factors_checked += 1
        elif len(file1['base']) > 8 and len(file2['base']) > 8:
            # Weaker similarity: common prefix for longer names
            common_prefix = self._get_common_prefix(file1['base'], file2['base'])
            min_length = min(len(file1['base']), len(file2['base']))
            if len(common_prefix) >= min_length * 0.8:
                similarity_score += 0.2
                factors_checked += 1
        
        # File size similarity (burst photos should be very similar in size)
        size1 = photo1.get('fileSize') or photo1.get('file_size')
        size2 = photo2.get('fileSize') or photo2.get('file_size')
        
        if size1 and size2:
            size_diff = abs(size1 - size2)
            avg_size = (size1 + size2) / 2
            size_ratio = 1 - (size_diff / avg_size)
            
            if size_ratio > 0.95:  # Very strict size similarity for bursts
                similarity_score += 0.3
                factors_checked += 1
            elif size_ratio > 0.85:  # Moderate similarity
                similarity_score += 0.1
                factors_checked += 1
        
        # EXIF data similarity (same camera settings indicate burst)
        try:
            metadata1 = photo1.get('metadata', {})
            metadata2 = photo2.get('metadata', {})
            
            exif1 = metadata1.get('exif', {})
            exif2 = metadata2.get('exif', {})
            
            if exif1 and exif2:
                exif_score = 0.0
                
                # Check camera settings
                if exif1.get('make') == exif2.get('make') and exif1.get('model') == exif2.get('model'):
                    exif_score += 0.05
                
                if exif1.get('iso') == exif2.get('iso'):
                    exif_score += 0.05
                
                if exif1.get('focalLength') == exif2.get('focalLength'):
                    exif_score += 0.05
                
                if exif1.get('aperture') == exif2.get('aperture'):
                    exif_score += 0.05
                
                similarity_score += exif_score
                if exif_score > 0:
                    factors_checked += 1
                    
        except Exception:
            # EXIF comparison failed, continue without it
            pass
        
        # Balanced criteria for burst grouping
        if time_diff <= 10000 and similarity_score >= 0.5:
            # Photos within 10 seconds with moderate similarity - likely burst sequence
            return min(similarity_score + 0.45, 1.0)
        elif time_diff <= 30000 and similarity_score >= 0.8:
            # Photos within 30 seconds with high similarity
            return min(similarity_score + 0.15, 1.0)
        elif time_diff <= 60000 and similarity_score >= 0.9:
            # Photos within 1 minute with very high similarity
            return min(similarity_score, 1.0)
        
        return min(similarity_score, 1.0)
    
    def _get_common_prefix(self, str1: str, str2: str) -> str:
        """
        Get common prefix between two strings
        
        Args:
            str1: First string
            str2: Second string
            
        Returns:
            Common prefix string
        """
        i = 0
        while (i < len(str1) and 
               i < len(str2) and 
               str1[i] == str2[i]):
            i += 1
        return str1[:i]
    
    async def _create_burst_group(self, photos: List[Dict[str, Any]]) -> BurstGroup:
        """
        Create a burst group from similar photos
        
        Args:
            photos: List of similar photos
            
        Returns:
            BurstGroup object
        """
        group_id = str(uuid.uuid4())
        
        # Calculate time span
        times = [self._get_photo_time(p) for p in photos]
        time_span = int(max(times) - min(times))
        
        # Calculate actual average similarity between all pairs
        total_similarity = 0.0
        pair_count = 0
        
        for i in range(len(photos)):
            for j in range(i + 1, len(photos)):
                similarity = await self._calculate_photo_similarity(photos[i], photos[j])
                total_similarity += similarity
                pair_count += 1
        
        average_similarity = total_similarity / pair_count if pair_count > 0 else 0.0
        
        # Find the best photo (largest file size usually indicates best quality)
        def get_file_size(photo: Dict[str, Any]) -> int:
            """Get file size from photo"""
            return photo.get('fileSize') or photo.get('file_size') or 0
        
        def get_created_time(photo: Dict[str, Any]) -> datetime:
            """Get creation time from photo"""
            created_at = photo.get('createdAt') or photo.get('created_at')
            if isinstance(created_at, str):
                try:
                    return datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                except ValueError:
                    return datetime.now()
            elif hasattr(created_at, 'replace'):  # datetime object
                return created_at
            return datetime.now()
        
        suggested_best = photos[0]
        for photo in photos[1:]:
            current_size = get_file_size(photo)
            best_size = get_file_size(suggested_best)
            
            if not best_size and current_size:
                suggested_best = photo
            elif best_size and not current_size:
                continue  # Keep current best
            elif current_size > best_size:
                suggested_best = photo
            elif current_size == best_size:
                # If same size, prefer most recent
                if get_created_time(photo) > get_created_time(suggested_best):
                    suggested_best = photo
        
        # Determine group reason
        group_reason = 'Similar photos taken within 10 seconds'
        if time_span < 5000:
            group_reason = 'Rapid burst sequence (under 5 seconds)'
        elif time_span < 10000:
            group_reason = 'Quick burst sequence (under 10 seconds)'
        
        # Normalize photo data for consistent format
        normalized_photos = []
        for photo in photos:
            media_asset = photo.get('mediaAsset', {})
            if not media_asset:
                media_asset = photo.get('media_asset', {})
            
            normalized_photos.append({
                'id': photo['id'],
                'filePath': photo.get('filePath') or photo.get('file_path', ''),
                'metadata': photo.get('metadata', {}),
                'mediaAsset': {
                    'originalFilename': (media_asset.get('originalFilename') or 
                                       media_asset.get('original_filename', ''))
                },
                'createdAt': photo.get('createdAt') or photo.get('created_at', ''),
                'fileSize': get_file_size(photo),
                'fileHash': photo.get('fileHash') or photo.get('file_hash', '')
            })
        
        return BurstGroup(
            id=group_id,
            photos=normalized_photos,
            suggested_best=suggested_best['id'],
            average_similarity=average_similarity,
            time_span=time_span,
            group_reason=group_reason
        )
    
    def _generate_empty_analysis(self) -> BurstAnalysis:
        """Generate empty analysis result"""
        return BurstAnalysis(
            groups=[],
            total_photos=0,
            ungrouped_photos=[]
        )


# Global service instance
burst_photo_service = BurstPhotoDetectionService()


# Convenience functions
async def analyze_burst_photos(all_photos: List[Dict[str, Any]]) -> BurstAnalysis:
    """Analyze photos for burst sequences"""
    return await burst_photo_service.analyze_burst_photos(all_photos)