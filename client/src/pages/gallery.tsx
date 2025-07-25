import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Grid, List, Filter, Bot, Star, Eye, CheckSquare, Square, MoreHorizontal } from "lucide-react";
import PhotoGrid from "@/components/photo-grid";
import PhotoDetailModal from "@/components/photo-detail-modal";
import AdvancedSearch from "@/components/advanced-search";
import BatchOperations from "@/components/batch-operations";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import type { Photo } from "@shared/types";

export default function Gallery() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showBatchOperations, setShowBatchOperations] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    query: '',
    tier: [],
    dateRange: {},
    camera: '',
    tags: [],
    location: '',
    aiConfidence: [0, 100],
    fileType: [],
    fileSize: [0, 100],
    hasGPS: false,
    hasFaces: false,
    people: []
  });
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

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Gallery</h2>
            <p className="text-sm text-gray-500">Browse and manage your photo collection</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>

          <div className="flex items-center space-x-2">
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

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
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
            isProcessing={processPhotoMutation.isPending}
          />
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Grid className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No photos found</h3>
              <p className="text-gray-500 mb-4">
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
