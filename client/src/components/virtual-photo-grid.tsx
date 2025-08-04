import { useMemo, useState, useRef, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { OptimizedImage } from '@/components/optimized-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Heart, Bot, Eye, Star, MoreVertical } from 'lucide-react';
import type { Photo } from '@shared/types';

interface VirtualPhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onProcessPhoto?: (photoId: string) => void;
  isProcessing?: boolean;
  selectedPhotos?: string[];
  onPhotoSelect?: (photoId: string, selected: boolean) => void;
  containerHeight: number;
  containerWidth: number;
}

interface PhotoCellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    photos: Photo[];
    columnsPerRow: number;
    onPhotoClick: (photo: Photo) => void;
    onProcessPhoto?: (photoId: string) => void;
    isProcessing?: boolean;
    selectedPhotos?: string[];
    onPhotoSelect?: (photoId: string, selected: boolean) => void;
  };
}

// Helper function to extract photo date
const extractPhotoDate = (photo: Photo): Date => {
  try {
    if (photo.metadata?.exif) {
      const exif = photo.metadata.exif as any;

      if (exif.dateTimeOriginal) {
        const date = new Date(exif.dateTimeOriginal);
        if (!isNaN(date.getTime())) return date;
      }

      if (exif.createDate) {
        const date = new Date(exif.createDate);
        if (!isNaN(date.getTime())) return date;
      }

      if (exif.dateTime) {
        const date = new Date(exif.dateTime);
        if (!isNaN(date.getTime())) return date;
      }
    }

    // Try to extract from filename
    const filename = photo.mediaAsset?.originalFilename || '';
    const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
    if (timestampMatch) {
      const dateStr = timestampMatch[1];
      const timeStr = timestampMatch[2];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6));

      const extractedDate = new Date(year, month, day, hour, minute, second);
      if (!isNaN(extractedDate.getTime())) return extractedDate;
    }

    return new Date(photo.createdAt);
  } catch (error) {
    return new Date(photo.createdAt);
  }
};

const PhotoCell = ({ columnIndex, rowIndex, style, data }: PhotoCellProps) => {
  const {
    photos,
    columnsPerRow,
    onPhotoClick,
    onProcessPhoto,
    isProcessing,
    selectedPhotos,
    onPhotoSelect,
  } = data;
  const photoIndex = rowIndex * columnsPerRow + columnIndex;

  // Return empty cell if no photo at this index
  if (photoIndex >= photos.length) {
    return <div style={style} />;
  }

  const photo = photos[photoIndex];

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'silver':
        return <Bot className="w-3 h-3" />;
      case 'gold':
        return <Star className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const canProcess = (photo: Photo) => {
    return photo.tier === 'bronze' && photo.metadata?.exif && onProcessPhoto;
  };

  const needsReview = (photo: Photo) => {
    return photo.tier === 'silver' && !photo.isReviewed;
  };

  return (
    <div style={style} className="p-3">
      <div className="relative group h-full">
        {/* Polaroid Card */}
        <div
          className="bg-white dark:bg-gray-100 p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rotate-0 hover:rotate-1 cursor-pointer h-full flex flex-col"
          onClick={() => onPhotoClick(photo)}
        >
          {/* Photo Section with Tier-Colored Frame */}
          <div
            className={cn(
              'relative rounded-sm overflow-hidden aspect-square mb-4 p-1 flex-shrink-0',
              photo.tier === 'bronze' && 'bg-orange-500',
              photo.tier === 'silver' && 'bg-slate-500',
              photo.tier === 'gold' && 'bg-yellow-500',
            )}
          >
            <div className="bg-gray-200 rounded-sm overflow-hidden w-full h-full relative">
              <OptimizedImage
                src={`/api/files/${photo.filePath}`}
                alt={photo.mediaAsset.originalFilename}
                className="w-full h-full object-cover"
                quality="thumb"
                priority={photoIndex < 20} // Priority load for first 20 photos
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200" />
            </div>

            {/* Tier-colored Push Pin */}
            <div
              className={cn(
                'absolute -top-2 -right-2 w-4 h-4 rounded-full shadow-lg transform rotate-12',
                photo.tier === 'bronze' && 'bg-orange-500',
                photo.tier === 'silver' && 'bg-slate-500',
                photo.tier === 'gold' && 'bg-yellow-500',
              )}
            >
              <div className="absolute inset-0.5 bg-white rounded-full">
                <div
                  className={cn(
                    'absolute inset-1 rounded-full',
                    photo.tier === 'bronze' && 'bg-orange-400',
                    photo.tier === 'silver' && 'bg-slate-400',
                    photo.tier === 'gold' && 'bg-yellow-400',
                  )}
                />
              </div>
            </div>

            {/* Review Badge */}
            {needsReview(photo) && (
              <div className="absolute top-2 right-2">
                <Badge
                  variant="outline"
                  className="text-yellow-600 border-yellow-600 bg-white/90"
                >
                  <Eye className="w-3 h-3" />
                </Badge>
              </div>
            )}

            {/* Selection Checkbox */}
            {onPhotoSelect && (
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                  type="checkbox"
                  checked={selectedPhotos?.includes(photo.id) || false}
                  onChange={(e) => {
                    e.stopPropagation();
                    onPhotoSelect(photo.id, e.target.checked);
                  }}
                  className="w-4 h-4 text-blue-600 bg-white rounded border-gray-300 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Polaroid White Bottom Section */}
          <div className="text-gray-800 dark:text-gray-900 flex-grow flex flex-col">
            {/* Date - Handwritten Style */}
            <div className="text-center mb-3">
              <h3 className="font-medium text-sm tracking-wide">
                {extractPhotoDate(photo).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
            </div>

            {/* Tier Label with Elegant Design */}
            <div className="flex items-center justify-between mb-2 mt-auto">
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border-2',
                  photo.tier === 'bronze' &&
                    'bg-orange-50 border-orange-200 text-orange-700',
                  photo.tier === 'silver' &&
                    'bg-slate-50 border-slate-200 text-slate-700',
                  photo.tier === 'gold' &&
                    'bg-yellow-50 border-yellow-200 text-yellow-700',
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    photo.tier === 'bronze' && 'bg-orange-400',
                    photo.tier === 'silver' && 'bg-slate-400',
                    photo.tier === 'gold' && 'bg-yellow-400',
                  )}
                />
                <span className="capitalize">{photo.tier}</span>
                {photo.tier === 'silver' && !photo.isReviewed && (
                  <Eye className="w-3 h-3 text-yellow-600" />
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Heart className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* AI Processing Button (if applicable) */}
            {canProcess(photo) && (
              <div className="flex justify-center mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProcessPhoto!(photo.id);
                  }}
                  disabled={isProcessing}
                >
                  <Bot className="w-3 h-3 mr-1" />
                  {isProcessing ? 'Processing...' : 'Enhance with AI'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function VirtualPhotoGrid({
  photos,
  onPhotoClick,
  onProcessPhoto,
  isProcessing = false,
  selectedPhotos = [],
  onPhotoSelect,
  containerHeight,
  containerWidth,
}: VirtualPhotoGridProps) {
  const gridRef = useRef<Grid>(null);

  // Calculate grid dimensions
  const ITEM_WIDTH = 280; // Width of each photo card including padding
  const ITEM_HEIGHT = 400; // Height of each photo card including padding
  const GAP = 24; // Gap between items

  const columnsPerRow = Math.max(
    1,
    Math.floor((containerWidth + GAP) / (ITEM_WIDTH + GAP)),
  );
  const rowCount = Math.ceil(photos.length / columnsPerRow);

  // Memoize grid data to prevent unnecessary re-renders
  const gridData = useMemo(
    () => ({
      photos,
      columnsPerRow,
      onPhotoClick,
      onProcessPhoto,
      isProcessing,
      selectedPhotos,
      onPhotoSelect,
    }),
    [
      photos,
      columnsPerRow,
      onPhotoClick,
      onProcessPhoto,
      isProcessing,
      selectedPhotos,
      onPhotoSelect,
    ],
  );

  // Reset scroll position when photos change
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollToItem({ rowIndex: 0, columnIndex: 0 });
    }
  }, [photos.length]);

  return (
    <Grid
      ref={gridRef}
      height={containerHeight}
      width={containerWidth}
      columnCount={columnsPerRow}
      columnWidth={ITEM_WIDTH}
      rowCount={rowCount}
      rowHeight={ITEM_HEIGHT}
      itemData={gridData}
      overscanRowCount={2} // Render 2 extra rows above/below for smoother scrolling
      overscanColumnCount={1}
    >
      {PhotoCell}
    </Grid>
  );
}
