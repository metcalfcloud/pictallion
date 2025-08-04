import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EyeOff, Eye, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface IgnoredFace {
  id: string;
  photoId: string;
  boundingBox: [number, number, number, number];
  confidence: number;
  faceCropUrl?: string;
  ignored: boolean;
  photo?: {
    filePath: string;
    mediaAsset: {
      originalFilename: string;
    };
  };
}

export function IgnoredFaces() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ignored faces
  const { data: ignoredFaces = [], isLoading } = useQuery<IgnoredFace[]>({
    queryKey: ['/api/faces/ignored'],
    refetchInterval: false,
  });

  // Unignore face mutation
  const unignoreFaceMutation = useMutation({
    mutationFn: async (faceId: string) => {
      return await apiRequest('POST', `/api/faces/${faceId}/unignore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faces/ignored'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faces/unassigned'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faces/suggestions'] });
      toast({ title: 'Face restored successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to restore face', variant: 'destructive' });
    },
  });

  const getFaceCropUrl = (face: IgnoredFace) => {
    if (!face.photo) return '';
    const [x, y, width, height] = face.boundingBox;
    return `/api/files/${face.photo.filePath}?crop=${x},${y},${width},${height}&face=true`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-center">
          <EyeOff className="h-8 w-8 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p>Loading ignored faces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <EyeOff className="h-6 w-6 text-muted-foreground" />
            Ignored Faces
          </h2>
          <p className="text-muted-foreground">
            Manage faces you've chosen to ignore from face recognition suggestions
          </p>
        </div>
      </div>

      {/* Statistics */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Total Ignored Faces</p>
              <p className="text-2xl font-bold">{ignoredFaces.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No ignored faces state */}
      {ignoredFaces.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Ignored Faces</h3>
            <p className="text-muted-foreground">
              You haven't ignored any faces yet. Use the "Ignore Face" option in face
              suggestions to exclude faces you don't want to tag.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ignored faces grid */}
      {ignoredFaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ignoredFaces.map((face) => (
            <Card key={face.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="p-3">
                <div className="relative">
                  {face.photo ? (
                    <>
                      <img
                        src={
                          face.faceCropUrl
                            ? `/api/files/${face.faceCropUrl}`
                            : getFaceCropUrl(face)
                        }
                        alt="Ignored face"
                        className="w-full h-32 rounded-lg object-cover border-2 border-border"
                        onError={(e) => {
                          if (
                            face.faceCropUrl &&
                            e.currentTarget.src.includes(face.faceCropUrl)
                          ) {
                            e.currentTarget.src = getFaceCropUrl(face);
                          } else {
                            e.currentTarget.src = `/api/files/${face.photo?.filePath}`;
                          }
                        }}
                      />
                      <Badge className="absolute -top-1 -right-1 text-xs">
                        {Math.round(face.confidence)}%
                      </Badge>
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="secondary"
                          className="text-xs bg-red-100 text-red-700"
                        >
                          <EyeOff className="w-3 h-3 mr-1" />
                          Ignored
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-muted border-2 border-border flex items-center justify-center">
                      <EyeOff className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-3 pt-0">
                <div className="space-y-2">
                  <p className="text-sm font-medium truncate">
                    {face.photo?.mediaAsset.originalFilename || 'Unknown photo'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {Math.round(face.confidence)}%
                  </p>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    onClick={() => unignoreFaceMutation.mutate(face.id)}
                    disabled={unignoreFaceMutation.isPending}
                  >
                    <Eye className="h-3 w-3" />
                    {unignoreFaceMutation.isPending ? 'Restoring...' : 'Restore Face'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
