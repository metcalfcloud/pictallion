import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Download,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import PhotoGrid from '@/components/photo-grid';
import type { Photo } from '@shared/types';

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
    isPublic: false,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch collections
  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ['/api/collections'],
  });

  // Fetch photos in selected collection
  const { data: collectionPhotos, isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ['/api/collections', selectedCollection?.id, 'photos'],
    enabled: !!selectedCollection,
  });

  // Create collection mutation
  const createCollectionMutation = useMutation({
    mutationFn: async (collection: typeof newCollection) => {
      const response = await apiRequest('POST', '/api/collections', collection);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      setShowCreateDialog(false);
      setNewCollection({ name: '', description: '', isPublic: false });
      toast({
        title: 'Collection Created',
        description: 'Your new collection has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
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
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      setSelectedCollection(null);
      toast({
        title: 'Collection Deleted',
        description: 'Collection has been deleted successfully.',
      });
    },
  });

  // Add photos to collection mutation
  const addPhotosToCollectionMutation = useMutation({
    mutationFn: async ({
      collectionId,
      photoIds,
    }: {
      collectionId: string;
      photoIds: string[];
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/collections/${collectionId}/photos`,
        { photoIds },
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      toast({
        title: 'Photos Added',
        description: 'Photos have been added to the collection.',
      });
    },
  });

  const handleCreateCollection = () => {
    if (!newCollection.name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a collection name.',
        variant: 'destructive',
      });
      return;
    }
    createCollectionMutation.mutate(newCollection);
  };

  const handleDeleteCollection = (collection: Collection) => {
    if (
      confirm(
        `Are you sure you want to delete "${collection.name}"? This action cannot be undone.`,
      )
    ) {
      deleteCollectionMutation.mutate(collection.id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If viewing a specific collection
  if (selectedCollection) {
    return (
      <div className="flex-1 overflow-auto bg-background dark:bg-gray-900">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <Button
              variant="outline"
              onClick={() => setSelectedCollection(null)}
              className="flex items-center"
            >
              ← Back to Collections
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground dark:text-white">
                {selectedCollection.name}
              </h1>
              {selectedCollection.description && (
                <p className="text-sm text-muted-foreground dark:text-gray-400">
                  {selectedCollection.description}
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedCollection.photoCount} photo
              {selectedCollection.photoCount !== 1 ? 's' : ''} in this collection
            </span>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              {selectedCollection.isPublic && (
                <Button size="sm" variant="outline">
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
              )}
            </div>
          </div>

          {photosLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-muted rounded animate-pulse"
                ></div>
              ))}
            </div>
          ) : collectionPhotos && collectionPhotos.length > 0 ? (
            <PhotoGrid
              photos={collectionPhotos}
              viewMode="grid"
              onPhotoClick={(photo) => {
                // Photo detail modal can be added here
                console.log('View photo:', photo.id);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Image className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No Photos in Collection
              </h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                This collection is empty. Add photos from your gallery to start
                organizing them.
              </p>
              <Button variant="outline" onClick={() => setSelectedCollection(null)}>
                Back to Collections
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background dark:bg-gray-900">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-card-foreground dark:text-white mb-6">
          Collections
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Organize your photos into custom collections
        </p>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        {collections && collections.length > 0 ? (
          <>
            {collections.map((collection) => (
              <Card
                key={collection.id}
                className="bg-card dark:bg-gray-800 shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedCollection(collection)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-card-foreground dark:text-white">
                      {collection.name}
                    </CardTitle>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Edit collection logic can be added here
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCollection(collection);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground dark:text-gray-400 mb-3">
                      {collection.description}
                    </p>
                  )}
                  {collection.coverPhoto && (
                    <div className="mb-3 aspect-video rounded overflow-hidden">
                      <img
                        src={`/api/files/${collection.coverPhoto}`}
                        alt={collection.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground dark:text-gray-400">
                      {collection.photoCount} Photo
                      {collection.photoCount !== 1 ? 's' : ''}
                    </span>
                    <div className="flex space-x-1">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {collection.isPublic && (
                        <Button size="sm" variant="outline">
                          <Share className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Collection Button */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Card className="bg-card dark:bg-gray-800 shadow-md rounded-lg overflow-hidden flex items-center justify-center hover:shadow-lg transition-shadow cursor-pointer border-dashed border-2">
                  <Button variant="ghost" className="h-full w-full flex-col py-8">
                    <Plus className="h-8 w-8 mb-2" />
                    <span>Add Collection</span>
                  </Button>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Collection</DialogTitle>
                  <DialogDescription>
                    Create a new collection to organize your photos by theme, event, or
                    any way you prefer.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Collection Name</Label>
                    <Input
                      id="name"
                      value={newCollection.name}
                      onChange={(e) =>
                        setNewCollection((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., Summer Vacation 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={newCollection.description}
                      onChange={(e) =>
                        setNewCollection((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe this collection..."
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={newCollection.isPublic}
                      onChange={(e) =>
                        setNewCollection((prev) => ({
                          ...prev,
                          isPublic: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <Label htmlFor="isPublic">Make this collection public</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateCollection}
                      disabled={createCollectionMutation.isPending}
                    >
                      {createCollectionMutation.isPending
                        ? 'Creating...'
                        : 'Create Collection'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <FolderPlus className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No Collections Yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Create your first collection to organize and group your photos by themes,
              events, or any way you like.
            </p>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Collection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Collection</DialogTitle>
                  <DialogDescription>
                    Create a new collection to organize your photos by theme, event, or
                    any way you prefer.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Collection Name</Label>
                    <Input
                      id="name"
                      value={newCollection.name}
                      onChange={(e) =>
                        setNewCollection((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., Summer Vacation 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={newCollection.description}
                      onChange={(e) =>
                        setNewCollection((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe this collection..."
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={newCollection.isPublic}
                      onChange={(e) =>
                        setNewCollection((prev) => ({
                          ...prev,
                          isPublic: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <Label htmlFor="isPublic">Make this collection public</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateCollection}
                      disabled={createCollectionMutation.isPending}
                    >
                      {createCollectionMutation.isPending
                        ? 'Creating...'
                        : 'Create Collection'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
