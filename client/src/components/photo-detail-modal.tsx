import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const canProcess = photo.tier === 'bronze' && onProcessPhoto;
  const canPromoteToGold = photo.tier === 'silver' && photo.isReviewed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] p-0">
        <div className="flex h-full">
          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center p-8 bg-black">
            <img 
              src={`/api/files/${photo.filePath}`}
              alt={photo.mediaAsset.originalFilename}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Metadata Panel */}
          <div className="w-96 bg-white overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
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
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">AI Generated Tags</h4>
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
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-sm text-gray-600">
                    {photo.metadata.ai.longDescription}
                  </p>
                </div>
              )}

              {/* EXIF Data */}
              {photo.metadata?.exif && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Camera Settings</h4>
                  <div className="space-y-2">
                    {photo.metadata.exif.camera && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Camera</span>
                        <span className="text-sm text-gray-900">{photo.metadata.exif.camera}</span>
                      </div>
                    )}
                    {photo.metadata.exif.lens && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Lens</span>
                        <span className="text-sm text-gray-900">{photo.metadata.exif.lens}</span>
                      </div>
                    )}
                    {photo.metadata.exif.aperture && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Aperture</span>
                        <span className="text-sm text-gray-900">{photo.metadata.exif.aperture}</span>
                      </div>
                    )}
                    {photo.metadata.exif.shutter && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Shutter</span>
                        <span className="text-sm text-gray-900">{photo.metadata.exif.shutter}</span>
                      </div>
                    )}
                    {photo.metadata.exif.iso && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">ISO</span>
                        <span className="text-sm text-gray-900">{photo.metadata.exif.iso}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location */}
              {photo.metadata?.ai?.placeName && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </h4>
                  <p className="text-sm text-gray-600">{photo.metadata.ai.placeName}</p>
                </div>
              )}

              {/* Detected Objects */}
              {photo.metadata?.ai?.detectedObjects && photo.metadata.ai.detectedObjects.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Detected Objects</h4>
                  <div className="space-y-2">
                    {photo.metadata.ai.detectedObjects.map((obj: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm text-gray-700">{obj.name}</span>
                        <span className="text-sm text-gray-500">
                          {Math.round(obj.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-6" />

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

                <Button variant="outline" className="w-full">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Metadata
                </Button>

                {canPromoteToGold && (
                  <Button variant="outline" className="w-full">
                    <Star className="w-4 h-4 mr-2" />
                    Promote to Gold
                  </Button>
                )}

                <Button variant="outline" className="w-full">
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
