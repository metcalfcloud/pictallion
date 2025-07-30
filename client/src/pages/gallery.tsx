import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import * as React from "react";
import { Search, Grid, List, Filter, Bot, Star, Eye, CheckSquare, Square, MoreHorizontal, Sparkles } from "lucide-react";
import PhotoGrid from "@/components/photo-grid";
import PhotoDetailModal from "@/components/photo-detail-modal";
import { AdvancedSearch } from "@/components/advanced-search";
import BatchOperations from "@/components/batch-operations";
import SmartCollections from "@/components/smart-collections";
import { ProcessingStateBadge, getProcessingState } from "@/components/ui/processing-state-badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import type { Photo } from "@shared/types";

export default function Gallery() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tierFilter, setTierFilter] = useState<string>('unprocessed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showBatchOperations, setShowBatchOperations] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState<import("@/components/advanced-search").SearchFilters>({});
  const [showSmartCollections, setShowSmartCollections] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos", tierFilter !== 'all' ? { tier: tierFilter } : {}],
  });

  const processPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await apiRequest('POST', `/api/photos/${photoId}/process`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Processing Complete",
        description: "Photo has been processed with AI and moved to Silver tier.",
      });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const bulkProcessMutation = useMutation({
    mutationFn: async ({ photoIds }: { photoIds: string[] }) => {
      const response = await apiRequest('POST', '/api/photos/batch-process', {
        photoIds
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Bulk Processing Complete",
        description: `Successfully processed ${result.processed} photos to Silver tier.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Bulk Processing Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const bulkPromoteMutation = useMutation({
    mutationFn: async ({ photoIds }: { photoIds: string[] }) => {
      const response = await apiRequest('POST', '/api/photos/batch-promote', {
        photoIds
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Bulk Promotion Complete",
        description: `Successfully promoted ${result.promoted} photos to Gold tier.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Bulk Promotion Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Handle quick actions from photo grid
  React.useEffect(() => {
    const handleQuickSearch = (event: CustomEvent) => {
      setSearchQuery(event.detail);
    };

    const handleQuickPromote = (event: CustomEvent) => {
      bulkPromoteMutation.mutate([event.detail]);
    };

    const handleQuickCollection = (event: CustomEvent) => {
      // For now, just show a toast - can be expanded later
      toast({
        title: "Quick Collection",
        description: "Collection feature coming soon!",
      });
    };

    window.addEventListener('quickSearch', handleQuickSearch as EventListener);
    window.addEventListener('quickPromote', handleQuickPromote as EventListener);
    window.addEventListener('quickCollection', handleQuickCollection as EventListener);

    return () => {
      window.removeEventListener('quickSearch', handleQuickSearch as EventListener);
      window.removeEventListener('quickPromote', handleQuickPromote as EventListener);
      window.removeEventListener('quickCollection', handleQuickCollection as EventListener);
    };
  }, [bulkPromoteMutation, toast]);

  const filteredPhotos = photos?.filter(photo => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filename = photo.mediaAsset.originalFilename.toLowerCase();
      const tags = photo.metadata?.ai?.aiTags?.join(' ').toLowerCase() || '';
      const description = photo.metadata?.ai?.longDescription?.toLowerCase() || '';

      return filename.includes(query) || tags.includes(query) || description.includes(query);
    }
    return true;
  }) || [];

  const handleProcessPhoto = (photoId: string) => {
    processPhotoMutation.mutate(photoId);
  };

  const handleBulkProcessBronze = () => {
    // For "unprocessed" filter, get only bronze photos
    // For "bronze" filter, get all photos (which should all be bronze)
    const bronzePhotos = filteredPhotos.filter(photo => photo.tier === 'bronze');
    if (bronzePhotos.length === 0) {
      toast({
        title: "No Bronze Photos",
        description: "No Bronze tier photos available for processing.",
        variant: "destructive"
      });
      return;
    }
    const photoIds = bronzePhotos.map(p => p.id);
    console.log(`Processing ${photoIds.length} bronze photos...`);
    bulkProcessMutation.mutate({ photoIds });
  };

  const handleBulkPromoteToGold = () => {
    const silverPhotos = filteredPhotos.filter(photo => photo.tier === 'silver');
    if (silverPhotos.length === 0) {
      toast({
        title: "No Silver Photos",
        description: "No Silver tier photos available for promotion.",
        variant: "destructive"
      });
      return;
    }
    bulkPromoteMutation.mutate({ photoIds: silverPhotos.map(p => p.id) });
  };

  return (
    <>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-card-foreground">Gallery</h2>
            <p className="text-sm text-muted-foreground">Browse and manage your photo collection</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search photos..."
                className="w-80 pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Filters and Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unprocessed">Unprocessed Only</SelectItem>
                <SelectItem value="gold">Gold (Final)</SelectItem>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="bronze">Bronze (Raw)</SelectItem>
                <SelectItem value="silver">Silver (AI Processed)</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            >
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSmartCollections(!showSmartCollections)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Collections
            </Button>

            {selectedPhotos.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBatchOperations(true)}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Batch Actions ({selectedPhotos.length})
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {(tierFilter === 'bronze' || tierFilter === 'unprocessed') && (
              <Button
                size="sm"
                onClick={() => handleBulkProcessBronze()}
                disabled={processPhotoMutation.isPending || bulkProcessMutation.isPending}
              >
                <Bot className="w-4 h-4 mr-2" />
                {bulkProcessMutation.isPending ? 'Processing...' : 'Process All Bronze'}
              </Button>
            )}

            {tierFilter === 'silver' && (
              <Button
                size="sm"
                onClick={() => handleBulkPromoteToGold()}
                disabled={processPhotoMutation.isPending}
              >
                <Star className="w-4 h-4 mr-2" />
                Promote All to Gold
              </Button>
            )}

            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Advanced Search */}
        {showAdvancedSearch && (
          <div className="mb-6">
            <AdvancedSearch
              filters={searchFilters}
              onFiltersChange={setSearchFilters}
              onSearch={() => {
                // Apply advanced search filters here
                console.log('Advanced search filters:', searchFilters);
              }}
            />
          </div>
        )}

        {/* Smart Collections */}
        {showSmartCollections && (
          <div className="mb-6">
            <SmartCollections
              selectedPhotos={selectedPhotos}
              onCollectionSelect={(collectionId) => {
                // Navigate to collection view or filter by collection
                console.log('Selected collection:', collectionId);
                setShowSmartCollections(false);
              }}
            />
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredPhotos.length} photos
            {tierFilter !== 'all' && ` in ${tierFilter} tier`}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>

        {/* Photo Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-full h-32 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredPhotos.length > 0 ? (
          <PhotoGrid 
            photos={filteredPhotos}
            viewMode={viewMode}
            onPhotoClick={setSelectedPhoto}
            onProcessPhoto={handleProcessPhoto}
            isProcessing={processPhotoMutation.isPending || bulkProcessMutation.isPending || bulkPromoteMutation.isPending}
            selectedPhotos={selectedPhotos}
            onPhotoSelect={(photoId, selected) => {
              if (selected) {
                setSelectedPhotos(prev => [...prev, photoId]);
              } else {
                setSelectedPhotos(prev => prev.filter(id => id !== photoId));
              }
            }}
          />
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Grid className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">No photos found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? `No photos match your search for "${searchQuery}"`
                  : tierFilter !== 'all'
                  ? `No photos in ${tierFilter} tier`
                  : "Upload some photos to get started"
                }
              </p>
              {!searchQuery && tierFilter === 'all' && (
                <Button>Upload Photos</Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          open={!!selectedPhoto}
          onOpenChange={(open) => !open && setSelectedPhoto(null)}
          onProcessPhoto={handleProcessPhoto}
          isProcessing={processPhotoMutation.isPending}
        />
      )}
    </>
  );
}