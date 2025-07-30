import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  Tag,
  Maximize2,
  Minimize2,
  Archive,
  RefreshCw,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Photo } from "@shared/types";

// Tag Editor Component
interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

function TagEditor({ tags, onChange, placeholder, className }: TagEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{tag: string, usage_count: number}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Query for tag suggestions from global library
  const { data: globalTags = [] } = useQuery({
    queryKey: ['/api/tags/library'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tags/library');
      return await response.json();
    },
  });

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = globalTags
        .filter((tagInfo: any) => 
          tagInfo.tag.toLowerCase().includes(inputValue.toLowerCase()) && 
          !tags.includes(tagInfo.tag)
        )
        .slice(0, 10); // Limit to 10 suggestions
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, globalTags, tags]);

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      onChange([...tags, tag.trim()]);
      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[40px]">
        {tags.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-red-500 hover:text-white rounded-full w-4 h-4 flex items-center justify-center ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
          {suggestions.map((tagInfo, index) => (
            <button
              key={index}
              type="button"
              onClick={() => addTag(tagInfo.tag)}
              className="w-full px-3 py-2 text-left hover:bg-accent text-sm flex items-center justify-between"
            >
              <span>{tagInfo.tag}</span>
              <Badge variant="outline" className="text-xs">
                {tagInfo.usage_count}
              </Badge>
            </button>
          ))}
          {/* Option to create new tag */}
          {inputValue.trim() && !suggestions.some(s => s.tag.toLowerCase() === inputValue.toLowerCase()) && (
            <button
              type="button"
              onClick={() => addTag(inputValue)}
              className="w-full px-3 py-2 text-left hover:bg-accent text-sm border-t flex items-center gap-2"
            >
              <span className="text-muted-foreground">Create:</span>
              <Badge variant="outline" className="text-xs">
                {inputValue}
              </Badge>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState({
    keywords: [] as string[],
    location: '',
    eventType: '',
    eventName: '',
    rating: 0,
    aiTags: [] as string[],
    aiDescription: ''
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Extract photo date for event detection
  const extractPhotoDate = (photo: Photo): string | null => {
    try {
      // First try EXIF datetime fields with validation
      if (photo.metadata?.exif) {
        const exif = photo.metadata.exif;

        // Try DateTimeOriginal first (most accurate)
        if (exif.dateTimeOriginal) {
          const date = new Date(exif.dateTimeOriginal);
          if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
            return date.toISOString().split('T')[0];
          }
        }

        // Try CreateDate
        if (exif.createDate) {
          const date = new Date(exif.createDate);
          if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
            return date.toISOString().split('T')[0];
          }
        }

        // Try DateTime
        if (exif.dateTime) {
          const date = new Date(exif.dateTime);
          if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
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
        if (!isNaN(extractedDate.getTime()) && extractedDate.getFullYear() > 1900) {
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
      rating: photo.rating || 0,
      aiTags: photo.metadata?.ai?.aiTags || [],
      aiDescription: photo.metadata?.ai?.longDescription || ''
    });
  }, [photo]);

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-orange-500 text-white';
      case 'silver':
        return 'bg-gray-500 text-white';
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

  // Archive photo mutation
  const archivePhotoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/photos/${photo.id}/archive`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to archive photo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
      toast({ title: "Photo archived successfully!" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to archive photo", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // AI Reprocess mutation
  const aiReprocessMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/photos/${photo.id}/reprocess`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to reprocess photo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
      toast({ title: "Photo reprocessed successfully!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to reprocess photo", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const canPromoteToSilver = photo.tier === 'bronze' && onProcessPhoto;
  const canPromoteToGold = photo.tier === 'silver';
  const isSilverTier = photo.tier === 'silver';

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
      rating: photo.rating || 0,
      aiTags: photo.metadata?.ai?.aiTags || [],
      aiDescription: photo.metadata?.ai?.longDescription || ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] w-[90vw] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Photo Details</DialogTitle>
          <DialogDescription>View and edit photo metadata, EXIF data, and AI-generated information</DialogDescription>
        </DialogHeader>
        <div className="flex h-full">
          {/* Fullscreen Image Overlay */}
          {isImageFullscreen && (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setIsImageFullscreen(false)}>
              <img 
                src={`/api/files/${photo.filePath}`}
                alt={photo.mediaAsset?.originalFilename || 'Photo'}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.svg';
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsImageFullscreen(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Metadata Panel with Pinned Polaroid Photo */}
          <div className="flex-1 bg-card dark:bg-gray-900 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              {/* Top Section: Photo on left, Description & Tags on right */}
              <div className="flex gap-4 mb-4">
                {/* Pinned Polaroid Photo - Far Left */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div 
                      className="bg-white p-2 pb-4 shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-200 cursor-pointer relative"
                      onClick={() => setIsImageFullscreen(true)}
                    >
                      <img 
                        src={`/api/files/${photo.filePath}`}
                        alt={photo.mediaAsset?.originalFilename || 'Photo'}
                        className="w-32 h-32 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-image.svg';
                        }}
                      />
                      {/* Push Pin */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full shadow-sm border border-red-600"></div>
                    </div>
                  </div>
                </div>

                {/* Description & Tags - Fill right space */}
                <div className="flex-1 space-y-3">
                  {/* AI Description */}
                  {photo.metadata?.ai?.longDescription && (
                    <div>
                      <h4 className="text-sm font-semibold text-card-foreground mb-2">Description</h4>
                      {isEditing ? (
                        <Textarea
                          value={editedMetadata.aiDescription || photo.metadata.ai.longDescription}
                          onChange={(e) => setEditedMetadata(prev => ({ ...prev, aiDescription: e.target.value }))}
                          placeholder="Edit AI description..."
                          className="text-sm min-h-[60px]"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {editedMetadata.aiDescription || photo.metadata.ai.longDescription}
                        </p>
                      )}
                    </div>
                  )}

                  {/* AI Tags */}
                  {photo.metadata?.ai?.aiTags && (
                    <div>
                      <h4 className="text-sm font-semibold text-card-foreground mb-2">AI Generated Tags</h4>
                      {isEditing ? (
                        <TagEditor
                          tags={editedMetadata.aiTags || photo.metadata.ai.aiTags}
                          onChange={(tags) => setEditedMetadata(prev => ({ ...prev, aiTags: tags }))}
                          placeholder="Add AI tags..."
                          className="text-sm"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(editedMetadata.aiTags || photo.metadata.ai.aiTags).map((tag: string, index: number) => (
                            <Badge 
                              key={index} 
                              className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Two Column Metadata Layout */}
              <div className="grid grid-cols-2 gap-4 text-sm">

                {/* Left Column */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-card-foreground">File Information</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Filename</span>
                      <span className="text-card-foreground font-mono truncate ml-2">{photo.mediaAsset?.originalFilename}</span>
                    </div>
                    {photo.fileSize && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Size</span>
                        <span className="text-card-foreground">{Math.round(photo.fileSize / 1024)} KB</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.imageWidth && photo.metadata?.exif?.imageHeight && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Dimensions</span>
                        <span className="text-card-foreground">{photo.metadata.exif.imageWidth} x {photo.metadata.exif.imageHeight}</span>
                      </div>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-card-foreground pt-2">Camera Settings</h4>
                  <div className="space-y-1">
                    {photo.metadata?.exif?.camera && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Camera</span>
                        <span className="text-card-foreground truncate ml-2">{photo.metadata.exif.camera}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.lens && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Lens</span>
                        <span className="text-card-foreground truncate ml-2">{photo.metadata.exif.lens}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.aperture && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Aperture</span>
                        <span className="text-card-foreground">{photo.metadata.exif.aperture}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.shutter && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Shutter</span>
                        <span className="text-card-foreground">{photo.metadata.exif.shutter}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.iso && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">ISO</span>
                        <span className="text-card-foreground">{photo.metadata.exif.iso}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-card-foreground">Date Information</h4>
                  <div className="space-y-1">
                    {photo.createdAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Processed</span>
                        <span className="text-card-foreground">{new Date(photo.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.dateTimeOriginal && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Date Taken</span>
                        <span className="text-card-foreground">{new Date(photo.metadata.exif.dateTimeOriginal).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-card-foreground pt-2">Status</h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-xs", getTierBadgeClass(photo.tier))}>
                        <span className="capitalize">{photo.tier}</span>
                      </Badge>
                      {photo.tier === 'silver' && !photo.isReviewed && (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                          <Eye className="w-3 h-3 mr-1" />
                          Needs Review
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* GPS Information */}
                  {photo.metadata?.exif?.gps && (
                    <>
                      <h4 className="text-sm font-semibold text-card-foreground pt-2">Location</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Latitude</span>
                          <span className="text-card-foreground font-mono">{photo.metadata.exif.gps.latitude}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Longitude</span>
                          <span className="text-card-foreground font-mono">{photo.metadata.exif.gps.longitude}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>

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

              {/* Detected People */}
              {photo.metadata?.ai?.detectedPeople && photo.metadata.ai.detectedPeople.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">
                    <Users className="w-4 h-4 inline mr-1" />
                    Detected People
                  </h4>
                  <div className="space-y-2">
                    {photo.metadata.ai.detectedPeople.map((person: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-card-foreground">
                              {person.name || 'Unknown Person'}
                            </div>
                            {person.age && (
                              <div className="text-xs text-muted-foreground">
                                Age: {person.age}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant={person.confidence >= 95 ? "default" : person.confidence >= 80 ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {Math.round(person.confidence)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-6" />

              {/* Editable Metadata */}
              {isEditing ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Edit Metadata</h4>

                  {/* Compact Form Content */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    <div>
                      <Label htmlFor="keywords" className="text-xs">Keywords</Label>
                      <TagEditor
                        tags={editedMetadata.keywords}
                        onChange={(keywords) => setEditedMetadata(prev => ({ ...prev, keywords }))}
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
                  </div>

                  {/* Always Visible Action Buttons */}
                  <div className="flex gap-2 pt-3 mt-3 border-t">
                    <Button 
                      onClick={handleSaveMetadata}
                      disabled={updateMetadataMutation.isPending}
                      className="flex-1"
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {updateMetadataMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={resetMetadata}
                      size="sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      size="sm"
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
                      <div className="flex flex-wrap gap-2">
                        {photo.keywords.map((keyword: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs flex items-center gap-1">
                            <Tag className="w-3 h-3" />
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
                                      Age: {event.age}                                      years old
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
                </>
              )}

              {/* Actions - Only show when not editing */}
              {!isEditing && (
                <div className="space-y-2 border-t pt-3 mt-4">
                  {/* First row - Primary actions */}
                  <div className="flex gap-2">
                    {/* Only show edit button for silver and gold tiers */}
                    {photo.tier !== 'bronze' && (
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => setIsEditing(!isEditing)}
                        size="sm"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {canPromoteToSilver && (
                      <Button 
                        className="flex-1"
                        onClick={() => onProcessPhoto!(photo.id)}
                        disabled={isProcessing}
                        size="sm"
                      >
                        <Bot className="w-4 h-4 mr-1" />
                        {isProcessing ? 'Promoting...' : 'Promote to Silver'}
                      </Button>
                    )}
                    {canPromoteToGold && (
                      <Button 
                        onClick={() => promoteToGoldMutation.mutate()}
                        disabled={promoteToGoldMutation.isPending}
                        size="sm"
                        className="flex-1"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        {promoteToGoldMutation.isPending ? 'Promoting...' : 'Promote to Gold'}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={handleDownload}
                      size="sm"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Second row - Silver tier specific actions */}
                  {isSilverTier && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => archivePhotoMutation.mutate()}
                        disabled={archivePhotoMutation.isPending}
                        size="sm"
                        className="flex-1"
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        {archivePhotoMutation.isPending ? 'Archiving...' : 'Archive'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => aiReprocessMutation.mutate()}
                        disabled={aiReprocessMutation.isPending}
                        size="sm"
                        className="flex-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        {aiReprocessMutation.isPending ? 'Reprocessing...' : 'AI Reprocess'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}