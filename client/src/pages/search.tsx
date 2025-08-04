import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Grid,
  List,
  Filter,
  Search as SearchIcon,
  Star,
  Calendar,
  MapPin,
  Tag,
  Camera,
  Users,
  Download,
  Heart,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdvancedSearch } from '@/components/advanced-search';
import { RatingSystem } from '@/components/rating-system';
import type { SearchFilters } from '@/components/advanced-search';
import { apiRequest } from '@/lib/queryClient';

interface Photo {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  filePath: string;
  mimeType: string;
  fileSize: number;
  metadata: any;
  isReviewed: boolean;
  rating?: number;
  keywords?: string[];
  location?: string;
  eventType?: string;
  eventName?: string;
  createdAt: string;
  mediaAsset: {
    id: string;
    originalFilename: string;
  };
}

export default function Search() {
  const [, setLocation] = useLocation();
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Fetch search results
  const {
    data: searchResults,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/photos/search', searchFilters, sortBy, sortDirection],
    queryFn: async () => {
      const sort = { field: sortBy, direction: sortDirection };

      const response = await fetch('/api/photos/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: searchFilters,
          sort,
          limit: 200,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      return response.json();
    },
  });

  const photos = (searchResults?.photos as Photo[]) || [];
  const totalCount = searchResults?.totalCount || 0;
  const facets = searchResults?.facets || {};

  const performSearch = () => {
    refetch();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'silver':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'gold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const PhotoCard = ({ photo, isSelected }: { photo: Photo; isSelected: boolean }) => {
    const aiData = photo.metadata?.ai || {};
    const exifData = photo.metadata?.exif || {};

    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-lg ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
      >
        <CardContent className="p-0">
          <div className="relative">
            <img
              src={`/api/files/${photo.filePath}`}
              alt={photo.mediaAsset?.originalFilename || 'Photo'}
              className="w-full h-48 object-cover rounded-t-lg"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-image.svg';
              }}
            />

            {/* Tier badge */}
            <Badge className={`absolute top-2 left-2 ${getTierBadgeColor(photo.tier)}`}>
              {photo.tier.charAt(0).toUpperCase() + photo.tier.slice(1)}
            </Badge>

            {/* Rating */}
            {photo.rating && photo.rating > 0 && (
              <div className="absolute top-2 right-2 bg-black/50 p-1 rounded">
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-white text-xs">{photo.rating}</span>
                </div>
              </div>
            )}

            {/* Review status */}
            {!photo.isReviewed && photo.tier === 'silver' && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="destructive" className="text-xs">
                  Needs Review
                </Badge>
              </div>
            )}
          </div>

          <div className="p-3">
            <h3 className="font-medium text-sm truncate mb-2">
              {photo.mediaAsset?.originalFilename || 'Unknown file'}
            </h3>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{formatFileSize(photo.fileSize)}</span>
                <span>{new Date(photo.createdAt).toLocaleDateString()}</span>
              </div>

              {/* AI description */}
              {aiData.shortDescription && (
                <p className="line-clamp-2">{aiData.shortDescription}</p>
              )}

              {/* Location */}
              {photo.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{photo.location}</span>
                </div>
              )}

              {/* Event */}
              {photo.eventName && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="truncate">{photo.eventName}</span>
                </div>
              )}

              {/* Camera */}
              {exifData.camera && (
                <div className="flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  <span className="truncate">{exifData.camera}</span>
                </div>
              )}

              {/* Keywords */}
              {photo.keywords && photo.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {photo.keywords.slice(0, 3).map((keyword, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                  {photo.keywords.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{photo.keywords.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const PhotoListItem = ({
    photo,
    isSelected,
  }: {
    photo: Photo;
    isSelected: boolean;
  }) => {
    const aiData = photo.metadata?.ai || {};
    const exifData = photo.metadata?.exif || {};

    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
      >
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative">
              <img
                src={`/api/files/${photo.filePath}`}
                alt={photo.mediaAsset?.originalFilename || 'Photo'}
                className="w-24 h-24 object-cover rounded"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.svg';
                }}
              />
              <Badge
                className={`absolute -top-1 -right-1 ${getTierBadgeColor(photo.tier)}`}
              >
                {photo.tier.charAt(0).toUpperCase()}
              </Badge>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium truncate pr-2">
                  {photo.mediaAsset?.originalFilename || 'Unknown file'}
                </h3>
                {photo.rating && photo.rating > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">{photo.rating}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground mb-2">
                <div>{formatFileSize(photo.fileSize)}</div>
                <div>{new Date(photo.createdAt).toLocaleDateString()}</div>
                {photo.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{photo.location}</span>
                  </div>
                )}
                {exifData.camera && (
                  <div className="flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    <span className="truncate">{exifData.camera}</span>
                  </div>
                )}
              </div>

              {aiData.shortDescription && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {aiData.shortDescription}
                </p>
              )}

              {photo.keywords && photo.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {photo.keywords.slice(0, 5).map((keyword, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                  {photo.keywords.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{photo.keywords.length - 5}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Photo Search</h1>
          <p className="text-muted-foreground">
            {totalCount === 0
              ? 'No photos found'
              : totalCount === 1
                ? '1 photo found'
                : `${totalCount} photos found`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="fileSize">File Size</SelectItem>
              <SelectItem value="eventName">Event</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() =>
              setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            }
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </Button>

          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>

          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Advanced Search */}
      <AdvancedSearch
        filters={searchFilters}
        onFiltersChange={setSearchFilters}
        onSearch={performSearch}
      />

      {/* Search Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SearchIcon className="h-8 w-8 animate-pulse mx-auto mb-4 text-blue-500" />
            <p>Searching photos...</p>
          </div>
        </div>
      ) : photos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <SearchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">No photos found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search filters or uploading more photos.
            </p>
            <Button onClick={() => setLocation('/upload')}>Upload Photos</Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
              : 'space-y-4'
          }
        >
          {photos.map((photo: Photo) =>
            viewMode === 'grid' ? (
              <PhotoCard
                key={photo.id}
                photo={photo}
                isSelected={selectedPhoto?.id === photo.id}
              />
            ) : (
              <PhotoListItem
                key={photo.id}
                photo={photo}
                isSelected={selectedPhoto?.id === photo.id}
              />
            ),
          )}
        </div>
      )}

      {/* Facets Summary */}
      {Object.keys(facets).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Search Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {facets.tiers && (
                <div>
                  <span className="text-muted-foreground">By Tier:</span>
                  {Object.entries(facets.tiers as Record<string, number>).map(
                    ([tier, count]) => (
                      <div key={tier} className="flex justify-between">
                        <span className="capitalize">{tier}:</span>
                        <span>{String(count)}</span>
                      </div>
                    ),
                  )}
                </div>
              )}

              {facets.ratings && Object.keys(facets.ratings).length > 0 && (
                <div>
                  <span className="text-muted-foreground">By Rating:</span>
                  {Object.entries(facets.ratings as Record<string, number>).map(
                    ([rating, count]) => (
                      <div key={rating} className="flex justify-between">
                        <span>{rating} stars:</span>
                        <span>{String(count)}</span>
                      </div>
                    ),
                  )}
                </div>
              )}

              {facets.mimeTypes && (
                <div>
                  <span className="text-muted-foreground">By Type:</span>
                  {Object.entries(facets.mimeTypes as Record<string, number>).map(
                    ([type, count]) => (
                      <div key={type} className="flex justify-between">
                        <span>{type.split('/')[1]?.toUpperCase()}:</span>
                        <span>{String(count)}</span>
                      </div>
                    ),
                  )}
                </div>
              )}

              {facets.eventTypes && Object.keys(facets.eventTypes).length > 0 && (
                <div>
                  <span className="text-muted-foreground">By Event:</span>
                  {Object.entries(facets.eventTypes as Record<string, number>)
                    .slice(0, 3)
                    .map(([event, count]) => (
                      <div key={event} className="flex justify-between">
                        <span className="capitalize">{event}:</span>
                        <span>{String(count)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
