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
  selectedPhotos?: string[];
  onPhotoSelect?: (photoId: string, selected: boolean) => void;
}

export default function PhotoGrid({ 
  photos, 
  viewMode, 
  onPhotoClick, 
  onProcessPhoto,
  isProcessing = false,
  selectedPhotos = [],
  onPhotoSelect
}: PhotoGridProps) {
  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-orange-500 text-white';
      case 'silver':
        return 'bg-slate-500 text-white';
      case 'gold':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
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
                      <h3 className="font-medium text-card-foreground mb-1">
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
                        <p className="text-sm text-muted-foreground mb-2">
                          {photo.metadata.ai.shortDescription}
                        </p>
                      )}

                      {photo.metadata?.ai?.aiTags && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {photo.metadata.ai.aiTags.slice(0, 4).map((tag: string, index: number) => (
                            <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              {tag}
                            </span>
                          ))}
                          {photo.metadata.ai.aiTags.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{photo.metadata.ai.aiTags.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {photo.metadata?.ai?.detectedPeople && photo.metadata.ai.detectedPeople.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {photo.metadata.ai.detectedPeople.slice(0, 3).map((person: any, index: number) => (
                            <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                              {person.name || 'Unknown'}
                            </span>
                          ))}
                          {photo.metadata.ai.detectedPeople.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{photo.metadata.ai.detectedPeople.length - 3} more
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {photos.map((photo) => (
        <div key={photo.id} className="relative group">
          {/* Polaroid Card */}
          <div className="bg-white dark:bg-gray-100 p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rotate-0 hover:rotate-1 cursor-pointer"
               onClick={() => onPhotoClick(photo)}>
            
            {/* Photo Section with Tier-Colored Frame */}
            <div className={cn(
              "relative rounded-sm overflow-hidden aspect-square mb-4 p-1",
              photo.tier === 'bronze' && "bg-orange-500",
              photo.tier === 'silver' && "bg-slate-500", 
              photo.tier === 'gold' && "bg-yellow-500"
            )}>
              <div className="bg-gray-200 rounded-sm overflow-hidden w-full h-full">
                <img 
                  src={`/api/files/${photo.filePath}`}
                  alt={photo.mediaAsset.originalFilename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200" />
              </div>
              
              {/* Tier-colored Push Pin */}
              <div className={cn(
                "absolute -top-2 -right-2 w-4 h-4 rounded-full shadow-lg transform rotate-12",
                photo.tier === 'bronze' && "bg-orange-500",
                photo.tier === 'silver' && "bg-slate-500",
                photo.tier === 'gold' && "bg-yellow-500"
              )}>
                <div className="absolute inset-0.5 bg-white rounded-full">
                  <div className={cn(
                    "absolute inset-1 rounded-full",
                    photo.tier === 'bronze' && "bg-orange-400",
                    photo.tier === 'silver' && "bg-slate-400",
                    photo.tier === 'gold' && "bg-yellow-400"
                  )} />
                </div>
              </div>
              
              {/* Review Badge */}
              {needsReview(photo) && (
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-white/90">
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
            <div className="text-gray-800 dark:text-gray-900">
              {/* Date - Handwritten Style */}
              <div className="text-center mb-3">
                <h3 className="font-medium text-sm tracking-wide">
                  {new Date(photo.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h3>
              </div>
              
              {/* Tier Label with Elegant Design */}
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border-2",
                  photo.tier === 'bronze' && "bg-orange-50 border-orange-200 text-orange-700",
                  photo.tier === 'silver' && "bg-slate-50 border-slate-200 text-slate-700",
                  photo.tier === 'gold' && "bg-yellow-50 border-yellow-200 text-yellow-700"
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    photo.tier === 'bronze' && "bg-orange-400",
                    photo.tier === 'silver' && "bg-slate-400", 
                    photo.tier === 'gold' && "bg-yellow-400"
                  )} />
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
                <div className="flex justify-center">
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
      ))}
    </div>
  );
}