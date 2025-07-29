import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Upload, File, CheckCircle, X, AlertCircle, ArrowRight, Clock, HardDrive } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DuplicateConflict {
  id: string;
  existingPhoto: {
    id: string;
    filePath: string;
    tier: string;
    fileHash: string;
    perceptualHash?: string;
    metadata?: any;
    mediaAsset: {
      originalFilename: string;
    };
    createdAt: string;
    fileSize: number;
  };
  newFile: {
    tempPath: string;
    originalFilename: string;
    fileHash: string;
    perceptualHash?: string;
    fileSize: number;
    metadata?: any;
  };
  conflictType: 'identical_md5' | 'visually_identical' | 'similar_metadata';
  similarity: number;
  suggestedAction: 'keep_existing' | 'replace_with_new' | 'keep_both';
  reasoning: string;
}

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate' | 'conflict';
  message?: string;
  conflicts?: DuplicateConflict[];
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, { action: string; conflict: DuplicateConflict }>>(new Map());
  const [showConflicts, setShowConflicts] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('Upload response:', data);
      setUploadFiles(current => 
        current.map(uploadFile => {
          const result = data.results.find((r: any) => r.filename === uploadFile.file.name);
          console.log(`Processing result for ${uploadFile.file.name}:`, result);
          if (result) {
            return {
              ...uploadFile,
              status: result.status as UploadFile['status'],
              message: result.message,
              progress: 100,
              conflicts: result.conflicts || [],
            };
          }
          return uploadFile;
        })
      );

      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      const successCount = data.results.filter((r: any) => r.status === 'success').length;
      const conflictCount = data.results.filter((r: any) => r.status === 'conflict').length;

      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${successCount} photos uploaded successfully`,
        });
      }

      if (conflictCount > 0) {
        setShowConflicts(true);
        toast({
          title: "Duplicate Conflicts Found",
          description: `${conflictCount} files have potential duplicates. Please review.`,
          variant: "default"
        });
      }
    },
    onError: (error) => {
      setUploadFiles(current => 
        current.map(file => ({
          ...file,
          status: 'error',
          message: 'Upload failed',
          progress: 0,
        }))
      );
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (resolutions: Array<{ conflictId: string; action: string; conflict: DuplicateConflict }>) => {
      const response = await fetch('/api/duplicates/conflicts/batch-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutions }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflicts');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conflicts Resolved",
        description: `${data.successful} conflicts resolved successfully`,
      });
      setShowConflicts(false);
      setConflictResolutions(new Map());
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Resolve Conflicts",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadFiles(current => [...current, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.tiff'],
      'video/*': ['.mp4', '.mov', '.avi']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    // Only set uploading status for pending files
    setUploadFiles(current => 
      current.map(file => 
        file.status === 'pending' 
          ? { ...file, status: 'uploading' as const, progress: 0 }
          : file
      )
    );

    const progressInterval = setInterval(() => {
      setUploadFiles(current => 
        current.map(file => 
          file.status === 'uploading' 
            ? { ...file, progress: Math.min(file.progress + Math.random() * 30, 90) }
            : file
        )
      );
    }, 500);

    // Only upload pending files
    uploadMutation.mutate(pendingFiles.map(f => f.file));

    setTimeout(() => {
      clearInterval(progressInterval);
    }, 3000);
  };

  const removeFile = (id: string) => {
    setUploadFiles(current => current.filter(file => file.id !== id));
  };

  const closeModal = () => {
    setUploadFiles([]);
    setShowConflicts(false);
    setConflictResolutions(new Map());
    onOpenChange(false);
  };

  const clearCompletedFiles = () => {
    setUploadFiles(current => 
      current.filter(file => file.status === 'pending' || file.status === 'uploading')
    );
  };

  const updateConflictResolution = (conflictId: string, action: string, conflict: DuplicateConflict) => {
    setConflictResolutions(current => {
      const updated = new Map(current);
      updated.set(conflictId, { action, conflict });
      return updated;
    });
  };

  const handleResolveConflicts = () => {
    const resolutions = Array.from(conflictResolutions.entries()).map(([conflictId, { action, conflict }]) => ({
      conflictId,
      action,
      conflict
    }));

    if (resolutions.length === 0) {
      toast({
        title: "No Resolutions Selected",
        description: "Please select actions for the conflicts before proceeding.",
        variant: "destructive"
      });
      return;
    }

    resolveMutation.mutate(resolutions);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'duplicate':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case 'identical_md5':
        return 'Identical File';
      case 'visually_identical':
        return 'Visually Identical';
      case 'similar_metadata':
        return 'Similar Metadata';
      default:
        return 'Unknown';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'keep_existing':
        return 'Keep Existing';
      case 'replace_with_new':
        return 'Replace with New';
      case 'keep_both':
        return 'Keep Both';
      default:
        return 'Select Action';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
          <DialogDescription>
            Upload photos and videos to your collection. Duplicate detection will help you manage existing files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drag and Drop Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary hover:bg-primary/5'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-card-foreground mb-2">
              {isDragActive ? 'Drop photos here' : 'Drag and drop your photos here'}
            </h4>
            <p className="text-muted-foreground mb-4">or click to browse your files</p>
            <Button type="button">Choose Files</Button>
            <p className="text-xs text-muted-foreground mt-4">
              Supports JPEG, PNG, TIFF, MP4, MOV, AVI files up to 50MB each
            </p>
          </div>

          {/* Upload Progress */}
          {uploadFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Upload Queue ({uploadFiles.length} files)</h4>
                <div className="flex space-x-2">
                  {uploadFiles.some(f => f.status === 'success' || f.status === 'error' || f.status === 'conflict') && (
                    <Button variant="outline" size="sm" onClick={clearCompletedFiles}>
                      Clear Completed
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setUploadFiles([])}>
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadFiles.map((uploadFile) => (
                  <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-background rounded-lg">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {uploadFile.file.name}
                      </p>
                      {uploadFile.status === 'uploading' && (
                        <Progress value={uploadFile.progress} className="h-2 mt-1" />
                      )}
                      {uploadFile.message && (
                        <p className="text-xs text-muted-foreground mt-1">{uploadFile.message}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {uploadFile.status === 'uploading' 
                        ? `${Math.round(uploadFile.progress)}%`
                        : uploadFile.status === 'success' 
                        ? 'Done'
                        : uploadFile.status === 'error'
                        ? 'Failed'
                        : uploadFile.status === 'duplicate'
                        ? 'Duplicate'
                        : uploadFile.status === 'conflict'
                        ? 'Conflict'
                        : 'Ready'
                      }
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadFile.id)}
                      disabled={uploadFile.status === 'uploading'}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={closeModal}>
            {uploadFiles.some(f => f.status === 'success') ? 'Done' : 'Cancel'}
          </Button>
          {uploadFiles.some(f => f.status === 'conflict') && (
            <Button 
              onClick={() => setShowConflicts(true)}
              variant="outline"
              className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
            >
              Resolve Conflicts ({uploadFiles.filter(f => f.status === 'conflict').length})
            </Button>
          )}
          {uploadFiles.length > 0 && uploadFiles.some(f => f.status === 'pending') && (
            <Button 
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Start Upload'}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Resolve Duplicate Conflicts</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {uploadFiles
              .filter(f => f.status === 'conflict' && f.conflicts)
              .flatMap(uploadFile => 
                uploadFile.conflicts!.map(conflict => (
                  <Card key={conflict.id} className="border-orange-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-orange-600" />
                          {getConflictTypeLabel(conflict.conflictType)}
                          <Badge variant="outline" className="ml-2">
                            {Math.round(conflict.similarity * 100)}% match
                          </Badge>
                        </CardTitle>
                        <Badge variant="secondary">
                          {conflict.suggestedAction === 'keep_existing' ? 'Recommended: Keep Existing' :
                           conflict.suggestedAction === 'replace_with_new' ? 'Recommended: Replace' :
                           'Recommended: Keep Both'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{conflict.reasoning}</p>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Existing File */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-card-foreground flex items-center gap-2">
                            <HardDrive className="w-4 h-4" />
                            Existing File
                          </h4>
                          <div className="bg-background p-3 rounded-lg space-y-2">
                            <p className="font-medium text-sm">{conflict.existingPhoto.mediaAsset.originalFilename}</p>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>Size: {formatFileSize(conflict.existingPhoto.fileSize)}</p>
                              <p>Tier: {conflict.existingPhoto.tier.toUpperCase()}</p>
                              <p className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(conflict.existingPhoto.createdAt).toLocaleDateString()}
                              </p>
                              {conflict.existingPhoto.metadata?.dateTime && (
                                <p>Photo taken: {new Date(conflict.existingPhoto.metadata.dateTime).toLocaleDateString()}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* New File */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-card-foreground flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            New File
                          </h4>
                          <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                            <p className="font-medium text-sm">{conflict.newFile.originalFilename}</p>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>Size: {formatFileSize(conflict.newFile.fileSize)}</p>
                              <p>Status: Pending Upload</p>
                              {conflict.newFile.metadata?.dateTime && (
                                <p>Photo taken: {new Date(conflict.newFile.metadata.dateTime).toLocaleDateString()}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Action Selection */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Choose Action:</label>
                          <p className="text-xs text-muted-foreground">
                            This decision will apply to this specific conflict
                          </p>
                        </div>
                        <Select
                          value={conflictResolutions.get(conflict.id)?.action || ''}
                          onValueChange={(action) => updateConflictResolution(conflict.id, action, conflict)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select Action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="keep_existing">Keep Existing File</SelectItem>
                            <SelectItem value="replace_with_new">Replace with New File</SelectItem>
                            <SelectItem value="keep_both">Keep Both Files</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConflicts(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolveConflicts}
              disabled={resolveMutation.isPending || conflictResolutions.size === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {resolveMutation.isPending ? 'Resolving...' : `Resolve ${conflictResolutions.size} Conflicts`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}