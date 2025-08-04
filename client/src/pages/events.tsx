import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Search,
  Filter,
  Users,
  Gift,
  Camera,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import type { Photo } from '@shared/types';

interface EventSummary {
  eventType: string;
  eventName: string;
  photoCount: number;
  latestPhoto: string;
  confidence?: number;
  dates: string[];
}

interface DetectedEvent {
  eventId: string;
  eventName: string;
  eventType: string;
  confidence: number;
  personId?: string;
  personName?: string;
  age?: number;
}

export default function EventsPage() {
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);

  // Fetch all photos to analyze events
  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: ['/api/photos'],
  });

  // Extract photo date from filename or EXIF
  const extractPhotoDate = (photo: Photo): string | null => {
    try {
      // First try EXIF datetime fields with validation
      if (photo.metadata?.exif) {
        const exif = photo.metadata.exif;

        // Try DateTimeOriginal first (most accurate)
        if (exif.dateTimeOriginal) {
          const date = new Date(exif.dateTimeOriginal);
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() > 1900 &&
            date.getFullYear() < 2100
          ) {
            return date.toISOString().split('T')[0];
          }
        }

        // Try CreateDate
        if (exif.createDate) {
          const date = new Date(exif.createDate);
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() > 1900 &&
            date.getFullYear() < 2100
          ) {
            return date.toISOString().split('T')[0];
          }
        }

        // Try DateTime
        if (exif.dateTime) {
          const date = new Date(exif.dateTime);
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() > 1900 &&
            date.getFullYear() < 2100
          ) {
            return date.toISOString().split('T')[0];
          }
        }
      }

      // Try to extract from filename if it has timestamp format (YYYYMMDD_HHMMSS)
      const filename = photo.mediaAsset?.originalFilename || '';
      const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
      if (timestampMatch) {
        const dateStr = timestampMatch[1]; // YYYYMMDD
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substring(6, 8));

        const extractedDate = new Date(year, month, day);
        if (
          !isNaN(extractedDate.getTime()) &&
          extractedDate.getFullYear() > 1900 &&
          extractedDate.getFullYear() < 2100
        ) {
          return extractedDate.toISOString().split('T')[0];
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting photo date:', error);
      return null;
    }
  };

  // Get detected events for all photos
  const { data: allDetectedEvents = {} } = useQuery({
    queryKey: ['/api/events/all-detected', photos.length],
    queryFn: async () => {
      const eventsByPhoto: Record<string, DetectedEvent[]> = {};

      for (const photo of photos) {
        const photoDate = extractPhotoDate(photo);
        if (photoDate) {
          try {
            const response = await apiRequest('POST', '/api/events/detect', {
              photoDate,
            });
            const events = await response.json();
            if (events.length > 0) {
              eventsByPhoto[photo.id] = events;
            }
          } catch (error) {
            console.error('Error detecting events for photo:', photo.id, error);
          }
        }
      }

      return eventsByPhoto;
    },
    enabled: photos.length > 0,
  });

  // Process events into summary format
  const processEvents = (): EventSummary[] => {
    const eventSummaries: Record<string, EventSummary> = {};

    // Process auto-detected events
    Object.entries(allDetectedEvents).forEach(([photoId, events]) => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) return;

      events.forEach((event) => {
        const key = `${event.eventType}_${event.eventName}`;
        if (!eventSummaries[key]) {
          eventSummaries[key] = {
            eventType: event.eventType,
            eventName: event.eventName,
            photoCount: 0,
            latestPhoto: '',
            confidence: event.confidence,
            dates: [],
          };
        }

        eventSummaries[key].photoCount++;
        eventSummaries[key].latestPhoto = `/api/files/${photo.filePath}`;

        const photoDate = extractPhotoDate(photo);
        if (photoDate && !eventSummaries[key].dates.includes(photoDate)) {
          eventSummaries[key].dates.push(photoDate);
        }
      });
    });

    // Process manual events
    photos.forEach((photo) => {
      if (photo.eventType || photo.eventName) {
        const key = `${photo.eventType || 'manual'}_${photo.eventName || 'Event'}`;
        if (!eventSummaries[key]) {
          eventSummaries[key] = {
            eventType: photo.eventType || 'manual',
            eventName: photo.eventName || 'Event',
            photoCount: 0,
            latestPhoto: '',
            dates: [],
          };
        }

        eventSummaries[key].photoCount++;
        eventSummaries[key].latestPhoto = `/api/files/${photo.filePath}`;

        const photoDate = extractPhotoDate(photo);
        if (photoDate && !eventSummaries[key].dates.includes(photoDate)) {
          eventSummaries[key].dates.push(photoDate);
        }
      }
    });

    return Object.values(eventSummaries).sort((a, b) => b.photoCount - a.photoCount);
  };

  const eventSummaries = processEvents();

  // Filter events
  const filteredEvents = eventSummaries.filter((event) => {
    const matchesType =
      selectedEventType === 'all' || event.eventType === selectedEventType;
    const matchesSearch = event.eventName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Get photos for selected event
  const getPhotosForEvent = (event: EventSummary): Photo[] => {
    return photos.filter((photo) => {
      // Check manual events
      if (
        (photo.eventType === event.eventType ||
          (!photo.eventType && event.eventType === 'manual')) &&
        (photo.eventName === event.eventName ||
          (!photo.eventName && event.eventName === 'Event'))
      ) {
        return true;
      }

      // Check auto-detected events
      const detectedEvents = allDetectedEvents[photo.id] || [];
      return detectedEvents.some(
        (detected) =>
          detected.eventType === event.eventType &&
          detected.eventName === event.eventName,
      );
    });
  };

  const eventTypes = Array.from(new Set(eventSummaries.map((e) => e.eventType)));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Events
          </h1>
          <p className="text-muted-foreground">
            Browse photos by detected events and celebrations
          </p>
        </div>
      </header>

      <Tabs defaultValue="gallery" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gallery">Event Gallery</TabsTrigger>
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="sm:w-48">
                  <Select
                    value={selectedEventType}
                    onValueChange={setSelectedEventType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      {eventTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Grid */}
          {selectedEvent ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEvent(null)}
                  className="flex items-center gap-2"
                >
                  ← Back to Events
                </Button>
                <div>
                  <h2 className="text-2xl font-bold">{selectedEvent.eventName}</h2>
                  <p className="text-muted-foreground">
                    {selectedEvent.photoCount} photos • {selectedEvent.eventType}
                  </p>
                </div>
              </div>

              {/* Photos for selected event */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {getPhotosForEvent(selectedEvent).map((photo) => (
                  <div key={photo.id} className="group cursor-pointer">
                    <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                      <img
                        src={`/api/files/${photo.filePath}`}
                        alt={photo.mediaAsset.originalFilename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2">
                      <Badge
                        className={cn('text-xs', {
                          'bg-yellow-500': photo.tier === 'gold',
                          'bg-gray-500': photo.tier === 'silver',
                          'bg-orange-500': photo.tier === 'bronze',
                        })}
                      >
                        {photo.tier}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedEvent(event)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {event.eventType === 'holiday' && (
                          <Gift className="w-5 h-5 text-green-600" />
                        )}
                        {event.eventType === 'birthday' && (
                          <Users className="w-5 h-5 text-blue-600" />
                        )}
                        {event.eventType === 'manual' && (
                          <Camera className="w-5 h-5 text-purple-600" />
                        )}
                        <CardTitle className="text-lg">{event.eventName}</CardTitle>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {event.eventType}
                      </Badge>
                      {event.confidence && (
                        <Badge
                          variant={
                            event.confidence >= 95
                              ? 'default'
                              : event.confidence >= 80
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {event.confidence}%
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Preview image */}
                      {event.latestPhoto && (
                        <div className="aspect-video overflow-hidden rounded-md bg-muted">
                          <img
                            src={event.latestPhoto}
                            alt={event.eventName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Camera className="w-4 h-4" />
                          {event.photoCount} photo{event.photoCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {event.dates.length} date{event.dates.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredEvents.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedEventType !== 'all'
                    ? 'Try adjusting your filters to see more events.'
                    : 'Upload photos with dates to automatically detect events, or manually tag photos with event information.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Timeline View</h3>
              <p className="text-muted-foreground">
                Timeline view showing events chronologically - coming soon!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
