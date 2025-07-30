import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  ArrowUp,
  X,
  Users,
  Tag,
  MapPin,
  Calendar,
  Eye,
  EyeOff
} from "lucide-react";

interface Photo {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  filePath: string;
  mimeType: string;
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

export default function SilverReview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showOnlyUnreviewed, setShowOnlyUnreviewed] = useState(true);
  const [quickTags, setQuickTags] = useState<string>('');
  const [quickLocation, setQuickLocation] = useState<string>('');

  // Fetch silver photos
  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos", { tier: 'silver' }],
  });

  // Filter photos based on review status
  const filteredPhotos = showOnlyUnreviewed 
    ? photos.filter(p => !p.isReviewed)
    : photos;

  const selectedPhoto = filteredPhotos[selectedPhotoIndex];

  // Navigation
  const goToPrevious = () => {
    setSelectedPhotoIndex(prev => prev > 0 ? prev - 1 : filteredPhotos.length - 1);
  };

  const goToNext = () => {
    setSelectedPhotoIndex(prev => prev < filteredPhotos.length - 1 ? prev + 1 : 0);
  };

  // Mark as reviewed
  const markReviewedMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await apiRequest('PATCH', `/api/photos/${photoId}/metadata`, {
        isReviewed: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({
        title: "Photo Reviewed",
        description: "Photo marked as reviewed.",
      });
      // Auto-advance to next unreviewed photo
      if (showOnlyUnreviewed && selectedPhotoIndex < filteredPhotos.length - 1) {
        setSelectedPhotoIndex(prev => prev);
      } else if (showOnlyUnreviewed && selectedPhotoIndex === filteredPhotos.length - 1) {
        setSelectedPhotoIndex(0);
      }
    },
  });

  // Promote to Gold
  const promoteToGoldMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await apiRequest('POST', `/api/photos/${photoId}/promote`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      toast({
        title: "Promoted to Gold",
        description: "Photo has been promoted to Gold tier.",
      });
      // Auto-advance to next photo
      if (selectedPhotoIndex < filteredPhotos.length - 1) {
        setSelectedPhotoIndex(prev => prev);
      } else {
        setSelectedPhotoIndex(0);
      }
    },
  });

  // Quick update metadata
  const updateMetadataMutation = useMutation({
    mutationFn: async ({ photoId, updates }: { photoId: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/photos/${photoId}/metadata`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
    },
  });

  const handleQuickUpdate = () => {
    if (!selectedPhoto) return;
    
    const updates: any = {};
    if (quickTags.trim()) {
      updates.keywords = quickTags.split(',').map(t => t.trim()).filter(t => t);
    }
    if (quickLocation.trim()) {
      updates.location = quickLocation.trim();
    }
    
    updateMetadataMutation.mutate({ photoId: selectedPhoto.id, updates });
    setQuickTags('');
    setQuickLocation('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading photos...</div>
      </div>
    );
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <div className="text-2xl font-semibold">No Photos to Review</div>
        <div className="text-muted-foreground">
          {showOnlyUnreviewed 
            ? "All silver photos have been reviewed. Great work!"
            : "No silver photos found."
          }
        </div>
        <Button onClick={() => setShowOnlyUnreviewed(!showOnlyUnreviewed)}>
          {showOnlyUnreviewed ? "Show All Silver Photos" : "Show Only Unreviewed"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-semibold">Silver Review</h1>
            <Badge variant="outline">
              {selectedPhotoIndex + 1} of {filteredPhotos.length}
            </Badge>
            <Badge variant={showOnlyUnreviewed ? "default" : "secondary"}>
              {showOnlyUnreviewed ? "Unreviewed Only" : "All Silver Photos"}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyUnreviewed(!showOnlyUnreviewed)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showOnlyUnreviewed ? "Show All" : "Unreviewed Only"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/gallery')}
            >
              <X className="h-4 w-4 mr-2" />
              Exit Review
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Image */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {selectedPhoto && (
            <>
              <img
                src={`/api/files/${selectedPhoto.filePath}`}
                alt={selectedPhoto.mediaAsset?.originalFilename || 'Photo'}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.svg';
                }}
              />
              
              {/* Navigation arrows */}
              <Button
                variant="outline"
                size="sm"
                className="absolute left-4 top-1/2 transform -translate-y-1/2"
                onClick={goToPrevious}
                disabled={filteredPhotos.length <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                onClick={goToNext}
                disabled={filteredPhotos.length <= 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Review Panel */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
          {selectedPhoto && (
            <div className="space-y-6">
              {/* Photo Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Photo Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Filename:</span>
                    <div className="text-muted-foreground">
                      {selectedPhoto.mediaAsset?.originalFilename}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge variant={selectedPhoto.isReviewed ? "default" : "secondary"}>
                      {selectedPhoto.isReviewed ? "Reviewed" : "Needs Review"}
                    </Badge>
                  </div>
                  
                  {selectedPhoto.metadata?.ai?.shortDescription && (
                    <div>
                      <span className="font-medium">AI Description:</span>
                      <div className="text-muted-foreground">
                        {selectedPhoto.metadata.ai.shortDescription}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => promoteToGoldMutation.mutate(selectedPhoto.id)}
                    disabled={promoteToGoldMutation.isPending}
                    className="w-full"
                    size="sm"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Promote to Gold
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => markReviewedMutation.mutate(selectedPhoto.id)}
                    disabled={markReviewedMutation.isPending || selectedPhoto.isReviewed}
                    className="w-full"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Mark as Reviewed
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Edit */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quick Edit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="tags" className="text-xs">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={quickTags}
                      onChange={(e) => setQuickTags(e.target.value)}
                      placeholder="birthday, family, celebration"
                      className="mt-1"
                      size="sm"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="location" className="text-xs">Location</Label>
                    <Input
                      id="location"
                      value={quickLocation}
                      onChange={(e) => setQuickLocation(e.target.value)}
                      placeholder="New York, NY"
                      className="mt-1"
                      size="sm"
                    />
                  </div>
                  
                  <Button
                    onClick={handleQuickUpdate}
                    disabled={updateMetadataMutation.isPending || (!quickTags.trim() && !quickLocation.trim())}
                    className="w-full"
                    size="sm"
                    variant="outline"
                  >
                    <Tag className="h-4 w-4 mr-2" />
                    Update Metadata
                  </Button>
                </CardContent>
              </Card>

              {/* Current Metadata */}
              {(selectedPhoto.keywords?.length || selectedPhoto.location || selectedPhoto.eventName) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Current Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedPhoto.keywords?.length && (
                      <div>
                        <span className="font-medium flex items-center">
                          <Tag className="h-3 w-3 mr-1" />
                          Tags:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPhoto.keywords.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedPhoto.location && (
                      <div>
                        <span className="font-medium flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          Location:
                        </span>
                        <div className="text-muted-foreground">{selectedPhoto.location}</div>
                      </div>
                    )}
                    
                    {selectedPhoto.eventName && (
                      <div>
                        <span className="font-medium flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Event:
                        </span>
                        <div className="text-muted-foreground">{selectedPhoto.eventName}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Navigation Thumbnails */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Navigate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {filteredPhotos.slice(Math.max(0, selectedPhotoIndex - 3), selectedPhotoIndex + 3).map((photo, index) => {
                      const actualIndex = Math.max(0, selectedPhotoIndex - 3) + index;
                      return (
                        <div
                          key={photo.id}
                          className={`relative cursor-pointer border-2 rounded ${
                            actualIndex === selectedPhotoIndex ? 'border-blue-500' : 'border-transparent'
                          }`}
                          onClick={() => setSelectedPhotoIndex(actualIndex)}
                        >
                          <img
                            src={`/api/files/${photo.filePath}`}
                            alt={photo.mediaAsset?.originalFilename || 'Photo'}
                            className="w-full h-16 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder-image.svg';
                            }}
                          />
                          {!photo.isReviewed && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}