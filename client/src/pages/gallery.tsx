import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import * as React from "react";
import { Search, Grid, List, Filter, Bot, Star, Eye, CheckSquare, Square, MoreHorizontal, Sparkles, Users, X } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import PhotoGrid from "@/components/photo-grid";
import PhotoDetailModal from "@/components/photo-detail-modal";
import { AdvancedSearch } from "@/components/advanced-search";
import BatchOperations from "@/components/batch-operations";
import SmartCollections from "@/components/smart-collections";
import { ProcessingStateBadge, getProcessingState } from "@/components/ui/processing-state-badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { info } from "@/lib/logger";

import type { Photo } from "@shared/types";

export default function Gallery() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleFilter, setPeopleFilter] = useState<string | null>(null);
  const [location] = useLocation();
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showBatchOperations, setShowBatchOperations] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState<import("@/components/advanced-search").SearchFilters>({});
  const [showSmartCollections, setShowSmartCollections] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState({ processed: 0, total: 0 });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Handle URL parameters for people filter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('person');
    if (personId !== peopleFilter) {
      setPeopleFilter(personId);
    }
  }, [location, peopleFilter]);

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos", tierFilter !== 'all' ? { tier: tierFilter } : {}],
    refetchInterval: isBatchProcessing ? 2000 : false, // Auto-refresh every 2 seconds during batch processing
  });

  const { data: people } = useQuery({
    queryKey: ["/api/people"],
  });

  // Get photos for the selected person when filtering by people
  const { data: personPhotos } = useQuery({
    queryKey: ["/api/people", peopleFilter, "photos"],
    queryFn: () => peopleFilter ? fetch(`/api/people/${peopleFilter}/photos`).then(res => res.json()) : null,
    enabled: !!peopleFilter,
  });

  const processPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await apiRequest('POST', `/api/photos/${photoId}/reprocess`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Processing Complete",
        description: "Photo has been reprocessed with updated AI analysis.",
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
    onMutate: ({ photoIds }) => {
      setIsBatchProcessing(true);
      setProcessingStats({ processed: 0, total: photoIds.length });
    },
    onSuccess: (result) => {
      setIsBatchProcessing(false);
      setProcessingStats({ processed: 0, total: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Bulk Processing Complete",
        description: `Successfully processed ${result.processed} photos to Silver tier.`,
      });
    },
    onError: (error) => {
      setIsBatchProcessing(false);
      setProcessingStats({ processed: 0, total: 0 });
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
    onMutate: ({ photoIds }) => {
      setIsBatchProcessing(true);
      setProcessingStats({ processed: 0, total: photoIds.length });
    },
    onSuccess: (result) => {
      setIsBatchProcessing(false);
      setProcessingStats({ processed: 0, total: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Bulk Promotion Complete",
        description: `Successfully promoted ${result.promoted} photos to Gold tier.`,
      });
    },
    onError: (error) => {
      setIsBatchProcessing(false);
      setProcessingStats({ processed: 0, total: 0 });
      toast({
        title: "Bulk Promotion Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Track processing progress by counting tier changes
  React.useEffect(() => {
    if (isBatchProcessing && photos) {
      const silverCount = photos.filter(photo => photo.tier === 'silver').length;
      const totalProcessed = Math.max(0, processingStats.total - silverCount);
      
      if (totalProcessed !== processingStats.processed) {
        setProcessingStats(prev => ({ ...prev, processed: totalProcessed }));
      }
    }
  }, [photos, isBatchProcessing, processingStats.total, processingStats.processed]);

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
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filename = photo.mediaAsset.originalFilename.toLowerCase();
      const tags = photo.metadata?.ai?.aiTags?.join(' ').toLowerCase() || '';
      const description = photo.metadata?.ai?.longDescription?.toLowerCase() || '';

      if (!(filename.includes(query) || tags.includes(query) || description.includes(query))) {
        return false;
      }
    }

    // People filter - check if photo is in the person's photos
    if (peopleFilter && personPhotos) {
      const isInPersonPhotos = personPhotos.some((personPhoto: any) => personPhoto.id === photo.id);
      if (!isInPersonPhotos) {
        return false;
      }
    }

    return true;
  }) || [];

  const handleProcessPhoto = (photoId: string) => {
    processPhotoMutation.mutate(photoId);
  };

  const handleBulkProcessSilver = () => {
    // Get unreviewed silver photos for batch processing
    const silverPhotos = filteredPhotos.filter(photo => photo.tier === 'silver' && !photo.isReviewed);
    if (silverPhotos.length === 0) {
      toast({
        title: "No Unprocessed Photos",
        description: "No Silver tier photos available for processing.",
        variant: "destructive"
      });
      return;
    }
    const photoIds = silverPhotos.map(p => p.id);
    info(`Processing ${photoIds.length} silver photos`, "Gallery");
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
        {/* Batch Processing Indicator */}
        {isBatchProcessing && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-blue-600 animate-pulse" />
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  Batch Processing in Progress...
                </span>
              </div>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {processingStats.processed} / {processingStats.total} completed
              </span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${processingStats.total > 0 ? (processingStats.processed / processingStats.total) * 100 : 0}%` 
                }}
              />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              You can navigate away from this page - processing will continue in the background.
              Return here to see the updated results.
            </p>
          </div>
        )}
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
                <SelectItem value="silver">Silver (AI Processed)</SelectItem>
              </SelectContent>
            </Select>

            {/* People Filter */}
            {peopleFilter ? (
              <div className="flex items-center bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                <Users className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm text-blue-900 dark:text-blue-100 mr-2">
                  {people?.find((p: any) => p.id === peopleFilter)?.name || 'Unknown Person'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPeopleFilter(null);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('person');
                    window.history.replaceState({}, '', url.toString());
                  }}
                  className="h-auto p-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : null}

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
            {tierFilter === 'silver' && (
              <Button
                size="sm"
                onClick={() => handleBulkProcessSilver()}
                disabled={processPhotoMutation.isPending || bulkProcessMutation.isPending || isBatchProcessing}
              >
                <Bot className={cn("w-4 h-4 mr-2", isBatchProcessing && "animate-pulse")} />
                {isBatchProcessing 
                  ? `Processing... (${processingStats.processed}/${processingStats.total})` 
                  : bulkProcessMutation.isPending 
                  ? 'Starting...' 
                  : 'Review Silver Photos'
                }
              </Button>
            )}

            {tierFilter === 'silver' && (
              <Button
                size="sm"
                onClick={() => handleBulkPromoteToGold()}
                disabled={processPhotoMutation.isPending || bulkPromoteMutation.isPending || isBatchProcessing}
              >
                <Star className={cn("w-4 h-4 mr-2", isBatchProcessing && "animate-pulse")} />
                {isBatchProcessing 
                  ? `Promoting... (${processingStats.processed}/${processingStats.total})` 
                  : bulkPromoteMutation.isPending 
                  ? 'Starting...' 
                  : 'Promote All to Gold'
                }
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
                info('Advanced search filters', "Gallery", { searchFilters });
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
                info('Selected collection', "Gallery", { collectionId });
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