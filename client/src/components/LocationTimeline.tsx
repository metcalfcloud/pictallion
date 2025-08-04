import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, Camera, Calendar, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
interface Location {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  description?: string;
  placeName?: string;
}

interface LocationTimelineProps {
  locations: Location[];
}

interface TimelineEvent {
  date: string;
  location: Location;
  photoCount: number;
  type: 'visit' | 'first_visit' | 'frequent_visit';
}

export default function LocationTimeline({ locations }: LocationTimelineProps) {
  const [timeRange, setTimeRange] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  interface Photo {
    gpsLatitude?: string;
    gpsLongitude?: string;
    capturedAt?: string;
    createdAt?: string;
    [key: string]: unknown;
  }
  
  // Fetch photo data for timeline analysis
  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: ['/api/photos'],
  });

  // Generate timeline events from photos and locations
  const timelineEvents = useMemo(() => {
    if (!photos.length || !locations.length) return [];

    const events: TimelineEvent[] = [];

    // Group photos by location and date
    const locationVisits = new Map<string, Map<string, number>>();

    photos.forEach((photo) => {
      if (
        typeof photo.gpsLatitude !== 'string' ||
        photo.gpsLatitude.trim() === '' ||
        typeof photo.gpsLongitude !== 'string' ||
        photo.gpsLongitude.trim() === ''
      )
        return;

      // Find matching location (within reasonable distance)
      const matchingLocation = locations.find((loc) => {
        if (
          typeof loc.latitude !== 'string' ||
          typeof loc.longitude !== 'string' ||
          loc.latitude.trim() === '' ||
          loc.longitude.trim() === ''
        )
          return false;
        const lat1 = parseFloat(loc.latitude);
        const lng1 = parseFloat(loc.longitude);
        const lat2 = parseFloat(photo.gpsLatitude as string);
        const lng2 = parseFloat(photo.gpsLongitude as string);

        // Simple distance calculation (approximately 100m radius)
        const distance = Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
        return distance < 0.001; // Roughly 100m
      });

      if (
        matchingLocation &&
        typeof matchingLocation.id === 'string' &&
        (typeof photo.capturedAt === 'string' || typeof photo.createdAt === 'string')
      ) {
        const dateStr = photo.capturedAt ?? photo.createdAt;
        const dateObj = typeof dateStr === 'string' ? new Date(dateStr) : null;
        const date =
          dateObj && !isNaN(dateObj.getTime())
            ? dateObj.toISOString().split('T')[0]
            : '';

        if (date === '') return;

        if (!locationVisits.has(matchingLocation.id)) {
          locationVisits.set(matchingLocation.id, new Map());
        }

        const locationDates = locationVisits.get(matchingLocation.id);
        if (locationDates) {
          locationDates.set(date, (locationDates.get(date) ?? 0) + 1);
        }
      }
    });

    // Convert to timeline events
    locationVisits.forEach((dates, locationId) => {
      const location = locations.find(
        (loc) => typeof loc.id === 'string' && loc.id === locationId,
      );
      if (!location || typeof location.id !== 'string') return;

      const sortedDates = Array.from(dates.entries()).sort(([a], [b]) =>
        a.localeCompare(b),
      );

      sortedDates.forEach(([date, photoCount], index) => {
        const eventType =
          index === 0 ? 'first_visit' : photoCount >= 5 ? 'frequent_visit' : 'visit';

        events.push({
          date,
          location,
          photoCount: typeof photoCount === 'number' ? photoCount : 0,
          type: eventType,
        });
      });
    });

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [photos, locations]);

  // Filter events based on selected criteria
  const filteredEvents = useMemo(() => {
    let filtered = timelineEvents;

    if (selectedLocation !== 'all') {
      filtered = filtered.filter(
        (event) => event.location.id === selectedLocation,
      );
    }

    if (timeRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (timeRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter((event) => new Date(event.date) >= cutoffDate);
    }

    return filtered;
  }, [timelineEvents, timeRange, selectedLocation]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEvents = filteredEvents.length;
    const uniqueLocations = new Set(
      filteredEvents
        .map((e) => e.location.id)
        .filter((id) => id !== ''),
    ).size;
    const totalPhotos = filteredEvents.reduce(
      (sum, event) => sum + event.photoCount,
      0,
    );
    const firstVisits = filteredEvents.filter((e) => e.type === 'first_visit').length;

    return { totalEvents, uniqueLocations, totalPhotos, firstVisits };
  }, [filteredEvents]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'first_visit':
        return <MapPin className="w-4 h-4 text-green-500" />;
      case 'frequent_visit':
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
      default:
        return <Camera className="w-4 h-4 text-blue-500" />;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'first_visit':
        return 'First Visit';
      case 'frequent_visit':
        return 'Active Day';
      default:
        return 'Visit';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (timelineEvents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Timeline Data</h3>
          <p className="text-muted-foreground">
            Upload photos with timestamps and GPS data to see your location timeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past Month</SelectItem>
              <SelectItem value="year">Past Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations
                .filter((location) => typeof location.id === 'string')
                .map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {typeof location.name === 'string' ? location.name : ''}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>{stats.totalEvents} events</span>
          <span>{stats.uniqueLocations} locations</span>
          <span>{stats.totalPhotos} photos</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {filteredEvents.map((event, index) => (
            <div
              key={`${
                event.location.id
              }-${event.date}`}
              className="flex items-start space-x-4"
            >
              {/* Timeline Line */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                  {getEventIcon(event.type)}
                </div>
                {index < filteredEvents.length - 1 && (
                  <div className="w-0.5 h-8 bg-border mt-2" />
                )}
              </div>

              {/* Event Details */}
              <Card className="flex-1">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium">
                        {event.location.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(event.date)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{getEventLabel(event.type)}</Badge>
                      <Badge variant="secondary">{event.photoCount} photos</Badge>
                    </div>
                  </div>

                  {typeof event.location.description === 'string' &&
                    event.location.description.trim() !== '' && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {event.location.description}
                    </p>
                  )}

                  {typeof event.location.placeName === 'string' &&
                    event.location.placeName.trim() !== '' && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {event.location.placeName}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
