import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { 
  Eye, 
  Edit, 
  Crown, 
  CheckCircle, 
  XCircle,
  Star,
  Copy,
  Calendar,
  Camera,
  MapPin,
  Tag,
  Zap,
  Users,
  Image,
  MoreHorizontal,
  Shuffle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Photo {
  id: string;
  mediaAssetId: string;
  tier: string;
  filePath: string;
  metadata: any;
  isReviewed: boolean;
  createdAt: string;
  mediaAsset: {
    originalFilename: string;
  };
}

interface SimilarGroup {
  photos: Photo[];
  similarityScore: number;
  suggested: Photo;
}

export default function SilverReviewPage() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'similarity'>('grid');
  const [filterReviewed, setFilterReviewed] = useState<'all' | 'reviewed' | 'unreviewed'>('unreviewed');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState<any>({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: silverPhotos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos", { tier: "silver" }],
  });

  const { data: similarGroups = [], isLoading: similarityLoading } = useQuery<SimilarGroup[]>({
    queryKey: ["/api/photos/similarity", { tier: "silver" }],
    enabled: viewMode === 'similarity',
  });

  const updatePhotoMutation = useMutation({
    mutationFn: async ({ photoId, updates }: { photoId: string; updates: any }) => {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update photo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setIsEditModalOpen(false);
      toast({ title: "Photo updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update photo", variant: "destructive" });
    },
  });

  const promoteToGoldMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await fetch(`/api/photos/${photoId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error('Failed to promote photo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ 
        title: "Promoted to Gold", 
        description: "Photo has been promoted to Gold tier with finalized metadata." 
      });
    },
    onError: () => {
      toast({ title: "Failed to promote photo", variant: "destructive" });
    },
  });

  const batchPromoteMutation = useMutation({
    mutationFn: async (photoIds: string[]) => {
      const response = await fetch(`/api/photos/batch-promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds }),
      });
      if (!response.ok) throw new Error('Failed to batch promote photos');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ 
        title: "Batch Promotion Complete", 
        description: `${data.promoted} photos promoted to Gold tier.` 
      });
    },
  });

  const filteredPhotos = silverPhotos.filter(photo => {
    if (filterReviewed === 'reviewed') return photo.isReviewed;
    if (filterReviewed === 'unreviewed') return !photo.isReviewed;
    return true;
  });

  const handleEditMetadata = (photo: Photo) => {
    setSelectedPhoto(photo);
    setEditingMetadata(photo.metadata || {});
    setIsEditModalOpen(true);
  };

  const handleSaveMetadata = () => {
    if (!selectedPhoto) return;
    
    updatePhotoMutation.mutate({
      photoId: selectedPhoto.id,
      updates: { 
        metadata: editingMetadata,
        isReviewed: true 
      }
    });
  };

  const handlePromotePhoto = (photoId: string) => {
    promoteToGoldMutation.mutate(photoId);
  };

  const handlePromoteBest = (group: SimilarGroup) => {
    promoteToGoldMutation.mutate(group.suggested.id);
  };

  const updateTagsInMetadata = (tags: string[]) => {
    setEditingMetadata((prev: any) => ({
      ...prev,
      ai: {
        ...prev.ai,
        aiTags: tags
      }
    }));
  };

  const updateDescriptionInMetadata = (field: string, value: string) => {
    setEditingMetadata((prev: any) => ({
      ...prev,
      ai: {
        ...prev.ai,
        [field]: value
      }
    }));
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Silver Review</h2>
            <p className="text-sm text-gray-500">Review AI-processed photos and promote the best to Gold tier</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Image className="w-4 h-4 mr-2" />
                Grid View
              </Button>
              <Button
                variant={viewMode === 'similarity' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('similarity')}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Similarity
              </Button>
            </div>
            <Select value={filterReviewed} onValueChange={(value: any) => setFilterReviewed(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Photos</SelectItem>
                <SelectItem value="unreviewed">Unreviewed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={() => batchPromoteMutation.mutate(filteredPhotos.filter(p => p.isReviewed).map(p => p.id))}
              disabled={!filteredPhotos.some(p => p.isReviewed) || batchPromoteMutation.isPending}
            >
              <Crown className="w-4 h-4 mr-2" />
              Promote Reviewed
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPhotos.map((photo) => (
              <Card key={photo.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant={photo.isReviewed ? "default" : "secondary"}>
                        {photo.isReviewed ? "Reviewed" : "Pending"}
                      </Badge>
                      {photo.metadata?.ai?.aiConfidenceScores?.tags && (
                        <Badge variant="outline">
                          {Math.round(photo.metadata.ai.aiConfidenceScores.tags * 100)}% AI
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={`/api/files/${photo.filePath}`}
                        alt={photo.mediaAsset.originalFilename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm truncate">{photo.mediaAsset.originalFilename}</h3>
                      {photo.metadata?.ai?.shortDescription && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{photo.metadata.ai.shortDescription}</p>
                      )}
                    </div>

                    {photo.metadata?.ai?.aiTags && (
                      <div className="flex flex-wrap gap-1">
                        {photo.metadata.ai.aiTags.slice(0, 3).map((tag: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                        {photo.metadata.ai.aiTags.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{photo.metadata.ai.aiTags.length - 3}</Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditMetadata(photo)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => handlePromotePhoto(photo.id)}
                        disabled={promoteToGoldMutation.isPending}
                      >
                        <Crown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Similarity View */}
        {viewMode === 'similarity' && (
          <div className="space-y-8">
            {similarGroups.map((group, groupIndex) => (
              <Card key={groupIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Similar Photos ({group.photos.length} photos, {Math.round(group.similarityScore * 100)}% similar)
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Suggested: {group.suggested.mediaAsset.originalFilename}</Badge>
                      <Button size="sm" onClick={() => handlePromoteBest(group)}>
                        <Crown className="w-4 h-4 mr-2" />
                        Promote Best
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.photos.map((photo) => (
                      <div 
                        key={photo.id}
                        className={`relative border-2 rounded-lg p-2 ${
                          photo.id === group.suggested.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                        }`}
                      >
                        {photo.id === group.suggested.id && (
                          <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1">
                            <Star className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <img
                          src={`/api/files/${photo.filePath}`}
                          alt={photo.mediaAsset.originalFilename}
                          className="w-full aspect-video object-cover rounded"
                        />
                        <p className="text-xs mt-2 truncate">{photo.mediaAsset.originalFilename}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant={photo.isReviewed ? "default" : "secondary"} className="text-xs">
                            {photo.isReviewed ? "Reviewed" : "Pending"}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => handleEditMetadata(photo)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredPhotos.length === 0 && !photosLoading && (
          <div className="text-center py-12">
            <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No photos to review</h3>
            <p className="text-gray-600">
              {filterReviewed === 'unreviewed' 
                ? 'All Silver tier photos have been reviewed.' 
                : 'No Silver tier photos found.'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Metadata Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review & Edit Metadata</DialogTitle>
          </DialogHeader>
          
          {selectedPhoto && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Preview */}
              <div className="space-y-4">
                <img
                  src={`/api/files/${selectedPhoto.filePath}`}
                  alt={selectedPhoto.mediaAsset.originalFilename}
                  className="w-full rounded-lg"
                />
                <div className="text-sm text-gray-600">
                  <p><strong>Filename:</strong> {selectedPhoto.mediaAsset.originalFilename}</p>
                  <p><strong>Created:</strong> {new Date(selectedPhoto.createdAt).toLocaleDateString()}</p>
                  {editingMetadata.ai?.aiConfidenceScores && (
                    <p><strong>AI Confidence:</strong> {Math.round(editingMetadata.ai.aiConfidenceScores.tags * 100)}%</p>
                  )}
                </div>
              </div>

              {/* Metadata Editing */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="shortDescription">Short Description</Label>
                  <Input
                    id="shortDescription"
                    value={editingMetadata.ai?.shortDescription || ''}
                    onChange={(e) => updateDescriptionInMetadata('shortDescription', e.target.value)}
                    placeholder="Brief description of the image"
                  />
                </div>

                <div>
                  <Label htmlFor="longDescription">Detailed Description</Label>
                  <Textarea
                    id="longDescription"
                    value={editingMetadata.ai?.longDescription || ''}
                    onChange={(e) => updateDescriptionInMetadata('longDescription', e.target.value)}
                    placeholder="Detailed description for searchability"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={editingMetadata.ai?.aiTags?.join(', ') || ''}
                    onChange={(e) => updateTagsInMetadata(e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    placeholder="tag1, tag2, tag3"
                  />
                  {editingMetadata.ai?.aiTags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {editingMetadata.ai.aiTags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="placeName">Location</Label>
                  <Input
                    id="placeName"
                    value={editingMetadata.ai?.placeName || ''}
                    onChange={(e) => updateDescriptionInMetadata('placeName', e.target.value)}
                    placeholder="Location where photo was taken"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveMetadata}
                    disabled={updatePhotoMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save & Mark Reviewed
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}