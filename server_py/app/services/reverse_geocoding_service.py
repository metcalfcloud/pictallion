"""
Reverse Geocoding Service for Pictallion

Converts GPS coordinates to human-readable place names using OpenStreetMap Nominatim API.
Provides rate-limited access with intelligent place name extraction and batch processing capabilities.
"""

import asyncio
import math
import time
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

import httpx
from ..core.config import get_settings


@dataclass
class GeocodingResult:
    """Result of reverse geocoding operation"""
    place_name: str
    place_type: str
    address: Optional[Dict[str, str]] = None


@dataclass
class Coordinate:
    """GPS coordinate pair"""
    latitude: float
    longitude: float


class ReverseGeocodingService:
    """Service for converting GPS coordinates to place names"""
    
    def __init__(self):
        self.base_url = 'https://nominatim.openstreetmap.org/reverse'
        self.request_delay = 1.0  # 1 second delay between requests per Nominatim usage policy
        self.last_request_time = 0.0
        self.settings = get_settings()
    
    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[GeocodingResult]:
        """
        Convert GPS coordinates to human-readable place information
        
        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            
        Returns:
            GeocodingResult with place information or None if geocoding fails
        """
        try:
            # Rate limiting to respect Nominatim usage policy
            await self._enforce_rate_limit()
            
            params = {
                'format': 'json',
                'lat': str(latitude),
                'lon': str(longitude),
                'zoom': '18',  # High detail level
                'addressdetails': '1',
            }
            
            headers = {
                'User-Agent': 'Pictallion Photo Management System/1.0'
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(self.base_url, params=params, headers=headers)
                
                if not response.is_success:
                    print(f"Reverse geocoding failed: {response.status_code} {response.reason_phrase}")
                    return None
                
                data = response.json()
                
                if not data or not data.get('display_name'):
                    return None
                
                # Extract meaningful place name
                place_name = self._extract_place_name(data)
                place_type = self._determine_place_type(data)
                
                return GeocodingResult(
                    place_name=place_name,
                    place_type=place_type,
                    address=data.get('address')
                )
                
        except Exception as e:
            print(f"Reverse geocoding error: {e}")
            return None
    
    async def _enforce_rate_limit(self) -> None:
        """Enforce rate limiting to respect Nominatim usage policy"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        
        if time_since_last_request < self.request_delay:
            sleep_time = self.request_delay - time_since_last_request
            await asyncio.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _extract_place_name(self, data: Dict[str, Any]) -> str:
        """
        Extract meaningful place name from geocoding response
        
        Args:
            data: Nominatim API response data
            
        Returns:
            Extracted place name
        """
        address = data.get('address', {})
        
        # Priority order for place naming
        candidates = [
            address.get('amenity'),           # Specific venues (restaurants, shops, etc.)
            address.get('shop'),              # Shops and stores
            address.get('tourism'),           # Tourist attractions
            address.get('leisure'),           # Parks, recreation areas
            address.get('building'),          # Named buildings
            self._get_street_address(address),  # House number + road
            address.get('road'),              # Street name
            address.get('neighbourhood'),     # Neighborhood
            address.get('suburb'),            # Suburb
            address.get('village'),           # Village
            address.get('town'),              # Town
            address.get('city'),              # City
            address.get('county'),            # County
        ]
        
        # Find first non-empty candidate
        for candidate in candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        
        # Fallback to display name
        return data.get('display_name', 'Unknown Location')
    
    def _get_street_address(self, address: Dict[str, Any]) -> Optional[str]:
        """
        Combine house number and road into street address
        
        Args:
            address: Address components from Nominatim
            
        Returns:
            Combined street address or None
        """
        house_number = address.get('house_number')
        road = address.get('road')
        
        if house_number and road:
            return f"{house_number} {road}"
        
        return None
    
    def _determine_place_type(self, data: Dict[str, Any]) -> str:
        """
        Determine the type of place based on address components
        
        Args:
            data: Nominatim API response data
            
        Returns:
            Place type category
        """
        address = data.get('address', {})
        
        # Categorize based on address components
        if address.get('amenity'):
            return 'business'
        if address.get('shop'):
            return 'retail'
        if address.get('tourism'):
            return 'attraction'
        if address.get('leisure'):
            return 'recreation'
        if address.get('building'):
            return 'building'
        if address.get('road'):
            return 'address'
        if address.get('neighbourhood') or address.get('suburb'):
            return 'residential'
        if address.get('village') or address.get('town') or address.get('city'):
            return 'municipal'
        
        return 'location'
    
    async def batch_reverse_geocode(self, coordinates: List[Coordinate]) -> List[Optional[GeocodingResult]]:
        """
        Perform batch reverse geocoding with rate limiting
        
        Args:
            coordinates: List of coordinate pairs to geocode
            
        Returns:
            List of geocoding results (same order as input)
        """
        results: List[Optional[GeocodingResult]] = []
        
        for coord in coordinates:
            result = await self.reverse_geocode(coord.latitude, coord.longitude)
            results.append(result)
        
        return results
    
    @staticmethod
    def are_coordinates_similar(
        lat1: float, 
        lon1: float, 
        lat2: float, 
        lon2: float, 
        tolerance_meters: float = 100.0
    ) -> bool:
        """
        Check if coordinates look like they're for the same general location
        
        Args:
            lat1: First latitude
            lon1: First longitude
            lat2: Second latitude
            lon2: Second longitude
            tolerance_meters: Distance tolerance in meters
            
        Returns:
            True if coordinates are within tolerance distance
        """
        distance = ReverseGeocodingService.calculate_distance(lat1, lon1, lat2, lon2)
        return distance <= tolerance_meters
    
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great circle distance between two points on Earth using Haversine formula
        
        Args:
            lat1: First latitude in degrees
            lon1: First longitude in degrees
            lat2: Second latitude in degrees
            lon2: Second longitude in degrees
            
        Returns:
            Distance in meters
        """
        # Earth's radius in meters
        R = 6371000
        
        # Convert degrees to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Differences
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Haversine formula
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c
        
        return distance
    
    async def geocode_if_needed(
        self, 
        latitude: float, 
        longitude: float, 
        existing_location: Optional[str] = None
    ) -> Optional[str]:
        """
        Geocode coordinates only if location information is missing or insufficient
        
        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            existing_location: Current location string (if any)
            
        Returns:
            Location string (existing or newly geocoded)
        """
        # If we already have a good location, don't waste API calls
        if existing_location and len(existing_location.strip()) > 10:
            # Check if it's more than just coordinates
            if not existing_location.replace('.', '').replace('-', '').replace(',', '').replace(' ', '').isdigit():
                return existing_location
        
        # Perform reverse geocoding
        result = await self.reverse_geocode(latitude, longitude)
        if result:
            return result.place_name
        
        # Fallback to existing location or coordinates
        return existing_location or f"{latitude:.6f}, {longitude:.6f}"
    
    def validate_coordinates(self, latitude: float, longitude: float) -> bool:
        """
        Validate that coordinates are within valid ranges
        
        Args:
            latitude: Latitude to validate
            longitude: Longitude to validate
            
        Returns:
            True if coordinates are valid
        """
        return (-90.0 <= latitude <= 90.0) and (-180.0 <= longitude <= 180.0)


# Global service instance
reverse_geocoding_service = ReverseGeocodingService()


# Convenience functions
async def reverse_geocode(latitude: float, longitude: float) -> Optional[GeocodingResult]:
    """Convert GPS coordinates to place information"""
    return await reverse_geocoding_service.reverse_geocode(latitude, longitude)


async def batch_reverse_geocode(coordinates: List[Coordinate]) -> List[Optional[GeocodingResult]]:
    """Perform batch reverse geocoding"""
    return await reverse_geocoding_service.batch_reverse_geocode(coordinates)


def are_coordinates_similar(
    lat1: float, lon1: float, lat2: float, lon2: float, tolerance_meters: float = 100.0
) -> bool:
    """Check if coordinates are for the same general location"""
    return ReverseGeocodingService.are_coordinates_similar(lat1, lon1, lat2, lon2, tolerance_meters)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters"""
    return ReverseGeocodingService.calculate_distance(lat1, lon1, lat2, lon2)