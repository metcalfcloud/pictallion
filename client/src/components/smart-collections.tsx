
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Plus, Calendar, Camera, Tag, Palette, Users, MapPin, Clock, Heart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import type { Photo } from "@shared/types";

interface SmartCollection {
  id: string;
  name: string;
  description?: string;
  type: 'auto' | 'manual' | 'smart';
  criteria: {
    tags?: string[];
    dateRange?: { start: string; end: string };
    camera?: string;
    rating?: number;
    tier?: string;
    location?: string;
    colorTones?: string[];
  };
  photoCount: number;
  previewPhotos: Photo[];
  createdAt: string;
  isActive: boolean;
}

interface SmartCollectionsProps {
  onCollectionSelect?: (collectionId: string) => void;
  selectedPhotos?: string[];
}

export default function SmartCollections({ onCollectionSelect, selectedPhotos = [] }: SmartCollectionsProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    type: 'smart' as const,
    criteria: {}
  });
  const [selectedTab, setSelectedTab] = useState('suggested');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: collections, isLoading } = useQuery<SmartCollection[]>({
    queryKey: ["/api/collections/smart"],
  });

  const { data: suggestedCollections } = useQuery<SmartCollection[]>({
    queryKey: ["/api/collections/suggestions"],
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (collection: typeof newCollection) => {
      const response = await apiRequest('POST', '/api/collections', {
        body: JSON.stringify(collection),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      setIsCreateModalOpen(false);
      setNewCollection({ name: '', description: '', type: 'smart', criteria: {} });
      toast({
        title: "Collection Created",
        description: "Your smart collection has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Collection",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const addToCollectionMutation = useMutation({
    mutationFn: async ({ collectionId, photoIds }: { collectionId: string; photoIds: string[] }) => {
      const response = await apiRequest('POST', `/api/collections/${collectionId}/photos`, {
        body: JSON.stringify({ photoIds }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: "Photos Added",
        description: "Selected photos have been added to the collection.",
      });
    }
  });

  const getCollectionIcon = (criteria: SmartCollection['criteria']) => {
    if (criteria.camera) return <Camera className="w-4 h-4" />;
    if (criteria.tags?.length) return <Tag className="w-4 h-4" />;
    if (criteria.dateRange) return <Calendar className="w-4 h-4" />;
    if (criteria.location) return <MapPin className="w-4 h-4" />;
    if (criteria.colorTones?.length) return <Palette className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  const getCollectionTypeLabel = (type: string) => {
    switch (type) {
      case 'auto': return 'Auto-generated';
      case 'smart': return 'Smart Rules';
      case 'manual': return 'Manual';
      default: return type;
    }
  };

  const handleCreateCollection = () => {
    if (!newCollection.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your collection.",
        variant: "destructive"
      });
      return;
    }
    createCollectionMutation.mutate(newCollection);
  };

  const getPresetCollections = () => [
    {
      name: "Camera Portraits",
      criteria: { tags: ["portrait", "person"], camera: "Canon" },
      icon: <Users className="w-4 h-4" />
    },
    {
      name: "Recent Gold Photos",
      criteria: { tier: "gold", dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() } },
      icon: <Clock className="w-4 h-4" />
    },
    {
      name: "Sunset & Sunrise",
      criteria: { tags: ["sunset", "sunrise", "golden hour"] },
      icon: <Palette className="w-4 h-4" />
    },
    {
      name: "High Rated",
      criteria: { rating: 4 },
      icon: <Heart className="w-4 h-4" />
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Smart Collections</h3>
          <p className="text-sm text-muted-foreground">Organize photos automatically with intelligent grouping</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Smart Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Collection Name</Label>
                <Input
                  id="name"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Summer Vacation 2024"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newCollection.description}
                  onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this collection contains..."
                />
              </div>

              <div className="space-y-2">
                <Label>Quick Presets</Label>
                <div className="grid grid-cols-2 gap-2">
                  {getPresetCollections().map((preset, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start"
                      onClick={() => setNewCollection(prev => ({ 
                        ...prev, 
                        name: preset.name,
                        criteria: preset.criteria 
                      }))}
                    >
                      {preset.icon}
                      <span className="ml-2">{preset.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCollection}
                  disabled={createCollectionMutation.isPending}
                >
                  {createCollectionMutation.isPending ? 'Creating...' : 'Create Collection'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="suggested">Suggested</TabsTrigger>
          <TabsTrigger value="my-collections">My Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="suggested" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedCollections?.map((collection) => (
              <Card key={collection.id} className="group hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCollectionIcon(collection.criteria)}
                      <CardTitle className="text-sm">{collection.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      Auto
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-1">
                      {collection.previewPhotos.slice(0, 4).map((photo, index) => (
                        <img
                          key={photo.id}
                          src={`/api/files/${photo.filePath}`}
                          alt=""
                          className="w-full aspect-square object-cover rounded"
                        />
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{collection.photoCount} photos</span>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            createCollectionMutation.mutate({
                              ...newCollection,
                              name: collection.name,
                              criteria: collection.criteria,
                              type: 'smart'
                            });
                          }}
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-collections" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections?.map((collection) => (
              <Card key={collection.id} className="group hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCollectionIcon(collection.criteria)}
                      <CardTitle className="text-sm">{collection.name}</CardTitle>
                    </div>
                    <Badge variant={collection.type === 'smart' ? 'default' : 'secondary'} className="text-xs">
                      {getCollectionTypeLabel(collection.type)}
                    </Badge>
                  </div>
                  {collection.description && (
                    <p className="text-xs text-muted-foreground mt-1">{collection.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-1">
                      {collection.previewPhotos.slice(0, 4).map((photo, index) => (
                        <img
                          key={photo.id}
                          src={`/api/files/${photo.filePath}`}
                          alt=""
                          className="w-full aspect-square object-cover rounded"
                        />
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{collection.photoCount} photos</span>
                      <div className="flex space-x-1">
                        {selectedPhotos.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToCollectionMutation.mutate({
                              collectionId: collection.id,
                              photoIds: selectedPhotos
                            })}
                            disabled={addToCollectionMutation.isPending}
                          >
                            Add Selected
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => onCollectionSelect?.(collection.id)}
                        >
                          View
                        </Button>
                      </div>
                    </div>

                    {/* Show collection criteria */}
                    <div className="flex flex-wrap gap-1">
                      {collection.criteria.tags?.slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {collection.criteria.camera && (
                        <Badge variant="outline" className="text-xs">
                          📷 {collection.criteria.camera}
                        </Badge>
                      )}
                      {collection.criteria.tier && (
                        <Badge variant="outline" className="text-xs">
                          {collection.criteria.tier}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
