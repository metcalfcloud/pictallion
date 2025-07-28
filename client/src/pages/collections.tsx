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
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Collections</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Organize your photos into custom collections</p>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        {/* Example Collection Card */}
        <Card className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              My Vacation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A collection of my favorite vacation photos.
            </p>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">12 Photos</span>
              <Button variant="outline">View</Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Collection Button */}
        <Card className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden flex items-center justify-center">
          <Button variant="ghost" className="h-full w-full">
            <Plus className="h-6 w-6 mr-2" />
            Add Collection
          </Button>
        </Card>
      </div>
    </div>
  );
}