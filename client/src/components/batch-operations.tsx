import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Tag, 
  Star, 
  Download, 
  FolderPlus,
  Bot,
  Move,
  Copy,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import type { Photo } from "@shared/types";

interface BatchOperationsProps {
  photos: Photo[];
  selectedPhotos: string[];
  onSelectionChange: (photoIds: string[]) => void;
  onClose: () => void;
}

export default function BatchOperations({
  photos,
  selectedPhotos,
  onSelectionChange,
  onClose
}: BatchOperationsProps) {
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [operationDetails, setOperationDetails] = useState<any>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const selectedPhotosData = photos.filter(photo => selectedPhotos.includes(photo.id));

  // Batch operations mutation
  const batchOperationMutation = useMutation({
    mutationFn: async ({ operation, photoIds, params }: { 
      operation: string; 
      photoIds: string[]; 
      params?: any 
    }) => {
      const response = await apiRequest('POST', '/api/photos/batch', {
        operation,
        photoIds,
        params
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      setCurrentOperation(null);
      setProgress(0);
      onSelectionChange([]);
      
      toast({
        title: "Operation Complete",
        description: `Successfully processed ${selectedPhotos.length} photos.`,
      });
    },
    onError: (error) => {
      setCurrentOperation(null);
      setProgress(0);
      
      toast({
        title: "Operation Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const selectAll = () => {
    onSelectionChange(photos.map(photo => photo.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const togglePhoto = (photoId: string) => {
    if (selectedPhotos.includes(photoId)) {
      onSelectionChange(selectedPhotos.filter(id => id !== photoId));
    } else {
      onSelectionChange([...selectedPhotos, photoId]);
    }
  };

  const startOperation = (operation: string, params?: any) => {
    if (selectedPhotos.length === 0) {
      toast({
        title: "No Photos Selected",
        description: "Please select photos to perform batch operations.",
        variant: "destructive"
      });
      return;
    }

    setCurrentOperation(operation);
    setProgress(0);
    
    // Simulate progress for user feedback
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    batchOperationMutation.mutate({ 
      operation, 
      photoIds: selectedPhotos, 
      params 
    });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedPhotos.length} photos? This action cannot be undone.`)) {
      startOperation('delete');
    }
  };

  const handleAddTags = () => {
    const tags = operationDetails.tags?.split(',').map((tag: string) => tag.trim()).filter(Boolean);
    if (!tags || tags.length === 0) {
      toast({
        title: "No Tags Entered",
        description: "Please enter tags to add.",
        variant: "destructive"
      });
      return;
    }
    startOperation('addTags', { tags });
  };

  const handlePromoteToTier = (tier: string) => {
    if (tier && selectedPhotosData.some(photo => photo.tier !== 'bronze' && tier === 'silver')) {
      toast({
        title: "Invalid Operation",
        description: "Can only promote Bronze photos to Silver tier.",
        variant: "destructive"
      });
      return;
    }
    startOperation('promote', { tier });
  };

  const handleProcessWithAI = () => {
    const bronzePhotos = selectedPhotosData.filter(photo => photo.tier === 'bronze');
    if (bronzePhotos.length === 0) {
      toast({
        title: "No Bronze Photos",
        description: "AI processing is only available for Bronze tier photos.",
        variant: "destructive"
      });
      return;
    }
    startOperation('processAI', { photoIds: bronzePhotos.map(p => p.id) });
  };

  const handleAddToCollection = () => {
    const collectionId = operationDetails.collectionId;
    if (!collectionId) {
      toast({
        title: "No Collection Selected",
        description: "Please select a collection.",
        variant: "destructive"
      });
      return;
    }
    startOperation('addToCollection', { collectionId });
  };

  const handleExport = () => {
    const format = operationDetails.exportFormat || 'zip';
    const quality = operationDetails.quality || 'original';
    startOperation('export', { format, quality });
  };

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={selectedPhotos.length === photos.length ? deselectAll : selectAll}
            >
              {selectedPhotos.length === photos.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedPhotos.length === photos.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-sm text-gray-500">
              {selectedPhotos.length} of {photos.length} selected
            </span>
          </div>
          
          {selectedPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPhotosData.slice(0, 5).map(photo => (
                <div key={photo.id} className="relative">
                  <img 
                    src={`/api/files/${photo.filePath}`}
                    alt={photo.mediaAsset.originalFilename}
                    className="w-8 h-8 rounded object-cover"
                  />
                </div>
              ))}
              {selectedPhotos.length > 5 && (
                <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-xs">
                  +{selectedPhotos.length - 5}
                </div>
              )}
            </div>
          )}
        </div>
        
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Operation Progress */}
      {currentOperation && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Processing {currentOperation}...</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Batch Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Delete */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            <span className="font-medium">Delete Photos</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Permanently delete selected photos
          </p>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleDelete}
            disabled={selectedPhotos.length === 0 || batchOperationMutation.isPending}
          >
            Delete {selectedPhotos.length} Photos
          </Button>
        </div>

        {/* Add Tags */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Tag className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Add Tags</span>
          </div>
          <Input
            placeholder="Enter tags (comma separated)"
            value={operationDetails.tags || ''}
            onChange={(e) => setOperationDetails({ ...operationDetails, tags: e.target.value })}
            className="mb-3"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddTags}
            disabled={selectedPhotos.length === 0 || batchOperationMutation.isPending}
          >
            Add Tags
          </Button>
        </div>

        {/* AI Processing */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Bot className="h-4 w-4 text-purple-500" />
            <span className="font-medium">AI Processing</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Process Bronze photos with AI analysis
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleProcessWithAI}
            disabled={selectedPhotos.length === 0 || batchOperationMutation.isPending}
          >
            Process with AI
          </Button>
        </div>

        {/* Promote Tier */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="font-medium">Promote Tier</span>
          </div>
          <Select 
            value={operationDetails.promoteTier || ''} 
            onValueChange={(value) => setOperationDetails({ ...operationDetails, promoteTier: value })}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="silver">Promote to Silver</SelectItem>
              <SelectItem value="gold">Promote to Gold</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePromoteToTier(operationDetails.promoteTier)}
            disabled={selectedPhotos.length === 0 || batchOperationMutation.isPending}
          >
            Promote Photos
          </Button>
        </div>

        {/* Add to Collection */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <FolderPlus className="h-4 w-4 text-green-500" />
            <span className="font-medium">Add to Collection</span>
          </div>
          <Select 
            value={operationDetails.collectionId || ''} 
            onValueChange={(value) => setOperationDetails({ ...operationDetails, collectionId: value })}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="collection1">Family Photos</SelectItem>
              <SelectItem value="collection2">Vacation 2024</SelectItem>
              <SelectItem value="collection3">Best Shots</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddToCollection}
            disabled={selectedPhotos.length === 0 || batchOperationMutation.isPending}
          >
            Add to Collection
          </Button>
        </div>

        {/* Export */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Download className="h-4 w-4 text-indigo-500" />
            <span className="font-medium">Export Photos</span>
          </div>
          <div className="space-y-2 mb-3">
            <Select 
              value={operationDetails.exportFormat || 'zip'} 
              onValueChange={(value) => setOperationDetails({ ...operationDetails, exportFormat: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Export format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">ZIP Archive</SelectItem>
                <SelectItem value="tar">TAR Archive</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={operationDetails.quality || 'original'} 
              onValueChange={(value) => setOperationDetails({ ...operationDetails, quality: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original Quality</SelectItem>
                <SelectItem value="high">High Quality</SelectItem>
                <SelectItem value="medium">Medium Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={selectedPhotos.length === 0 || batchOperationMutation.isPending}
          >
            Export {selectedPhotos.length} Photos
          </Button>
        </div>
      </div>

      {/* Photo Selection Grid */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Select Photos</h4>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
          {photos.map(photo => (
            <div 
              key={photo.id}
              className={`relative cursor-pointer rounded border-2 transition-all ${
                selectedPhotos.includes(photo.id) 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : 'border-transparent hover:border-gray-300'
              }`}
              onClick={() => togglePhoto(photo.id)}
            >
              <img 
                src={`/api/files/${photo.filePath}`}
                alt={photo.mediaAsset.originalFilename}
                className="w-full aspect-square object-cover rounded"
              />
              {selectedPhotos.includes(photo.id) && (
                <div className="absolute top-1 right-1">
                  <CheckSquare className="h-4 w-4 text-blue-500 bg-white rounded" />
                </div>
              )}
              <Badge 
                variant={photo.tier === 'gold' ? 'default' : 'secondary'}
                className="absolute bottom-1 left-1 text-xs"
              >
                {photo.tier}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}