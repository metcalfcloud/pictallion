import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Bot, Eye, Star, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Photo } from "@shared/types";

interface PhotoGridProps {
  photos: Photo[];
  viewMode: 'grid' | 'list';
  onPhotoClick: (photo: Photo) => void;
  onProcessPhoto?: (photoId: string) => void;
  isProcessing?: boolean;
}

export default function PhotoGrid({ 
  photos, 
  viewMode, 
  onPhotoClick, 
  onProcessPhoto,
  isProcessing = false 
}: PhotoGridProps) {
  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-orange-500 text-white';
      case 'silver':
        return 'bg-gray-500 text-white';
      case 'gold':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-300 text-gray-700';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return null;
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

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {photos.map((photo) => (
          <Card key={photo.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex">
                <div 
                  className="w-32 h-32 cursor-pointer"
                  onClick={() => onPhotoClick(photo)}
                >
                  <img 
                    src={`/api/files/${photo.filePath}`}
                    alt={photo.mediaAsset.originalFilename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {photo.mediaAsset.originalFilename}
                      </h3>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={cn("text-xs", getTierBadgeClass(photo.tier))}>
                          {getTierIcon(photo.tier)}
                          <span className="ml-1 capitalize">{photo.tier}</span>
                        </Badge>
                        
                        {needsReview(photo) && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <Eye className="w-3 h-3 mr-1" />
                            Needs Review
                          </Badge>
                        )}
                      </div>

                      {photo.metadata?.ai?.shortDescription && (
                        <p className="text-sm text-gray-600 mb-2">
                          {photo.metadata.ai.shortDescription}
                        </p>
                      )}

                      {photo.metadata?.ai?.aiTags && (
                        <div className="flex flex-wrap gap-1">
                          {photo.metadata.ai.aiTags.slice(0, 4).map((tag: string, index: number) => (
                            <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              {tag}
                            </span>
                          ))}
                          {photo.metadata.ai.aiTags.length > 4 && (
                            <span className="text-xs text-gray-500">
                              +{photo.metadata.ai.aiTags.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {canProcess(photo) && (
                        <Button
                          size="sm"
                          onClick={() => onProcessPhoto!(photo.id)}
                          disabled={isProcessing}
                        >
                          <Bot className="w-4 h-4 mr-1" />
                          {isProcessing ? 'Processing...' : 'Process with AI'}
                        </Button>
                      )}
                      
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="relative group">
          <div 
            className="cursor-pointer"
            onClick={() => onPhotoClick(photo)}
          >
            <img 
              src={`/api/files/${photo.filePath}`}
              alt={photo.mediaAsset.originalFilename}
              className="w-full h-32 object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg" />
          </div>

          {/* Tier Badge */}
          <div className="absolute top-2 left-2">
            <Badge className={cn("text-xs", getTierBadgeClass(photo.tier))}>
              {getTierIcon(photo.tier)}
              <span className="ml-1 capitalize">{photo.tier}</span>
            </Badge>
          </div>

          {/* Review Badge */}
          {needsReview(photo) && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-white">
                <Eye className="w-3 h-3" />
              </Badge>
            </div>
          )}

          {/* Actions */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex space-x-1">
              {canProcess(photo) && (
                <Button
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProcessPhoto!(photo.id);
                  }}
                  disabled={isProcessing}
                >
                  <Bot className="w-3 h-3" />
                </Button>
              )}
              
              <Button
                variant="secondary"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Heart className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
