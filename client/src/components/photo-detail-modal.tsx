import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  X, 
  Star, 
  Download, 
  Edit, 
  Bot,
  Camera,
  MapPin,
  Calendar,
  Eye,
  Save,
  RotateCcw,
  Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Photo } from "@shared/types";

interface PhotoDetailModalProps {
  photo: Photo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessPhoto?: (photoId: string) => void;
  isProcessing?: boolean;
}

export default function PhotoDetailModal({ 
  photo, 
  open, 
  onOpenChange, 
  onProcessPhoto,
  isProcessing = false 
}: PhotoDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState({
    keywords: [] as string[],
    location: '',
    eventType: '',
    eventName: '',
    rating: 0
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Extract photo date from EXIF or filename
  const extractPhotoDate = (photo: Photo): string | null => {
    try {
      // First try EXIF datetime fields
      if (photo.metadata?.exif?.dateTime) {
        return new Date(photo.metadata.exif.dateTime).toISOString().split('T')[0];
      }
      if (photo.metadata?.exif?.dateTimeOriginal) {
        return new Date(photo.metadata.exif.dateTimeOriginal).toISOString().split('T')[0];
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
        if (!isNaN(extractedDate.getTime())) {
          return extractedDate.toISOString().split('T')[0];
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting photo date:', error);
      return null;
    }
  };

  const photoDate = extractPhotoDate(photo);

  // Query detected events for this photo
  const { data: detectedEvents = [] } = useQuery({
    queryKey: ['/api/events/detect', photoDate],
    queryFn: async () => {
      if (!photoDate) return [];
      const response = await apiRequest('POST', '/api/events/detect', { photoDate });
      return await response.json();
    },
    enabled: !!photoDate,
  });

  // Initialize edited metadata when photo changes
  useEffect(() => {
    setEditedMetadata({
      keywords: photo.keywords || [],
      location: photo.location || '',
      eventType: photo.eventType || '',
      eventName: photo.eventName || '',
      rating: photo.rating || 0
    });
  }, [photo]);

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-orange-500 text-white';
      case 'silver':
        return 'bg-background0 text-white';
      case 'gold':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Update metadata mutation
  const updateMetadataMutation = useMutation({
    mutationFn: async (metadata: any) => {
      const response = await fetch(`/api/photos/${photo.id}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      if (!response.ok) throw new Error('Failed to update metadata');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
      toast({ title: "Metadata updated successfully!" });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update metadata", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Promote to gold mutation
  const promoteToGoldMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/photos/${photo.id}/embed-metadata`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to promote to gold');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
      toast({ title: "Photo promoted to Gold tier!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to promote photo", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const canProcess = photo.tier === 'bronze' && onProcessPhoto;
  const canPromoteToGold = photo.tier === 'silver' && photo.isReviewed;

  const handleSaveMetadata = () => {
    updateMetadataMutation.mutate(editedMetadata);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/files/${photo.filePath}?download=true`;
    link.download = photo.mediaAsset?.originalFilename || 'photo';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetMetadata = () => {
    setEditedMetadata({
      keywords: photo.keywords || [],
      location: photo.location || '',
      eventType: photo.eventType || '',
      eventName: photo.eventName || '',
      rating: photo.rating || 0
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Photo Details</DialogTitle>
        </DialogHeader>
        <div className="flex h-full">
          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center p-8 bg-black">
            <img 
              src={`/api/files/${photo.filePath}`}
              alt={photo.mediaAsset?.originalFilename || 'Photo'}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-image.svg';
              }}
            />
          </div>

          {/* Metadata Panel */}
          <div className="w-96 bg-card dark:bg-gray-900 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground truncate">
                  {photo.mediaAsset.originalFilename}
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Tier Badge */}
              <div className="mb-6">
                <Badge className={cn("text-sm", getTierBadgeClass(photo.tier))}>
                  <span className="capitalize">{photo.tier} Tier</span>
                </Badge>
                {photo.tier === 'silver' && !photo.isReviewed && (
                  <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-600">
                    <Eye className="w-3 h-3 mr-1" />
                    Needs Review
                  </Badge>
                )}
              </div>

              {/* AI Tags */}
              {photo.metadata?.ai?.aiTags && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">AI Generated Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {photo.metadata.ai.aiTags.map((tag: string, index: number) => (
                      <span 
                        key={index} 
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Description */}
              {photo.metadata?.ai?.longDescription && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {photo.metadata.ai.longDescription}
                  </p>
                </div>
              )}

              {/* EXIF Data */}
              {photo.metadata?.exif && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Camera Settings</h4>
                  <div className="space-y-2">
                    {photo.metadata.exif.camera && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Camera</span>
                        <span className="text-sm text-card-foreground">{photo.metadata.exif.camera}</span>
                      </div>
                    )}
                    {photo.metadata.exif.lens && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Lens</span>
                        <span className="text-sm text-card-foreground">{photo.metadata.exif.lens}</span>
                      </div>
                    )}
                    {photo.metadata.exif.aperture && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Aperture</span>
                        <span className="text-sm text-card-foreground">{photo.metadata.exif.aperture}</span>
                      </div>
                    )}
                    {photo.metadata.exif.shutter && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Shutter</span>
                        <span className="text-sm text-card-foreground">{photo.metadata.exif.shutter}</span>
                      </div>
                    )}
                    {photo.metadata.exif.iso && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">ISO</span>
                        <span className="text-sm text-card-foreground">{photo.metadata.exif.iso}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location */}
              {photo.metadata?.ai?.placeName && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </h4>
                  <p className="text-sm text-muted-foreground">{photo.metadata.ai.placeName}</p>
                </div>
              )}

              {/* Detected Objects */}
              {photo.metadata?.ai?.detectedObjects && photo.metadata.ai.detectedObjects.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Detected Objects</h4>
                  <div className="space-y-2">
                    {photo.metadata.ai.detectedObjects.map((obj: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm text-card-foreground">{obj.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(obj.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-6" />

              {/* Editable Metadata */}
              {isEditing ? (
                <div className="flex flex-col">
                  {/* Scrollable Form Content */}
                  <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-4 mb-4">
                    <h4 className="text-sm font-semibold text-card-foreground">Edit Metadata</h4>

                    <div>
                      <Label htmlFor="keywords" className="text-xs">Keywords (comma-separated)</Label>
                      <Input
                        id="keywords"
                        value={editedMetadata.keywords.join(', ')}
                        onChange={(e) => {
                          const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                          setEditedMetadata(prev => ({ ...prev, keywords }));
                        }}
                        placeholder="Add keywords..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="location" className="text-xs">Location</Label>
                      <Input
                        id="location"
                        value={editedMetadata.location}
                        onChange={(e) => setEditedMetadata(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Location..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="eventType" className="text-xs">Event Type</Label>
                      <Select
                        value={editedMetadata.eventType || 'none'}
                        onValueChange={(value) => setEditedMetadata(prev => ({ ...prev, eventType: value === 'none' ? '' : value }))}
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
                        value={editedMetadata.eventName}
                        onChange={(e) => setEditedMetadata(prev => ({ ...prev, eventName: e.target.value }))}
                        placeholder="Event name..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Rating</Label>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <button
                            key={starValue}
                            type="button"
                            onClick={() => setEditedMetadata(prev => ({ ...prev, rating: starValue }))}
                            className={`p-1 rounded ${editedMetadata.rating >= starValue ? 'text-yellow-400' : 'text-muted-foreground'}`}
                          >
                            <Star className="w-4 h-4 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fixed Action Buttons */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleSaveMetadata}
                        disabled={updateMetadataMutation.isPending}
                        className="flex-1"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateMetadataMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={resetMetadata}
                        className="flex-1"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>

                    <Button 
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* Current metadata display */
                <>
                  {(photo.keywords && photo.keywords.length > 0) && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-card-foreground mb-2">Keywords</h4>
                      <div className="flex flex-wrap gap-1">
                        {photo.keywords.map((keyword: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Tag className="w-3 h-3 mr-1" />
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {photo.location && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-card-foreground mb-2">Location</h4>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{photo.location}</span>
                      </div>
                    </div>
                  )}

                  {/* Events Section */}
                  {((photo.eventType || photo.eventName) || detectedEvents.length > 0) && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-card-foreground mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Events
                      </h4>
                      
                      {/* Manual/Saved Event */}
                      {(photo.eventType || photo.eventName) && (
                        <div className="mb-2 p-2 bg-background rounded border">
                          <div className="flex items-center justify-between">
                            <div>
                              {photo.eventType && (
                                <Badge variant="outline" className="text-xs mb-1">
                                  {photo.eventType.charAt(0).toUpperCase() + photo.eventType.slice(1)}
                                </Badge>
                              )}
                              {photo.eventName && (
                                <div className="text-sm font-medium text-card-foreground">
                                  {photo.eventName}
                                </div>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">Saved</Badge>
                          </div>
                        </div>
                      )}
                      
                      {/* Auto-Detected Events */}
                      {detectedEvents.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Auto-detected events:</div>
                          {detectedEvents.map((event: any, index: number) => (
                            <div key={index} className="p-2 bg-muted/50 rounded border-l-2 border-blue-500">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Badge variant="outline" className="text-xs mb-1">
                                    {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
                                  </Badge>
                                  <div className="text-sm font-medium text-card-foreground">
                                    {event.eventName}
                                  </div>
                                  {event.age !== undefined && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Age: {event.age} years old
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <Badge 
                                    variant={event.confidence >= 95 ? "default" : event.confidence >= 80 ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    {event.confidence}%
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {photo.rating && photo.rating > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-card-foreground mb-2">Rating</h4>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <Star 
                            key={starValue}
                            className={`w-4 h-4 ${(photo.rating ?? 0) >= starValue ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="space-y-3">
                {canProcess && (
                  <Button 
                    className="w-full"
                    onClick={() => onProcessPhoto!(photo.id)}
                    disabled={isProcessing}
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Processing...' : 'Process with AI'}
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
                </Button>

                {canPromoteToGold && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => promoteToGoldMutation.mutate()}
                    disabled={promoteToGoldMutation.isPending}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    {promoteToGoldMutation.isPending ? 'Promoting...' : 'Promote to Gold'}
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}