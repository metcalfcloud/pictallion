import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Clock, Camera, CheckCircle, AlertCircle, ArrowRight, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BurstGroup {
  id: string;
  photos: Array<{
    id: string;
    filePath: string;
    metadata?: any;
    mediaAsset: { originalFilename: string };
    createdAt: string;
    fileSize?: number;
    fileHash: string;
  }>;
  suggestedBest: string;
  averageSimilarity: number;
  timeSpan: number;
  groupReason: string;
}

interface BurstAnalysis {
  groups: BurstGroup[];
  totalPhotos: number;
  ungroupedPhotos: any[];
}

export default function BurstSelectionPage() {
  const [analysis, setAnalysis] = useState<BurstAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, string[]>>(new Map()); // groupId -> photoIds[]
  const [scanProgress, setScanProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    scanForBurstPhotos();
  }, []);

  const scanForBurstPhotos = async () => {
    setLoading(true);
    setScanProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/burst/analyze');
      const data = await response.json();

      clearInterval(progressInterval);
      setScanProgress(100);

      setTimeout(() => {
        setAnalysis(data);

        // Initialize selections with suggested best photos
        const initialSelections = new Map<string, string[]>();
        data.groups.forEach((group: BurstGroup) => {
          initialSelections.set(group.id, [group.suggestedBest]);
        });
        setSelectedPhotos(initialSelections);

        setLoading(false);
      }, 500);

    } catch (error) {
      console.error('Failed to analyze burst photos:', error);
      setLoading(false);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze photos for burst sequences.",
        variant: "destructive"
      });
    }
  };

  const processSelections = async () => {
    if (!analysis) return;

    setProcessing(true);

    try {
      const selections = Array.from(selectedPhotos.entries()).map(([groupId, photoIds]) => ({
        groupId,
        selectedPhotoIds: photoIds
      }));

      const response = await apiRequest('POST', '/api/burst/process', {
        body: JSON.stringify({ 
          selections,
          ungroupedPhotos: analysis.ungroupedPhotos.map(p => p.id)
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      toast({
        title: "Processing Complete",
        description: `Successfully processed ${result.processed} photos. ${result.promoted} promoted to Silver tier.`,
      });

      // Refresh analysis
      await scanForBurstPhotos();

    } catch (error) {
      console.error('Failed to process selections:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process photo selections.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const togglePhotoSelection = (groupId: string, photoId: string) => {
    const current = selectedPhotos.get(groupId) || [];
    let updated: string[];

    if (current.includes(photoId)) {
      updated = current.filter(id => id !== photoId);
    } else {
      updated = [...current, photoId];
    }

    const newSelections = new Map(selectedPhotos);
    newSelections.set(groupId, updated);
    setSelectedPhotos(newSelections);
  };

  const selectAllInGroup = (groupId: string) => {
    const group = analysis?.groups.find(g => g.id === groupId);
    if (!group) return;

    const newSelections = new Map(selectedPhotos);
    newSelections.set(groupId, group.photos.map(p => p.id));
    setSelectedPhotos(newSelections);
  };

  const selectSuggestedOnly = (groupId: string) => {
    const group = analysis?.groups.find(g => g.id === groupId);
    if (!group) return;

    const newSelections = new Map(selectedPhotos);
    newSelections.set(groupId, [group.suggestedBest]);
    setSelectedPhotos(newSelections);
  };

  const formatTimeSpan = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading && !analysis) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Burst Photo Detection</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analyzing Photos for Burst Sequences...</CardTitle>
            <CardDescription>Looking for similar photos taken within short time periods</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={scanProgress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              {scanProgress < 30 ? 'Reading photo metadata...' : 
               scanProgress < 60 ? 'Comparing timestamps and similarity...' : 
               scanProgress < 90 ? 'Grouping burst sequences...' :
               'Finalizing analysis...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-card-foreground mb-2">No Analysis Available</h3>
            <p className="text-muted-foreground mb-4">Unable to analyze photos for burst sequences.</p>
            <Button onClick={() => scanForBurstPhotos()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSelectedCount = Array.from(selectedPhotos.values())
    .reduce((sum, photos) => sum + photos.length, 0);

  return (
    <div className="flex-1 overflow-auto bg-background dark:bg-gray-900">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-card-foreground dark:text-white mb-6">Burst Selection</h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">Select which photos to promote from burst sequences</p>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">Burst Groups</p>
                  <p className="text-2xl font-bold text-card-foreground dark:text-white">{analysis.groups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">Selected for Processing</p>
                  <p className="text-2xl font-bold text-card-foreground dark:text-white">{totalSelectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">Total Photos</p>
                  <p className="text-2xl font-bold text-card-foreground dark:text-white">{analysis.totalPhotos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Burst Groups */}
        <div className="space-y-6 mt-8">
          {analysis.groups.map((group) => {
            const selectedInGroup = selectedPhotos.get(group.id) || [];

            return (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-card-foreground dark:text-white">
                        Burst Group - {group.photos.length} photos
                      </CardTitle>
                      <CardDescription className="flex items-center space-x-4 text-muted-foreground dark:text-gray-400">
                        <span>{group.groupReason}</span>
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTimeSpan(group.timeSpan)}
                        </Badge>
                        <Badge variant="outline">
                          {Math.round(group.averageSimilarity * 100)}% similar
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSuggestedOnly(group.id)}
                      >
                        Best Only
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectAllInGroup(group.id)}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {group.photos.map((photo) => {
                      const isSelected = selectedInGroup.includes(photo.id);
                      const isSuggested = photo.id === group.suggestedBest;

                      return (
                        <div
                          key={photo.id}
                          className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-border hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
                          onClick={() => togglePhotoSelection(group.id, photo.id)}
                        >
                          {isSuggested && (
                            <Badge className="absolute top-2 left-2 z-10 bg-green-500">
                              Best
                            </Badge>
                          )}

                          <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <img
                              src={`/api/files/${photo.filePath}`}
                              alt={photo.mediaAsset.originalFilename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="p-2 bg-card dark:bg-gray-900">
                            <div className="flex items-center justify-between">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => togglePhotoSelection(group.id, photo.id)}
                              />
                              <span className="text-xs text-muted-foreground dark:text-gray-400">
                                {photo.metadata?.exif?.camera || 'Unknown camera'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground dark:text-gray-300 truncate mt-1">
                              {(() => {
                                // Extract actual photo time from filename (YYYYMMDD_HHMMSS format)
                                const filename = photo.mediaAsset.originalFilename;
                                const match = filename.match(/^(\d{8})_(\d{6})/);
                                if (match) {
                                  const dateStr = match[1]; // YYYYMMDD
                                  const timeStr = match[2]; // HHMMSS
                                  const year = dateStr.substring(0, 4);
                                  const month = dateStr.substring(4, 6);
                                  const day = dateStr.substring(6, 8);
                                  const hour = timeStr.substring(0, 2);
                                  const minute = timeStr.substring(2, 4);
                                  const second = timeStr.substring(4, 6);
                                  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                                }
                                return filename;
                              })()}
                            </p>
                            <p className="text-xs text-muted-foreground dark:text-gray-400">
                              {photo.metadata?.exif?.iso ? `ISO ${photo.metadata.exif.iso}` : ''} 
                              {photo.metadata?.exif?.aperture ? ` • ${photo.metadata.exif.aperture}` : ''}
                              {photo.metadata?.exif?.shutter ? ` • ${photo.metadata.exif.shutter}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Ungrouped Photos */}
        {analysis.ungroupedPhotos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-card-foreground dark:text-white">Individual Photos</CardTitle>
              <CardDescription className="text-muted-foreground dark:text-gray-400">
                {analysis.ungroupedPhotos.length} photos that don't appear to be part of burst sequences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground dark:text-gray-300">
                These photos will be automatically processed individually.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}