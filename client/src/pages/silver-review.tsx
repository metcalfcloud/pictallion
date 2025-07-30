import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ChevronLeft, ChevronRight, Star, Tag, MapPin, Calendar, Camera, Eye, ThumbsUp, ThumbsDown, Upload, Search, Filter, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RatingSystem, QuickRating } from "@/components/rating-system";
import { AdvancedSearch } from "@/components/advanced-search";
import type { SearchFilters } from "@/components/advanced-search";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

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
  perceptualHash?: string;
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
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ tier: 'silver' });
  const [showOnlyUnreviewed, setShowOnlyUnreviewed] = useState(true);

  // Fetch global tag library
  const { data: tagLibrary = [] } = useQuery({
    queryKey: ['/api/tags/library'],
    queryFn: async () => {
      const response = await fetch('/api/tags/library');
      if (!response.ok) throw new Error('Failed to fetch tag library');
      return response.json();
    }
  });

  // Fetch photos with advanced search
  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ['/api/photos/search', searchFilters, showOnlyUnreviewed],
    queryFn: async () => {
      const filters = {
        ...searchFilters,
        tier: 'silver' as const,
        isReviewed: showOnlyUnreviewed ? false : undefined
      };

      const response = await fetch('/api/photos/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, limit: 100 })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      return response.json();
    }
  });

  const photos = (searchResults?.photos as Photo[]) || [];
  const selectedPhoto = photos[selectedPhotoIndex];

  // Navigation handlers
  const goToPrevious = () => {
    setSelectedPhotoIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
  };

  const goToNext = () => {
    setSelectedPhotoIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
        case 'd':
          e.preventDefault();
          goToNext();
          break;
        case 'r':
          e.preventDefault();
          markAsReviewed();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          e.preventDefault();
          updateRating(parseInt(e.key));
          break;
        case 'p':
          e.preventDefault();
          promoteToGold();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedPhoto]);

  // Update rating mutation
  const updateRatingMutation = useMutation({
    mutationFn: async ({ photoId, rating }: { photoId: string; rating: number }) => {
      return await apiRequest('PATCH', `/api/photos/${photoId}/rating`, { rating });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos/search'] });
      toast({ title: "Rating updated successfully" });
    }
  });

  // Update metadata mutation
  const updateMetadataMutation = useMutation({
    mutationFn: async ({ photoId, metadata }: { photoId: string; metadata: any }) => {
      return await apiRequest('PATCH', `/api/photos/${photoId}/metadata`, metadata);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos/search'] });
      toast({ title: "Metadata updated successfully" });
    }
  });

  // Mark as reviewed mutation
  const markReviewedMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return await apiRequest('PATCH', `/api/photos/${photoId}/metadata`, { isReviewed: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos/search'] });
      if (showOnlyUnreviewed && selectedPhotoIndex >= photos.length - 1) {
        setSelectedPhotoIndex(0);
      }
      toast({ title: "Photo marked as reviewed" });
    }
  });

  // Promote to gold mutation
  const promoteToGoldMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return await apiRequest('POST', `/api/photos/${photoId}/embed-metadata`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos/search'] });
      toast({ title: "Photo promoted to Gold tier with embedded metadata!" });
      goToNext();
    }
  });

  // Helper functions
  const updateRating = (rating: number) => {
    if (!selectedPhoto) return;
    updateRatingMutation.mutate({ photoId: selectedPhoto.id, rating });
  };

  const updateMetadata = (metadata: any) => {
    if (!selectedPhoto) return;
    updateMetadataMutation.mutate({ photoId: selectedPhoto.id, metadata });
  };

  const markAsReviewed = () => {
    if (!selectedPhoto) return;
    markReviewedMutation.mutate(selectedPhoto.id);
  };

  const promoteToGold = () => {
    if (!selectedPhoto) return;
    promoteToGoldMutation.mutate(selectedPhoto.id);
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const batchPromote = async () => {
    if (selectedPhotos.size === 0) return;

    try {
      for (const photoId of Array.from(selectedPhotos)) {
        await promoteToGoldMutation.mutateAsync(photoId);
      }
      setSelectedPhotos(new Set());
      toast({ title: `${selectedPhotos.size} photos promoted to Gold tier!` });
    } catch (error) {
      toast({ title: "Error promoting photos", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Sparkles className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Loading Silver tier photos...</p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Silver Tier Review</h1>
          <Button onClick={() => setLocation("/upload")} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Photos
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Silver Photos Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {showOnlyUnreviewed 
                ? "All Silver tier photos have been reviewed. Great job!" 
                : "No Silver tier photos available for review."
              }
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowOnlyUnreviewed(!showOnlyUnreviewed)}>
                {showOnlyUnreviewed ? "Show All Photos" : "Show Only Unreviewed"}
              </Button>
              <Button asChild>
                <Link href="/upload">Upload New Photos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aiData = selectedPhoto?.metadata?.ai || {};
  const exifData = selectedPhoto?.metadata?.exif || {};

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Silver Tier Review</h1>
          <p className="text-muted-foreground">
            Reviewing {selectedPhotoIndex + 1} of {photos.length} photos
            {showOnlyUnreviewed && " (unreviewed only)"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="unreviewed"
              checked={showOnlyUnreviewed}
              onCheckedChange={(checked) => setShowOnlyUnreviewed(!!checked)}
            />
            <Label htmlFor="unreviewed">Unreviewed only</Label>
          </div>

          <Dialog open={isAdvancedSearchOpen} onOpenChange={setIsAdvancedSearchOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Advanced Search
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Advanced Photo Search</DialogTitle>
              </DialogHeader>
              <AdvancedSearch
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
                onSearch={() => {
                  refetch();
                  setIsAdvancedSearchOpen(false);
                  setSelectedPhotoIndex(0);
                }}
              />
            </DialogContent>
          </Dialog>

          {selectedPhotos.size > 0 && (
            <Button onClick={batchPromote} className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              Promote {selectedPhotos.size} to Gold
            </Button>
          )}

          <Button onClick={() => setLocation("/upload")} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload More
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photo viewer */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="relative bg-black">
                <img
                  src={`/api/files/${selectedPhoto?.filePath}`}
                  alt={selectedPhoto?.mediaAsset?.originalFilename || 'Photo'}
                  className="w-full h-[500px] object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-image.svg';
                  }}
                />

                {/* Selection checkbox */}
                <div className="absolute top-4 left-4">
                  <Checkbox
                    checked={selectedPhotos.has(selectedPhoto?.id || '')}
                    onCheckedChange={() => selectedPhoto && togglePhotoSelection(selectedPhoto.id)}
                    className="bg-card border-white"
                  />
                </div>

                {/* Navigation arrows */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>

                {/* Rating overlay */}
                <div className="absolute top-4 right-4 bg-black/50 p-2 rounded">
                  <QuickRating
                    rating={selectedPhoto?.rating || 0}
                    onRatingChange={updateRating}
                  />
                </div>

                {/* Review status */}
                <div className="absolute bottom-4 left-4">
                  <Badge variant={selectedPhoto?.isReviewed ? "default" : "secondary"}>
                    {selectedPhoto?.isReviewed ? "Reviewed" : "Unreviewed"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-2 justify-center">
            <Button
              onClick={markAsReviewed}
              variant="outline"
              className="flex items-center gap-2"
              disabled={selectedPhoto?.isReviewed}
            >
              <Eye className="h-4 w-4" />
              Mark Reviewed (R)
            </Button>

            <Button
              onClick={promoteToGold}
              className="flex items-center gap-2"
              disabled={!selectedPhoto?.isReviewed || (selectedPhoto?.rating || 0) < 3}
            >
              <ThumbsUp className="h-4 w-4" />
              Promote to Gold (P)
            </Button>
          </div>

          {/* Keyboard shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <span>← / A: Previous photo</span>
                <span>→ / D: Next photo</span>
                <span>1-5: Rate photo</span>
                <span>R: Mark reviewed</span>
                <span>P: Promote to Gold</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metadata panel */}
        <div className="space-y-4">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photo Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Filename</Label>
                <p className="text-sm font-mono break-all">{selectedPhoto?.mediaAsset?.originalFilename || 'Unknown'}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Size</Label>
                <p className="text-sm">{Math.round((selectedPhoto?.fileSize || 0) / 1024 / 1024 * 100) / 100} MB</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <p className="text-sm">{selectedPhoto?.mimeType}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Upload Date</Label>
                <p className="text-sm">{new Date(selectedPhoto?.createdAt || '').toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatingSystem
                rating={selectedPhoto?.rating || 0}
                onRatingChange={updateRating}
                size="lg"
              />
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {aiData.shortDescription && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{aiData.shortDescription}</p>
                </div>

                {aiData.aiTags && aiData.aiTags.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">AI Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiData.aiTags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {aiData.detectedObjects && aiData.detectedObjects.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Detected Objects</Label>
                    <div className="space-y-1 mt-1">
                      {aiData.detectedObjects.map((obj: any, index: number) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span>{obj.name}</span>
                          <span className="text-muted-foreground">{Math.round(obj.confidence * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiData.aiConfidenceScores && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Confidence</Label>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>Tags:</span>
                        <span>{Math.round((aiData.aiConfidenceScores.tags || 0) * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Description:</span>
                        <span>{Math.round((aiData.aiConfidenceScores.description || 0) * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Objects:</span>
                        <span>{Math.round((aiData.aiConfidenceScores.objects || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Manual metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Manual Tags & Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="keywords" className="text-xs">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={(selectedPhoto?.keywords || []).join(', ')}
                  onChange={(e) => {
                    const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                    updateMetadata({ keywords });
                  }}
                  placeholder="Add keywords..."
                  className="mt-1"
                />
                {tagLibrary.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Popular tags from Gold tier:</Label>
                    <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                      {tagLibrary.slice(0, 20).map((tagInfo: any) => (
                        <Badge
                          key={tagInfo.tag}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-blue-100"
                          onClick={() => {
                            const currentKeywords = selectedPhoto?.keywords || [];
                            if (!currentKeywords.includes(tagInfo.tag)) {
                              const newKeywords = [...currentKeywords, tagInfo.tag];
                              updateMetadata({ keywords: newKeywords });
                            }
                          }}
                        >
                          {tagInfo.tag} ({tagInfo.usage_count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="location" className="text-xs">Location</Label>
                <Input
                  id="location"
                  value={selectedPhoto?.location || ''}
                  onChange={(e) => updateMetadata({ location: e.target.value })}
                  placeholder="Location..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="eventType" className="text-xs">Event Type</Label>
                <Select
                  value={selectedPhoto?.eventType || 'none'}
                  onValueChange={(value) => updateMetadata({ eventType: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="concert">Concert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="eventName" className="text-xs">Event Name</Label>
                <Input
                  id="eventName"
                  value={selectedPhoto?.eventName || ''}
                  onChange={(e) => updateMetadata({ eventName: e.target.value })}
                  placeholder="Event name..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* EXIF data */}
          {exifData && Object.keys(exifData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Camera Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {exifData.camera && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Camera:</span>
                    <span>{exifData.camera}</span>
                  </div>
                )}
                {exifData.lens && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lens:</span>
                    <span>{exifData.lens}</span>
                  </div>
                )}
                {exifData.focalLength && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Focal Length:</span>
                    <span>{exifData.focalLength}mm</span>
                  </div>
                )}
                {exifData.aperture && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aperture:</span>
                    <span>f/{exifData.aperture}</span>
                  </div>
                )}
                {exifData.shutterSpeed && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shutter:</span>
                    <span>{exifData.shutterSpeed}s</span>
                  </div>
                )}
                {exifData.iso && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ISO:</span>
                    <span>{exifData.iso}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Photo thumbnails */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Photo Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {photos.slice(Math.max(0, selectedPhotoIndex - 6), selectedPhotoIndex + 6).map((photo, index) => {
                  const actualIndex = Math.max(0, selectedPhotoIndex - 6) + index;
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
                      {selectedPhotos.has(photo.id) && (
                        <div className="absolute top-1 left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}