/**
 * Reverse Geocoding Service
 * Converts GPS coordinates to human-readable place names using OpenStreetMap Nominatim API
 */

interface GeocodingResult {
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export class ReverseGeocodingService {
  private readonly baseUrl = 'https://nominatim.openstreetmap.org/reverse';
  private readonly requestDelay = 1000; // 1 second delay between requests per Nominatim usage policy
  private lastRequestTime = 0;

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    try {
      // Rate limiting to respect Nominatim usage policy
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.requestDelay) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
      }
      this.lastRequestTime = Date.now();

      const params = new URLSearchParams({
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
          'User-Agent': 'Pictallion Photo Management System/1.0'
        }
      });

      if (!response.ok) {
        // warn(`Reverse geocoding failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (!data || !data.display_name) {
        return null;
      }

      const placeName = this.extractPlaceName(data);
      const placeType = this.determinePlaceType(data);

      return {
        placeName,
        placeType,
      };
    } catch (error) {
      // error('Reverse geocoding error:', error);
      return null;
    }
  }

  private extractPlaceName(data: any): string {
    const address = data.address || {};
    
    const candidates = [
      address.amenity,           // Specific venues (restaurants, shops, etc.)
      address.shop,              // Shops and stores
      address.tourism,           // Tourist attractions
      address.leisure,           // Parks, recreation areas
      address.building,          // Named buildings
      address.house_number && address.road ? `${address.house_number} ${address.road}` : null,
      address.road,              // Street name
      address.neighbourhood,     // Neighborhood
      address.suburb,            // Suburb
      address.village,           // Village
      address.town,              // Town
      address.city,              // City
      address.county,            // County
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return data.display_name || 'Unknown Location';
  }

  private determinePlaceType(data: any): string {
    const address = data.address || {};

    if (address.amenity) return 'business';
    if (address.shop) return 'retail';
    if (address.tourism) return 'attraction';
    if (address.leisure) return 'recreation';
    if (address.building) return 'building';
    if (address.road) return 'address';
    if (address.neighbourhood || address.suburb) return 'residential';
    if (address.village || address.town || address.city) return 'municipal';
    
    return 'location';
  }

  async batchReverseGeocode(coordinates: Array<{latitude: number, longitude: number}>): Promise<Array<GeocodingResult | null>> {
    const results: Array<GeocodingResult | null> = [];
    
    for (const coord of coordinates) {
      const result = await this.reverseGeocode(coord.latitude, coord.longitude);
      results.push(result);
    }
    
    return results;
  }

  static areCoordinatesSimilar(
  ): boolean {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance <= toleranceMeters;
  }
}

export const reverseGeocodingService = new ReverseGeocodingService();