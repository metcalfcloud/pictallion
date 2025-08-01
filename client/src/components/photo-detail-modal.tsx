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
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Photo } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaceDetectionBadge, getFaceDetectionStatus } from "@/components/ui/processing-state-badge";

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
  const [selectedTab, setSelectedTab] = useState("details");
  const [imageError, setImageError] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [hoveredFace, setHoveredFace] = useState<string | null>(null);
  const [assignFace, setAssignFace] = useState<any>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Format date safely with validation
  const formatDateSafely = (dateString: string | undefined): string | null => {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
        return date.toLocaleDateString();
      }
      return null;
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
    }
  };

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

    // Query detected faces for this photo
    const { data: detectedFaces = [] } = useQuery({
      queryKey: ['/api/faces/photo', photo.id],
      queryFn: async () => {
          const response = await apiRequest('GET', `/api/faces/photo/${photo.id}`);
          return await response.json();
      },
  });

  // Query people for face assignment
  const { data: people = [] } = useQuery({
    queryKey: ['/api/people'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/people');
      return await response.json();
    },
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
  }, [photo.id]); // Only depend on photo.id to prevent infinite loops

  // Update image dimensions when photo changes
  useEffect(() => {
    if (imageRef.current) {
      setImageWidth(imageRef.current.offsetWidth);
      setImageHeight(imageRef.current.offsetHeight);
    }
  }, [photo.id]);

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
      queryClient.invalidateQueries({ queryKey: ['/api/faces/photo', photo.id] });
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

  // Face assignment mutation
  const assignFaceMutation = useMutation({
    mutationFn: async ({ faceId, personId }: { faceId: string; personId: string }) => {
      const response = await apiRequest('POST', '/api/faces/assign', {
        faceIds: [faceId],
        personId
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faces/photo', photo.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
      toast({ title: "Face assigned successfully!" });
      setAssignFace(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to assign face", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Create person mutation
  const createPersonMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/people', { name });
      return await response.json();
    },
    onSuccess: (newPerson) => {
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
      if (assignFace) {
        assignFaceMutation.mutate({ faceId: assignFace.id, personId: newPerson.id });
      }
      setNewPersonName('');
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create person", 
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

  // Face Overlay Component - moved inside the main component to fix scope issues
  const FaceOverlay = ({ 
    face, 
    imageElement, 
    originalImageWidth, 
    originalImageHeight 
  }: {
    face: any;
    imageElement: HTMLImageElement;
    originalImageWidth: number;
    originalImageHeight: number;
  }) => {
    if (!face.boundingBox || !Array.isArray(face.boundingBox)) return null;

    const [x, y, width, height] = face.boundingBox;

    // Get the displayed image dimensions
    const displayedWidth = imageElement.offsetWidth;
    const displayedHeight = imageElement.offsetHeight;

    // Safety check: ensure we have valid dimensions to prevent division by zero
    if (!originalImageWidth || !originalImageHeight || !displayedWidth || !displayedHeight) return null;

    // Calculate scaling factors
    const scaleX = displayedWidth / originalImageWidth;
    const scaleY = displayedHeight / originalImageHeight;

    // Scale the face coordinates
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    // Get image offset within its container
    const imageRect = imageElement.getBoundingClientRect();
    const containerRect = imageElement.parentElement?.getBoundingClientRect();

    if (!containerRect) return null;

    const offsetX = imageRect.left - containerRect.left;
    const offsetY = imageRect.top - containerRect.top;

    return (
      <div
        className="absolute border-2 border-cyan-400 bg-cyan-400/10 pointer-events-none animate-pulse"
        style={{
          left: offsetX + scaledX,
          top: offsetY + scaledY,
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        <div className="absolute -top-6 left-0 bg-cyan-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {face.person?.name || 'Unknown'} ({face.confidence}%)
        </div>
      </div>
    );
  };

    const facesData = detectedFaces || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] p-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <DialogHeader className="sr-only">
          <DialogTitle>Photo Details</DialogTitle>
          <DialogDescription>View and edit photo metadata, EXIF data, and AI-generated information</DialogDescription>
        </DialogHeader>

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

        <div className="flex h-full max-h-[90vh] overflow-hidden">
          {/* Left Panel - Image */}
          <div className="w-1/2 bg-white dark:bg-gray-900 p-6 flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Badge className={cn("text-sm px-3 py-1", getTierBadgeClass(photo.tier))}>
                  <span className="capitalize">{photo.tier}</span>
                </Badge>
                {photo.tier === 'silver' && !photo.isReviewed && (
                  <Badge variant="outline" className="text-sm text-amber-600 border-amber-600 bg-amber-50 dark:bg-amber-900/20">
                    <Eye className="w-4 h-4 mr-1" />
                    Needs Review
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Main Image */}
            <div className="flex-shrink-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden relative max-h-[45vh]">
              <img 
                ref={imageRef}
                src={`/api/files/${photo.filePath}`}
                alt={photo.mediaAsset?.originalFilename || 'Photo'}
                className="max-w-full max-h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
                onClick={() => setIsImageFullscreen(true)}
                onLoad={(e) => {
                  setImageWidth(e.currentTarget.offsetWidth);
                  setImageHeight(e.currentTarget.offsetHeight);
                }}
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.svg';
                  setImageError(true);
                }}
              />

              {/* Face Overlays */}
        {facesData && facesData.length > 0 && (
          <>
            {facesData.map((face: any) => {
              const [x, y, width, height] = face.boundingBox || [0, 0, 0, 0];
              
              // Try to get original image dimensions from various EXIF fields, fallback to reasonable defaults
              let originalImageWidth = photo.metadata?.exif?.imageWidth || 
                                     photo.metadata?.exif?.ImageWidth || 
                                     photo.metadata?.exif?.ExifImageWidth;
              let originalImageHeight = photo.metadata?.exif?.imageHeight || 
                                      photo.metadata?.exif?.ImageHeight || 
                                      photo.metadata?.exif?.ExifImageHeight;

              // If no EXIF dimensions, estimate based on face coordinates
              if (!originalImageWidth || !originalImageHeight || originalImageWidth === 1 || originalImageHeight === 1) {
                // Estimate original dimensions based on face coordinates
                // If face coordinates are much larger than displayed image, assume original is larger
                if (x > imageWidth || y > imageHeight || x > 1000 || y > 1000) {
                  // Face coordinates suggest high resolution original
                  originalImageWidth = 3072; // Common camera width
                  originalImageHeight = 4080; // Common camera height
                } else {
                  // Face coordinates fit within displayed image
                  originalImageWidth = imageWidth;
                  originalImageHeight = imageHeight;
                }
              }

              const scaleX = imageWidth / originalImageWidth;
              const scaleY = imageHeight / originalImageHeight;
              const isHovered = hoveredFace === face.id;

              // Skip rendering if we don't have valid dimensions
              if (!imageWidth || !imageHeight || !originalImageWidth || !originalImageHeight) {
                return null;
              }

              // Debug logging for face overlay positioning
              if (isHovered) {
                console.log('Face overlay debug:', {
                  faceId: face.id,
                  boundingBox: [x, y, width, height],
                  imageSize: { width: imageWidth, height: imageHeight },
                  originalSize: { width: originalImageWidth, height: originalImageHeight },
                  scale: { x: scaleX, y: scaleY },
                  position: {
                    left: Math.round(x * scaleX),
                    top: Math.round(y * scaleY),
                    width: Math.round(width * scaleX),
                    height: Math.round(height * scaleY)
                  }
                });
              }

              return (
                <div
                  key={face.id}
                  className={`absolute border-4 transition-all duration-200 ${
                    isHovered 
                      ? 'border-cyan-400 bg-cyan-400/30 shadow-lg animate-pulse' 
                      : face.personId 
                        ? 'border-green-400 bg-green-400/10' 
                        : 'border-yellow-400 bg-yellow-400/10'
                  }`}
                  style={{
                    left: `${Math.round(x * scaleX)}px`,
                    top: `${Math.round(y * scaleY)}px`,
                    width: `${Math.round(width * scaleX)}px`,
                    height: `${Math.round(height * scaleY)}px`,
                    zIndex: isHovered ? 10 : 5,
                    minWidth: '20px',
                    minHeight: '20px',
                  }}
                  title={face.personId ? `${face.person?.name || 'Unknown'} (${Math.round(face.confidence)}%)` : `Unassigned face (${Math.round(face.confidence)}%)`}
                >
                  {(face.personId || isHovered) && (
                    <div className={`absolute -top-6 left-0 text-white text-xs px-2 py-1 rounded whitespace-nowrap ${
                      isHovered ? 'bg-cyan-400' : 'bg-green-600'
                    }`}>
                      {face.person?.name || 'Unknown'}
                      {face.ageInPhoto && ` (${face.ageInPhoto})`}
                      {isHovered && !face.personId && ' - Unassigned'}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
            </div>

            {/* Image Info */}
            <div className="mt-4 space-y-2 flex-shrink-0">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
                {photo.mediaAsset?.originalFilename}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {photo.fileSize && (
                  <span>{Math.round(photo.fileSize / 1024)} KB</span>
                )}
                {photo.metadata?.exif?.imageWidth && photo.metadata?.exif?.imageHeight && (
                  <span>{photo.metadata.exif.imageWidth} × {photo.metadata.exif.imageHeight}</span>
                )}
                {(() => {
                  const formattedDate = formatDateSafely(photo.metadata?.exif?.dateTimeOriginal) ||
                                       formatDateSafely(photo.metadata?.exif?.createDate) ||
                                       formatDateSafely(photo.metadata?.exif?.dateTime);
                  return formattedDate ? <span>{formattedDate}</span> : null;
                })()}
              </div>
            </div>

            {/* Action Buttons */}
            {!isEditing && (
              <div className="mt-4 space-y-3 flex-shrink-0">
                <div className="flex gap-2">
                  {photo.tier !== 'bronze' && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setIsEditing(!isEditing)}
                      size="sm"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Metadata
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

                <div className="flex gap-2">
                  {canPromoteToSilver && (
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => onProcessPhoto!(photo.id)}
                      disabled={isProcessing}
                      size="sm"
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      {isProcessing ? 'Promoting...' : 'Promote to Silver'}
                    </Button>
                  )}
                  {canPromoteToGold && (
                    <Button 
                      onClick={() => promoteToGoldMutation.mutate()}
                      disabled={promoteToGoldMutation.isPending}
                      size="sm"
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      {promoteToGoldMutation.isPending ? 'Promoting...' : 'Promote to Gold'}
                    </Button>
                  )}
                </div>

                {isSilverTier && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => archivePhotoMutation.mutate()}
                      disabled={archivePhotoMutation.isPending}
                      size="sm"
                      className="flex-1"
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      {archivePhotoMutation.isPending ? 'Archiving...' : 'Archive'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => aiReprocessMutation.mutate()}
                      disabled={aiReprocessMutation.isPending}
                      size="sm"
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {aiReprocessMutation.isPending ? 'Reprocessing...' : 'AI Reprocess'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Metadata */}
          <div className="w-1/2 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Description */}
              {photo.metadata?.ai?.longDescription && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                    <Bot className="w-5 h-5 mr-2" />
                    Description
                  </h3>
                  {isEditing ? (
                    <Textarea
                      value={editedMetadata.aiDescription || photo.metadata.ai.longDescription}
                      onChange={(e) => setEditedMetadata(prev => ({ ...prev, aiDescription: e.target.value }))}
                      placeholder="Edit AI description..."
                      className="text-sm min-h-[80px] bg-white dark:bg-gray-800"
                    />
                  ) : (
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                      {editedMetadata.aiDescription || photo.metadata.ai.longDescription}
                    </p>
                  )}
                </div>
              )}

              {/* AI Tags */}
              {photo.metadata?.ai?.aiTags && (
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                    <Tag className="w-5 h-5 mr-2" />
                    AI Generated Tags
                  </h3>
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
                          className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs px-3 py-1"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Camera Information */}
              {(photo.metadata?.exif?.camera || photo.metadata?.exif?.lens || photo.metadata?.exif?.aperture || photo.metadata?.exif?.shutter || photo.metadata?.exif?.iso) && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                    <Camera className="w-5 h-5 mr-2" />
                    Camera Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {photo.metadata?.exif?.camera && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 block">Camera</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{photo.metadata.exif.camera}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.lens && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 block">Lens</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{photo.metadata.exif.lens}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.aperture && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 block">Aperture</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{photo.metadata.exif.aperture}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.shutter && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 block">Shutter</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{photo.metadata.exif.shutter}</span>
                      </div>
                    )}
                    {photo.metadata?.exif?.iso && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 block">ISO</span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{photo.metadata.exif.iso}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location Information */}
              {(photo.metadata?.ai?.placeName || photo.metadata?.exif?.gps) && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="text-base font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Location
                  </h3>
                  {photo.metadata?.ai?.placeName && (
                    <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                      {photo.metadata.ai.placeName}
                    </p>
                  )}
                  {photo.metadata?.exif?.gps && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 dark:text-green-400 block">Latitude</span>
                        <span className="text-green-800 dark:text-green-200 font-mono">{photo.metadata.exif.gps.latitude}</span>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 block">Longitude</span>
                        <span className="text-green-800 dark:text-green-200 font-mono">{photo.metadata.exif.gps.longitude}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Detected Objects */}
              {photo.metadata?.ai?.detectedObjects && photo.metadata.ai.detectedObjects.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 className="text-base font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Detected Objects
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {photo.metadata.ai.detectedObjects.map((obj: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-purple-900/50 rounded border">
                        <span className="text-sm text-purple-800 dark:text-purple-200 font-medium">{obj.name}</span>
                        <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300">
                          {Math.round(obj.confidence * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected People */}
              {photo.metadata?.ai?.detectedPeople && photo.metadata.ai.detectedPeople.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h3 className="text-base font-semibold text-orange-800 dark:text-orange-200 mb-3 flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Detected People
                  </h3>
                  <div className="space-y-3">
                    {photo.metadata.ai.detectedPeople.map((person: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-orange-900/50 rounded-lg border shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-orange-600 dark:text-orange-300" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                              {person.name || 'Unknown Person'}
                            </div>
                            {person.age && (
                              <div className="text-xs text-orange-600 dark:text-orange-400">
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

              {/* Face Detection Status and Detected Faces */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg border border-cyan-200 dark:border-cyan-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-cyan-800 dark:text-cyan-200 flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Face Detection
                  </h3>
                  <FaceDetectionBadge 
                    status={getFaceDetectionStatus(photo).status}
                    faceCount={getFaceDetectionStatus(photo).faceCount}
                    size="md"
                  />
                </div>
                {detectedFaces && detectedFaces.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {detectedFaces.map((face: any) => (
                      <div 
                        key={face.id} 
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-all duration-200 ${
                          hoveredFace === face.id 
                            ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 shadow-md' 
                            : 'hover:border-cyan-300 hover:bg-cyan-25 dark:hover:bg-cyan-900/20'
                        }`}
                        onMouseEnter={() => setHoveredFace(face.id)}
                        onMouseLeave={() => setHoveredFace(null)}
                      >
                        {face.faceCropUrl && (
                          <img 
                            src={`/api/files/${face.faceCropUrl}`}
                            alt="Face crop"
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {face.personId ? face.person?.name || 'Unknown Person' : 'Unassigned'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(face.confidence)}% confidence
                            {face.ageInPhoto && ` • Age ${face.ageInPhoto}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              {/* Editing Panel */}
              {isEditing && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h3 className="text-base font-semibold text-yellow-800 dark:text-yellow-200 mb-4 flex items-center">
                    <Edit className="w-5 h-5 mr-2" />
                    Edit Metadata
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="keywords" className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Keywords</Label>
                      <TagEditor
                        tags={editedMetadata.keywords}
                        onChange={(keywords) => setEditedMetadata(prev => ({ ...prev, keywords }))}
                        placeholder="Add keywords..."
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="location" className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Location</Label>
                      <Input
                        id="location"
                        value={editedMetadata.location}
                        onChange={(e) => setEditedMetadata(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Location..."
                        className="mt-2 bg-white dark:bg-yellow-900/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="eventType" className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Event Type</Label>
                        <Select
                          value={editedMetadata.eventType || 'none'}
                          onValueChange={(value) => setEditedMetadata(prev => ({ ...prev, eventType: value === 'none' ? '' : value }))}
                        >
                          <SelectTrigger className="mt-2 bg-white dark:bg-yellow-900/50">
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
                        <Label htmlFor="eventName" className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Event Name</Label>
                        <Input
                          id="eventName"
                          value={editedMetadata.eventName}
                          onChange={(e) => setEditedMetadata(prev => ({ ...prev, eventName: e.target.value }))}
                          placeholder="Event name..."
                          className="mt-2 bg-white dark:bg-yellow-900/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 mt-4 border-t border-yellow-200 dark:border-yellow-700">
                    <Button 
                      onClick={handleSaveMetadata}
                      disabled={updateMetadataMutation.isPending}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateMetadataMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={resetMetadata}
                      size="sm"
                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-300"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      size="sm"
                      className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100 dark:text-yellow-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* User Keywords */}
              {!isEditing && photo.keywords && photo.keywords.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h3 className="text-base font-semibold text-indigo-800 dark:text-indigo-200 mb-3 flex items-center">
                    <Tag className="w-5 h-5 mr-2" />
                    Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {photo.keywords.map((keyword: string, index: number) => (
                      <Badge key={index} className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 text-xs px-3 py-1">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Events Section */}
              {!isEditing && ((photo.eventType || photo.eventName) || detectedEvents.length > 0) && (
                <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
                  <h3 className="text-base font-semibold text-pink-800 dark:text-pink-200 mb-3 flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Events
                  </h3>

                  {/* Manual/Saved Event */}
                  {(photo.eventType || photo.eventName) && (
                    <div className="mb-3 p-3 bg-white dark:bg-pink-900/50 rounded-lg border shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          {photo.eventType && (
                            <Badge variant="outline" className="text-xs mb-2 border-pink-300 text-pink-700 dark:border-pink-600 dark:text-pink-300">
                              {photo.eventType.charAt(0).toUpperCase() + photo.eventType.slice(1)}
                            </Badge>
                          )}
                          {photo.eventName && (
                            <div className="text-sm font-medium text-pink-800 dark:text-pink-200">
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
                      <div className="text-xs text-pink-600 dark:text-pink-400 font-medium">Auto-detected events:</div>
                      {detectedEvents.map((event: any, index: number) => (
                        <div key={index} className="p-3 bg-white dark:bg-pink-900/50 rounded-lg border-l-4 border-pink-500 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="outline" className="text-xs mb-2 border-pink-300 text-pink-700 dark:border-pink-600 dark:text-pink-300">
                                {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
                              </Badge>
                              <div className="text-sm font-medium text-pink-800 dark:text-pink-200">
                                {event.eventName}
                              </div>
                              {event.age !== undefined && (
                                <div className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                                  Age: {event.age} years old
                                </div>
                              )}
                            </div>
                            <Badge 
                              variant={event.confidence >= 95 ? "default" : event.confidence >= 80 ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {event.confidence}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


            </div>
          </div>
        </div>
      </DialogContent>

      {/* Face Assignment Dialog */}
      {assignFace && (
        <Dialog open={!!assignFace} onOpenChange={() => setAssignFace(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Face to Person</DialogTitle>
              <DialogDescription>
                Choose an existing person or create a new one for this face.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Face Preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {assignFace.faceCropUrl ? (
                  <img 
                    src={`/api/files/${assignFace.faceCropUrl}`} 
                    alt="Face to assign"
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="font-medium">Unknown Face</div>
                  <div className="text-sm text-gray-500">{assignFace.confidence}% confidence</div>
                </div>
              </div>

              {/* Existing People */}
              {people.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Assign to existing person</Label>
                  <Select onValueChange={(personId) => assignFaceMutation.mutate({ faceId: assignFace.id, personId })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a person..." />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((person: any) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name} ({person.photoCount || 0} {(person.photoCount || 0) === 1 ? 'photo' : 'photos'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Create New Person */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Create new person</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter person's name..."
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPersonName.trim()) {
                        createPersonMutation.mutate(newPersonName.trim());
                      }
                    }}
                  />
                  <Button 
                    onClick={() => createPersonMutation.mutate(newPersonName.trim())}
                    disabled={!newPersonName.trim() || createPersonMutation.isPending}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}