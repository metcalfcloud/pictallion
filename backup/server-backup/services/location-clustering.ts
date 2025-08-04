import type { FileVersion, MediaAsset, CombinedMetadata } from "@shared/schema";

interface PhotoWithLocation {
  id: string;
  latitude: number;
  longitude: number;
  mediaAsset: MediaAsset;
  metadata?: CombinedMetadata;
}

interface LocationCluster {
  centerLatitude: number;
  centerLongitude: number;
  photos: PhotoWithLocation[];
  radius: number;
}

interface LocationHotspot {
  latitude: number;
  longitude: number;
  photoCount: number;
  photos: any[];
  suggestedName?: string;
}

export class LocationClusteringService {
  // Calculate distance between two coordinates in meters using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Extract GPS coordinates from photo metadata
  public extractCoordinates(photos: Array<FileVersion & { mediaAsset: MediaAsset }>): PhotoWithLocation[] {
    const photosWithLocation: PhotoWithLocation[] = [];

    for (const photo of photos) {
      let latitude: number | undefined;
      let longitude: number | undefined;

      // Ensure metadata exists and is properly typed
      const metadata = photo.metadata as CombinedMetadata | undefined;

      // Try AI metadata first (but skip if coordinates are 0,0 which means invalid)
      if (metadata?.ai?.gpsCoordinates && 
          metadata.ai.gpsCoordinates.latitude !== 0 && 
          metadata.ai.gpsCoordinates.longitude !== 0) {
        latitude = metadata.ai.gpsCoordinates.latitude;
        longitude = metadata.ai.gpsCoordinates.longitude;
      }
      // Fall back to EXIF data
      else if (metadata?.exif?.gpsLatitude !== undefined && metadata?.exif?.gpsLongitude !== undefined) {
        latitude = metadata.exif.gpsLatitude;
        longitude = metadata.exif.gpsLongitude;
      }

      // Validate coordinates are real GPS coordinates (not 0,0 and within valid ranges)
      if (latitude && longitude && 
          !isNaN(latitude) && !isNaN(longitude) && 
          latitude !== 0 && longitude !== 0 &&
          latitude >= -90 && latitude <= 90 &&
          longitude >= -180 && longitude <= 180) {
        photosWithLocation.push({
          id: photo.id,
          latitude,
          longitude,
          mediaAsset: photo.mediaAsset,
          metadata,
        });
      }
    }

    return photosWithLocation;
  }

  // Cluster photos by location proximity
  public clusterPhotos(photos: PhotoWithLocation[], maxDistanceMeters: number = 100): LocationCluster[] {
    const clusters: LocationCluster[] = [];
    const visited = new Set<string>();

    for (const photo of photos) {
      if (visited.has(photo.id)) continue;

      const cluster: LocationCluster = {
        centerLatitude: photo.latitude,
        centerLongitude: photo.longitude,
        photos: [photo],
        radius: maxDistanceMeters,
      };

      visited.add(photo.id);

      // Find all photos within the cluster radius
      for (const otherPhoto of photos) {
        if (visited.has(otherPhoto.id)) continue;

        const distance = this.calculateDistance(
          photo.latitude,
          photo.longitude,
          otherPhoto.latitude,
          otherPhoto.longitude
        );

        if (distance <= maxDistanceMeters) {
          cluster.photos.push(otherPhoto);
          visited.add(otherPhoto.id);
        }
      }

      // Only include clusters with multiple photos or significant single locations
      if (cluster.photos.length >= 1) {
        // Recalculate center based on all photos in cluster
        const avgLat = cluster.photos.reduce((sum, p) => sum + p.latitude, 0) / cluster.photos.length;
        const avgLon = cluster.photos.reduce((sum, p) => sum + p.longitude, 0) / cluster.photos.length;
        cluster.centerLatitude = avgLat;
        cluster.centerLongitude = avgLon;

        clusters.push(cluster);
      }
    }

    return clusters;
  }

  // Find hotspots with configurable minimum photos
  public findHotspots(photos: Array<FileVersion & { mediaAsset: MediaAsset }>, minPhotoCount: number = 10): LocationHotspot[] {
    if (photos.length === 0) {
      return [];
    }
    const photosWithLocation = this.extractCoordinates(photos);
    const clusters = this.clusterPhotos(photosWithLocation, 100); // 100 meter radius

    const hotspots: LocationHotspot[] = [];

    for (const cluster of clusters) {
      if (cluster.photos.length >= minPhotoCount) {
        // Generate suggested name based on photo patterns or metadata
        const suggestedName = this.generateSuggestedName(cluster);

        hotspots.push({
          latitude: cluster.centerLatitude,
          longitude: cluster.centerLongitude,
          photoCount: cluster.photos.length,
          photos: cluster.photos.map(p => ({
            id: p.id,
            mediaAsset: p.mediaAsset,
            metadata: p.metadata,
          })),
          suggestedName,
        });
      }
    }

    // Sort by photo count (most popular first)
    return hotspots.sort((a, b) => b.photoCount - a.photoCount);
  }

  // Generate suggested location names based on patterns
  private generateSuggestedName(cluster: LocationCluster): string | undefined {
    const photos = cluster.photos;
    
    // Look for patterns in AI place names
    if (photos.length > 0) {
      const placeNames = photos
        .map(p => p.metadata?.ai?.placeName)
        .filter(Boolean);

      if (placeNames.length > 0) {
        // Return most common place name
        const nameCounts = placeNames.reduce((acc, name) => {
          if (name) {
            acc[name] = (acc[name] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const mostCommon = Object.entries(nameCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0];

        if (mostCommon) {
          return mostCommon[0];
        }
      }
    }

    // Look for event patterns
    const eventTypes = photos
      .map(p => p.metadata?.ai?.detectedEvents?.[0]?.eventType)
      .filter(Boolean);

    if (eventTypes.length > photos.length * 0.5) {
      return `${eventTypes[0]} Location`;
    }

    // Default suggestions based on photo count
    if (photos.length >= 50) {
      return "Frequent Location";
    } else if (photos.length >= 20) {
      return "Regular Location";
    } else {
      return "Photo Location";
    }
  }

  // Calculate location statistics
  public calculateLocationStats(
    photos: Array<FileVersion & { mediaAsset: MediaAsset }>,
    existingLocations: any[]
  ): {
    totalPhotosWithLocation: number;
    coveragePercentage: number;
    averagePhotosPerLocation: number;
  } {
    const photosWithLocation = this.extractCoordinates(photos);
    
    return {
      totalPhotosWithLocation: photosWithLocation.length,
      coveragePercentage: photos.length > 0 ? (photosWithLocation.length / photos.length) * 100 : 0,
      averagePhotosPerLocation: existingLocations.length > 0 ? 
        photosWithLocation.length / existingLocations.length : 0,
    };
  }
}

export const locationClusteringService = new LocationClusteringService();