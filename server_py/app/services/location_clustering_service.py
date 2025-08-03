"""
Location Clustering Service

Provides geographic clustering and analysis of photos based on their GPS coordinates.
Features include:
- Coordinate extraction from EXIF and AI metadata
- Photo clustering by geographic proximity
- Hotspot detection for frequently visited locations
- Location statistics and analytics
- Intelligent location naming suggestions
"""

import logging
import math
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
from collections import Counter

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class PhotoWithLocation:
    """Represents a photo with GPS coordinates"""
    id: str
    latitude: float
    longitude: float
    media_asset: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class LocationCluster:
    """Represents a cluster of photos at similar geographic locations"""
    center_latitude: float
    center_longitude: float
    photos: List[PhotoWithLocation]
    radius: float

@dataclass
class LocationHotspot:
    """Represents a location hotspot with multiple photos"""
    latitude: float
    longitude: float
    photo_count: int
    photos: List[Dict[str, Any]]
    suggested_name: Optional[str] = None

@dataclass
class LocationStats:
    """Location coverage and distribution statistics"""
    total_photos_with_location: int
    coverage_percentage: float
    average_photos_per_location: float

class LocationClusteringService:
    """Service for geographic clustering and analysis of photos"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two coordinates in meters using Haversine formula
        
        Args:
            lat1, lon1: First coordinate
            lat2, lon2: Second coordinate
            
        Returns:
            Distance in meters
        """
        R = 6371000  # Earth's radius in meters
        d_lat = self._to_radians(lat2 - lat1)
        d_lon = self._to_radians(lon2 - lon1)
        
        a = (math.sin(d_lat / 2) * math.sin(d_lat / 2) +
             math.cos(self._to_radians(lat1)) * math.cos(self._to_radians(lat2)) *
             math.sin(d_lon / 2) * math.sin(d_lon / 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _to_radians(self, degrees: float) -> float:
        """Convert degrees to radians"""
        return degrees * (math.pi / 180)
    
    def extract_coordinates(self, photos: List[Dict[str, Any]]) -> List[PhotoWithLocation]:
        """
        Extract GPS coordinates from photo metadata
        
        Args:
            photos: List of photo objects with metadata
            
        Returns:
            List of photos with valid GPS coordinates
        """
        photos_with_location = []
        
        for photo in photos:
            latitude = None
            longitude = None
            
            # Get metadata
            metadata = photo.get('metadata', {})
            
            # Try AI metadata first (but skip if coordinates are 0,0 which means invalid)
            ai_metadata = metadata.get('ai', {})
            gps_coords = ai_metadata.get('gpsCoordinates', {})
            
            if (gps_coords and 
                gps_coords.get('latitude', 0) != 0 and 
                gps_coords.get('longitude', 0) != 0):
                latitude = gps_coords.get('latitude')
                longitude = gps_coords.get('longitude')
            else:
                # Fall back to EXIF data
                exif_metadata = metadata.get('exif', {})
                if (exif_metadata.get('gpsLatitude') is not None and 
                    exif_metadata.get('gpsLongitude') is not None):
                    latitude = exif_metadata.get('gpsLatitude')
                    longitude = exif_metadata.get('gpsLongitude')
            
            # Validate coordinates are real GPS coordinates
            if (latitude is not None and longitude is not None and
                not math.isnan(latitude) and not math.isnan(longitude) and
                latitude != 0 and longitude != 0 and
                -90 <= latitude <= 90 and
                -180 <= longitude <= 180):
                
                photos_with_location.append(PhotoWithLocation(
                    id=photo.get('id', ''),
                    latitude=latitude,
                    longitude=longitude,
                    media_asset=photo.get('mediaAsset', {}),
                    metadata=metadata
                ))
        
        self.logger.info(f"Extracted coordinates from {len(photos_with_location)} of {len(photos)} photos")
        return photos_with_location
    
    def cluster_photos(self, photos: List[PhotoWithLocation], 
                      max_distance_meters: float = 100) -> List[LocationCluster]:
        """
        Cluster photos by location proximity
        
        Args:
            photos: Photos with GPS coordinates
            max_distance_meters: Maximum distance for clustering
            
        Returns:
            List of location clusters
        """
        clusters = []
        visited = set()
        
        for photo in photos:
            if photo.id in visited:
                continue
            
            cluster = LocationCluster(
                center_latitude=photo.latitude,
                center_longitude=photo.longitude,
                photos=[photo],
                radius=max_distance_meters
            )
            
            visited.add(photo.id)
            
            # Find all photos within the cluster radius
            for other_photo in photos:
                if other_photo.id in visited:
                    continue
                
                distance = self.calculate_distance(
                    photo.latitude, photo.longitude,
                    other_photo.latitude, other_photo.longitude
                )
                
                if distance <= max_distance_meters:
                    cluster.photos.append(other_photo)
                    visited.add(other_photo.id)
            
            # Only include clusters with photos
            if len(cluster.photos) >= 1:
                # Recalculate center based on all photos in cluster
                avg_lat = sum(p.latitude for p in cluster.photos) / len(cluster.photos)
                avg_lon = sum(p.longitude for p in cluster.photos) / len(cluster.photos)
                cluster.center_latitude = avg_lat
                cluster.center_longitude = avg_lon
                
                clusters.append(cluster)
        
        self.logger.info(f"Created {len(clusters)} location clusters")
        return clusters
    
    def find_hotspots(self, photos: List[Dict[str, Any]], 
                     min_photo_count: int = 10) -> List[LocationHotspot]:
        """
        Find location hotspots with configurable minimum photos
        
        Args:
            photos: List of photo objects
            min_photo_count: Minimum photos required for a hotspot
            
        Returns:
            List of location hotspots sorted by photo count
        """
        if not photos:
            return []
        
        photos_with_location = self.extract_coordinates(photos)
        clusters = self.cluster_photos(photos_with_location, 100)  # 100 meter radius
        
        hotspots = []
        
        for cluster in clusters:
            if len(cluster.photos) >= min_photo_count:
                # Generate suggested name based on photo patterns or metadata
                suggested_name = self._generate_suggested_name(cluster)
                
                hotspots.append(LocationHotspot(
                    latitude=cluster.center_latitude,
                    longitude=cluster.center_longitude,
                    photo_count=len(cluster.photos),
                    photos=[{
                        'id': p.id,
                        'mediaAsset': p.media_asset,
                        'metadata': p.metadata
                    } for p in cluster.photos],
                    suggested_name=suggested_name
                ))
        
        # Sort by photo count (most popular first)
        hotspots.sort(key=lambda x: x.photo_count, reverse=True)
        
        self.logger.info(f"Found {len(hotspots)} location hotspots")
        return hotspots
    
    def _generate_suggested_name(self, cluster: LocationCluster) -> Optional[str]:
        """
        Generate suggested location names based on patterns
        
        Args:
            cluster: Location cluster to analyze
            
        Returns:
            Suggested location name or None
        """
        photos = cluster.photos
        
        # Look for patterns in AI place names
        if photos:
            place_names = []
            for photo in photos:
                if (photo.metadata and 
                    photo.metadata.get('ai', {}).get('placeName')):
                    place_names.append(photo.metadata['ai']['placeName'])
            
            if place_names:
                # Return most common place name
                name_counts = Counter(place_names)
                most_common = name_counts.most_common(1)
                if most_common:
                    return most_common[0][0]
        
        # Look for event patterns
        event_types = []
        for photo in photos:
            if (photo.metadata and 
                photo.metadata.get('ai', {}).get('detectedEvents')):
                events = photo.metadata['ai']['detectedEvents']
                if events and len(events) > 0:
                    event_types.append(events[0].get('eventType'))
        
        event_types = [et for et in event_types if et]
        if len(event_types) > len(photos) * 0.5 and event_types:
            return f"{event_types[0]} Location"
        
        # Default suggestions based on photo count
        photo_count = len(photos)
        if photo_count >= 50:
            return "Frequent Location"
        elif photo_count >= 20:
            return "Regular Location"
        else:
            return "Photo Location"
    
    def calculate_location_stats(self, photos: List[Dict[str, Any]], 
                               existing_locations: List[Any]) -> LocationStats:
        """
        Calculate location statistics
        
        Args:
            photos: List of photo objects
            existing_locations: List of existing location objects
            
        Returns:
            Location coverage and distribution statistics
        """
        photos_with_location = self.extract_coordinates(photos)
        
        total_photos = len(photos)
        photos_with_coords = len(photos_with_location)
        location_count = len(existing_locations)
        
        return LocationStats(
            total_photos_with_location=photos_with_coords,
            coverage_percentage=((photos_with_coords / total_photos) * 100) if total_photos > 0 else 0,
            average_photos_per_location=(photos_with_coords / location_count) if location_count > 0 else 0
        )
    
    def get_nearby_photos(self, latitude: float, longitude: float, 
                         photos: List[Dict[str, Any]], 
                         radius_meters: float = 1000) -> List[PhotoWithLocation]:
        """
        Get photos within a specified radius of a location
        
        Args:
            latitude, longitude: Center coordinates
            photos: List of photo objects to search
            radius_meters: Search radius in meters
            
        Returns:
            List of photos within the radius
        """
        photos_with_location = self.extract_coordinates(photos)
        nearby_photos = []
        
        for photo in photos_with_location:
            distance = self.calculate_distance(
                latitude, longitude,
                photo.latitude, photo.longitude
            )
            
            if distance <= radius_meters:
                nearby_photos.append(photo)
        
        return nearby_photos
    
    def get_location_bounds(self, photos: List[PhotoWithLocation]) -> Optional[Dict[str, float]]:
        """
        Calculate geographic bounding box for a set of photos
        
        Args:
            photos: Photos with GPS coordinates
            
        Returns:
            Dictionary with north, south, east, west bounds or None if no photos
        """
        if not photos:
            return None
        
        latitudes = [p.latitude for p in photos]
        longitudes = [p.longitude for p in photos]
        
        return {
            'north': max(latitudes),
            'south': min(latitudes),
            'east': max(longitudes),
            'west': min(longitudes)
        }

# Singleton instance
location_clustering_service = LocationClusteringService()