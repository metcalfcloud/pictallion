import { useState } from "react";
import { MapPin, Camera, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Location } from "@shared/schema";

interface LocationHotspot {
  latitude: number;
  longitude: number;
  photoCount: number;
  photos: any[];
  suggestedName?: string;
}

interface LocationMapProps {
  locations: Location[];
  hotspots: LocationHotspot[];
}

export default function LocationMap({ locations, hotspots }: LocationMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<LocationHotspot | null>(null);

  // Calculate map bounds from all locations and hotspots
  const allPoints = [
    ...locations.map(loc => ({ lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) })),
    ...hotspots.map(spot => ({ lat: spot.latitude, lng: spot.longitude }))
  ];

  const bounds = allPoints.length > 0 ? {
    minLat: Math.min(...allPoints.map(p => p.lat)),
    maxLat: Math.max(...allPoints.map(p => p.lat)),
    minLng: Math.min(...allPoints.map(p => p.lng)),
    maxLng: Math.max(...allPoints.map(p => p.lng))
  } : null;

  // Calculate center point
  const center = bounds ? {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2
  } : { lat: 0, lng: 0 };

  // Convert coordinates to map position (simple projection)
  const coordsToMapPosition = (lat: number, lng: number) => {
    if (!bounds) return { x: 50, y: 50 };
    
    const xPercent = bounds.maxLng === bounds.minLng ? 50 : 
      ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 80 + 10;
    const yPercent = bounds.maxLat === bounds.minLat ? 50 : 
      ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 80 + 10;
    
    return { x: xPercent, y: yPercent };
  };

  if (allPoints.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Location Data</h3>
          <p className="text-muted-foreground">
            Upload photos with GPS data to see them on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 overflow-hidden">
      {/* Map Grid Background */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Location Markers */}
      {locations.map((location) => {
        const pos = coordsToMapPosition(parseFloat(location.latitude), parseFloat(location.longitude));
        return (
          <Button
            key={location.id}
            variant={selectedLocation?.id === location.id ? "default" : "secondary"}
            size="sm"
            className="absolute transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => setSelectedLocation(location)}
          >
            <MapPin className="w-4 h-4 mr-1" />
            {location.photoCount}
          </Button>
        );
      })}

      {/* Hotspot Markers */}
      {hotspots.map((hotspot, index) => {
        const pos = coordsToMapPosition(hotspot.latitude, hotspot.longitude);
        return (
          <Button
            key={`hotspot-${index}`}
            variant={selectedHotspot === hotspot ? "default" : "outline"}
            size="sm"
            className="absolute transform -translate-x-1/2 -translate-y-1/2 shadow-lg border-dashed"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => setSelectedHotspot(hotspot)}
          >
            <Zap className="w-4 h-4 mr-1" />
            {hotspot.photoCount}
          </Button>
        );
      })}

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <h4 className="font-medium mb-2">Map Legend</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-primary rounded flex items-center justify-center">
              <MapPin className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
            <span>Named Locations</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-dashed border-muted-foreground rounded flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-muted-foreground" />
            </div>
            <span>Photo Hotspots</span>
          </div>
        </div>
      </div>

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium">{selectedLocation.name}</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLocation(null)}
            >
              ×
            </Button>
          </div>
          {selectedLocation.description && (
            <p className="text-sm text-muted-foreground mb-2">{selectedLocation.description}</p>
          )}
          {selectedLocation.placeName && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">{selectedLocation.placeName}</p>
          )}
          <div className="flex items-center justify-between text-sm">
            <Badge variant="outline" className="flex items-center space-x-1">
              <Camera className="w-3 h-3" />
              <span>{selectedLocation.photoCount} photos</span>
            </Badge>
            <Badge variant={selectedLocation.isUserDefined ? "default" : "secondary"}>
              {selectedLocation.isUserDefined ? "Custom" : "Auto"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {selectedLocation.latitude}, {selectedLocation.longitude}
          </p>
        </div>
      )}

      {/* Selected Hotspot Info */}
      {selectedHotspot && (
        <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium">Photo Hotspot</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedHotspot(null)}
            >
              ×
            </Button>
          </div>
          {selectedHotspot.suggestedName && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
              Suggested: {selectedHotspot.suggestedName}
            </p>
          )}
          <div className="flex items-center justify-between text-sm mb-2">
            <Badge variant="outline" className="flex items-center space-x-1">
              <Camera className="w-3 h-3" />
              <span>{selectedHotspot.photoCount} photos</span>
            </Badge>
            <Badge variant="secondary">Unnamed</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedHotspot.latitude.toFixed(6)}, {selectedHotspot.longitude.toFixed(6)}
          </p>
        </div>
      )}

      {/* Coordinates Display */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 shadow-lg text-xs text-muted-foreground">
        Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
      </div>
    </div>
  );
}