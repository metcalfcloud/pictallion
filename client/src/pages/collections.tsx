import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  FolderPlus, 
  Star, 
  Calendar, 
  Image, 
  Edit, 
  Trash2, 
  Eye,
  Share,
  Download
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PhotoGrid from "@/components/photo-grid";
import type { Photo } from "@shared/types";

interface Collection {
  id: string;
  name: string;
  description?: string;
  photoCount: number;
  coverPhoto?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Collections() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    isPublic: false
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch collections
  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });

  // Fetch photos in selected collection
  const { data: collectionPhotos, isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["/api/collections", selectedCollection?.id, "photos"],
    enabled: !!selectedCollection,
  });

  // Create collection mutation
  const createCollectionMutation = useMutation({
    mutationFn: async (collection: typeof newCollection) => {
      const response = await apiRequest('POST', '/api/collections', collection);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      setShowCreateDialog(false);
      setNewCollection({ name: '', description: '', isPublic: false });
      toast({
        title: "Collection Created",
        description: "Your new collection has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Delete collection mutation
  const deleteCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const response = await apiRequest('DELETE', `/api/collections/${collectionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      setSelectedCollection(null);
      toast({
        title: "Collection Deleted",
        description: "Collection has been deleted successfully.",
      });
    },
  });

  // Add photos to collection mutation
  const addPhotosToCollectionMutation = useMutation({
    mutationFn: async ({ collectionId, photoIds }: { collectionId: string; photoIds: string[] }) => {
      const response = await apiRequest('POST', `/api/collections/${collectionId}/photos`, { photoIds });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: "Photos Added",
        description: "Photos have been added to the collection.",
      });
    },
  });

  const handleCreateCollection = () => {
    if (!newCollection.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a collection name.",
        variant: "destructive"
      });
      return;
    }
    createCollectionMutation.mutate(newCollection);
  };

  const handleDeleteCollection = (collection: Collection) => {
    if (confirm(`Are you sure you want to delete "${collection.name}"? This action cannot be undone.`)) {
      deleteCollectionMutation.mutate(collection.id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Collections</h2>
          <p className="text-sm text-gray-500">Organize your photos into custom collections</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Collection Name</Label>
                <Input
                  id="name"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="Enter collection name..."
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                  placeholder="Describe your collection..."
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCollection}
                  disabled={createCollectionMutation.isPending}
                >
                  {createCollectionMutation.isPending ? "Creating..." : "Create Collection"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Collections Grid */}
      {!selectedCollection ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {collections?.map((collection) => (
            <Card key={collection.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="p-4">
                <div className="aspect-square rounded-lg bg-gray-100 mb-3 overflow-hidden">
                  {collection.coverPhoto ? (
                    <img 
                      src={`/api/files/${collection.coverPhoto}`}
                      alt={collection.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                      <FolderPlus className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg">{collection.name}</CardTitle>
                {collection.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{collection.description}</p>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <div className="flex items-center">
                    <Image className="h-4 w-4 mr-1" />
                    {collection.photoCount} photos
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(collection.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge variant={collection.isPublic ? "default" : "secondary"}>
                    {collection.isPublic ? "Public" : "Private"}
                  </Badge>
                  
                  <div className="flex space-x-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setSelectedCollection(collection)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleDeleteCollection(collection)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty State */}
          {collections?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
              <FolderPlus className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Collections Yet</h3>
              <p className="text-sm text-center mb-4">
                Create your first collection to organize your photos
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Collection
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Collection Detail View */
        <div>
          {/* Collection Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => setSelectedCollection(null)}
              >
                ← Back to Collections
              </Button>
              <div>
                <h3 className="text-xl font-semibold">{selectedCollection.name}</h3>
                <p className="text-sm text-gray-500">
                  {selectedCollection.photoCount} photos
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>

          {/* Collection Photos */}
          {photosLoading ? (
            <div className="animate-pulse">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (collectionPhotos?.length ?? 0) > 0 ? (
            <PhotoGrid 
              photos={collectionPhotos ?? []}
              viewMode="grid"
              onPhotoClick={() => {}}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Image className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Photos in Collection</h3>
              <p className="text-sm text-center mb-4">
                Add photos from your gallery to this collection
              </p>
              <Button onClick={() => setSelectedCollection(null)}>
                Browse Gallery
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}