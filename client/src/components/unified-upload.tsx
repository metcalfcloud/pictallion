import React, { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, CheckCircle, AlertCircle, File, Clock, HardDrive } from "lucide-react";

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
  status: 'pending' | 'uploading' | 'success' | 'error' | 'conflict' | 'skipped';
  progress: number;
  message?: string;
  conflicts?: DuplicateConflict[];
}

interface UnifiedUploadProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: 'modal' | 'fullscreen';
  preloadedFiles?: UploadFile[];
  onConflictResolved?: () => void;
}

export function UnifiedUpload({ 
  open = true,
  onOpenChange, 
  mode = 'fullscreen',
  preloadedFiles,
  onConflictResolved 
}: UnifiedUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>(preloadedFiles || []);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, { action: string; conflict: DuplicateConflict }>>(new Map());
  const [showConflicts, setShowConflicts] = useState(!!preloadedFiles?.length);
  const [isDragActive, setIsDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File handling
  const handleFilesSelected = useCallback((files: File[]) => {
    const currentFilenames = new Set(uploadFiles.map(f => f.file.name));

    // Filter out files that are already in the upload queue
    const uniqueFiles = files.filter(file => {
      if (currentFilenames.has(file.name)) {
        toast({
          title: "Duplicate File",
          description: `"${file.name}" is already in the upload queue.`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });

    if (uniqueFiles.length === 0) return;

    const newFiles: UploadFile[] = uniqueFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadFiles(current => [...current, ...newFiles]);
  }, [uploadFiles, toast]);

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (validFiles.length > 0) {
      handleFilesSelected(validFiles);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // File management functions
  const handleUpload = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    // Set uploading status immediately
    setUploadFiles(current => 
      current.map(file => ({ ...file, status: 'uploading' as const, progress: 0 }))
    );

    try {
        const formData = new FormData();
        pendingFiles.forEach(file => {
            formData.append('files', file.file);
        });

        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);

            // Update progress for all uploading files
            setUploadFiles(current => 
              current.map(file => 
                file.status === 'uploading' 
                  ? { ...file, progress: percentComplete }
                  : file
              )
            );
          }
        });

        // Handle completion
        const uploadPromise = new Promise<any>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (e) {
                reject(new Error('Invalid response format'));
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.ontimeout = () => reject(new Error('Upload timed out'));
        });

        // Send the request
        xhr.open('POST', '/api/upload');
        xhr.send(formData);

        const data = await uploadPromise;

        // Update upload files with results
        setUploadFiles(current =>
            current.map(uploadFile => {
                const result = data.results.find((r: any) => r.filename === uploadFile.file.name);
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

        // Show conflicts if any
        const conflictCount = data.results.filter((r: any) => r.status === 'conflict').length;
        if (conflictCount > 0) {
            setShowConflicts(true);
            toast({
                title: "Duplicate Conflicts Found",
                description: `${conflictCount} files have potential duplicates. Please review.`,
            });
        }

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photos/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/faces"] });
        queryClient.invalidateQueries({ queryKey: ["/api/faces/unassigned"] });
        queryClient.invalidateQueries({ queryKey: ["/api/faces/suggestions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/people"] });

    } catch (error) {
        setUploadFiles(current =>
            current.map(file =>
                file.status === 'uploading'
                    ? { ...file, status: 'error', message: 'Upload failed', progress: 0 }
                    : file
            )
        );
        toast({
            title: "Upload Failed",
            description: "An error occurred during upload. Please try again.",
            variant: "destructive"
        });
    }
};


  const removeFile = (id: string) => {
    setUploadFiles(current => current.filter(file => file.id !== id));
  };

  const clearAll = () => {
    setUploadFiles([]);
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

// Resolve conflicts mutation
  const resolveMutation = useMutation({
    mutationFn: async (resolutions: Array<{conflictId: string, action: string, conflict: DuplicateConflict}>) => {
      const response = await apiRequest('POST', '/api/upload/resolve-conflicts', { resolutions });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      setShowConflicts(false);
      setConflictResolutions(new Map());
      toast({ title: "Conflicts resolved successfully" });
      onConflictResolved?.();
    },
    onError: () => {
      toast({ title: "Failed to resolve conflicts", variant: "destructive" });
    }
  });

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

    // resolveMutation.mutate(resolutions);
  };

  const closeModal = () => {
    setUploadFiles([]);
    setShowConflicts(false);
    setConflictResolutions(new Map());
    onOpenChange?.(false);
  };

  // Utility functions
  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'skipped':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (file: UploadFile) => {
    switch (file.status) {
      case 'success':
        return 'Uploaded successfully';
      case 'error':
        return file.message || 'Upload failed';
      case 'conflict':
        return file.message || 'Duplicate detected';
      case 'skipped':
        return file.message || 'Skipped - identical file exists';
      case 'uploading':
        return `${Math.round(file.progress)}%`;
      default:
        return 'Ready to upload';
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

  const formatExifDateTime = (dateStr: any) => {
    try {
      // Handle EXIF date format "YYYY:MM:DD HH:MM:SS"
      if (typeof dateStr === 'string' && dateStr.includes(':')) {
        const normalizedDate = dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1/$2/$3');
        return new Date(normalizedDate).toLocaleString();
      }
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return 'Unknown';
    }
  };

  // Main upload interface
  const UploadInterface = () => (
    <div className="space-y-6">
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary hover:bg-primary/5'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
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

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Upload Queue ({uploadFiles.length} files)</h4>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear Queue
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploadFiles.map((uploadFile) => (
              <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-background rounded-lg border">
                {getStatusIcon(uploadFile.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">
                    {uploadFile.file.name}
                  </p>
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-1">
                      <Progress value={uploadFile.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploading... {Math.round(uploadFile.progress)}%
                      </p>
                    </div>
                  )}
                  {uploadFile.message && uploadFile.status !== 'uploading' && (
                    <p className="text-xs text-muted-foreground mt-1">{uploadFile.message}</p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {getStatusText(uploadFile)}
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
  );

  // Action buttons
  const ActionButtons = () => {
    const hasCompleted = uploadFiles.some(f => ['success', 'error', 'conflict', 'skipped'].includes(f.status));
    const hasPending = uploadFiles.some(f => f.status === 'pending');
    const isUploading = uploadFiles.some(f => f.status === 'uploading');
    const hasConflicts = uploadFiles.some(f => f.status === 'conflict');

    // Don't show action buttons if there are no files and no actions to take
    if (uploadFiles.length === 0) {
      return null;
    }

    return (
      <div className="flex justify-end space-x-3 pt-4 border-t">
        {/* Primary action button */}
        {hasPending ? (
          <Button 
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Start Upload'}
          </Button>
        ) : hasCompleted ? (
          <Button onClick={clearCompletedFiles}>
            Done
          </Button>
        ) : mode === 'modal' ? (
          <Button variant="outline" onClick={closeModal}>
            Close
          </Button>
        ) : null}

        {/* Secondary actions */}
        {hasConflicts && (
          <Button 
            onClick={() => setShowConflicts(true)}
            variant="outline"
            className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
          >
            Resolve Conflicts ({uploadFiles.filter(f => f.status === 'conflict').length})
          </Button>
        )}
      </div>
    );
  };

  // Advanced conflict resolution dialog with detailed EXIF metadata
  const ConflictResolutionDialog = () => (
    <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Resolve Duplicate Conflicts</DialogTitle>
          <DialogDescription>
            Review each conflict and choose how to handle duplicate files. Detailed metadata comparison helps you make informed decisions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {uploadFiles
            .filter(f => f.status === 'conflict' && f.conflicts)
            .map(uploadFile => 
              uploadFile.conflicts!.map(conflict => (
                <Card key={conflict.id} className="border-orange-200 dark:border-orange-800">
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
                      {/* Existing File - Detailed View */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-card-foreground flex items-center gap-2">
                          <HardDrive className="w-4 h-4" />
                          Existing File
                        </h4>
                        <div className="bg-background p-4 rounded-lg space-y-3">
                          <div>
                            <p className="font-medium text-sm">{conflict.existingPhoto.mediaAsset.originalFilename}</p>
                            <p className="text-xs text-muted-foreground">File Hash: {conflict.existingPhoto.fileHash}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">File Info</p>
                              <p>Size: {formatFileSize(conflict.existingPhoto.fileSize)}</p>
                              <p>Tier: {conflict.existingPhoto.tier.toUpperCase()}</p>
                              <p className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Uploaded: {new Date(conflict.existingPhoto.createdAt).toLocaleDateString()}
                              </p>
                            </div>

                            {conflict.existingPhoto.metadata?.exif && (
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Camera Info</p>
                                <p>Camera: {conflict.existingPhoto.metadata.exif.camera || 'Unknown'}</p>
                                <p>Lens: {conflict.existingPhoto.metadata.exif.lens || 'Unknown'}</p>
                                <p>Settings: {conflict.existingPhoto.metadata.exif.aperture} • {conflict.existingPhoto.metadata.exif.shutter} • ISO {conflict.existingPhoto.metadata.exif.iso}</p>
                                {(conflict.existingPhoto.metadata.exif.dateTaken || conflict.existingPhoto.metadata.exif.dateTime || conflict.existingPhoto.metadata.dateTime) && (
                                  <p>Date Taken: {formatExifDateTime(
                                    conflict.existingPhoto.metadata.exif.dateTaken || 
                                    conflict.existingPhoto.metadata.exif.dateTime || 
                                    conflict.existingPhoto.metadata.dateTime
                                  )}</p>
                                )}
                                {conflict.existingPhoto.metadata.exif.gpsLatitude && (
                                  <p>GPS: {conflict.existingPhoto.metadata.exif.gpsLatitude.toFixed(4)}, {conflict.existingPhoto.metadata.exif.gpsLongitude.toFixed(4)}</p>
                                )}
                                {conflict.existingPhoto.metadata.exif.software && (
                                  <p className="text-xs text-muted-foreground">Software: {conflict.existingPhoto.metadata.exif.software}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* New File - Detailed View */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-card-foreground flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          New File
                        </h4>
                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-3">
                          <div>
                            <p className="font-medium text-sm">{conflict.newFile.originalFilename}</p>
                            <p className="text-xs text-muted-foreground">File Hash: {conflict.newFile.fileHash}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">File Info</p>
                              <p>Size: {formatFileSize(conflict.newFile.fileSize)}</p>
                              <p>Status: Ready to upload</p>
                            </div>

                            {conflict.newFile.metadata?.exif && (
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Camera Info</p>
                                <p>Camera: {conflict.newFile.metadata.exif.camera || 'Unknown'}</p>
                                <p>Lens: {conflict.newFile.metadata.exif.lens || 'Unknown'}</p>
                                <p>Settings: {conflict.newFile.metadata.exif.aperture} • {conflict.newFile.metadata.exif.shutter} • ISO {conflict.newFile.metadata.exif.iso}</p>
                                {(conflict.newFile.metadata.exif.dateTaken || conflict.newFile.metadata.exif.dateTime || conflict.newFile.metadata.dateTime) && (
                                  <p>Date Taken: {formatExifDateTime(
                                    conflict.newFile.metadata.exif.dateTaken || 
                                    conflict.newFile.metadata.exif.dateTime || 
                                    conflict.newFile.metadata.dateTime
                                  )}</p>
                                )}
                                {conflict.newFile.metadata.exif.gpsLatitude && (
                                  <p>GPS: {conflict.newFile.metadata.exif.gpsLatitude.toFixed(4)}, {conflict.newFile.metadata.exif.gpsLongitude.toFixed(4)}</p>
                                )}
                                {conflict.newFile.metadata.exif.software && (
                                  <p className="text-xs text-muted-foreground">Software: {conflict.newFile.metadata.exif.software}</p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              {conflict.conflictType === 'identical_md5' ? 
                                'This file is byte-for-byte identical to the existing file' :
                                `This file is ${Math.round(conflict.similarity * 100)}% visually similar to the existing file`
                              }
                            </p>
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
                        value={conflictResolutions.get(conflict.id)?.action || conflict.suggestedAction}
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
            disabled={resolveMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {resolveMutation.isPending ? 'Resolving...' : `Apply Resolutions`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Render based on mode
  if (mode === 'fullscreen') {
    return (
      <>
        <UploadInterface />
        <ActionButtons />
        <ConflictResolutionDialog />
      </>
    );
  }

  // Modal mode
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preloadedFiles?.length ? 'Resolve Conflicts' : 'Upload Photos'}</DialogTitle>
            <DialogDescription>
              Upload photos and videos to your collection. Duplicate detection will help you manage existing files.
            </DialogDescription>
          </DialogHeader>

          <UploadInterface />
          <ActionButtons />
        </DialogContent>
      </Dialog>

      <ConflictResolutionDialog />
    </>
  );
}