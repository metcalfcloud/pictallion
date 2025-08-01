import React, { useState, useCallback, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Upload, X, CheckCircle, AlertCircle, File, Clock, HardDrive, AlertTriangle } from "lucide-react";
import { uploadManager, UploadFile } from "@/lib/upload-manager";

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

interface BackgroundUploadProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: 'modal' | 'fullscreen';
  preloadedFiles?: UploadFile[];
  onConflictResolved?: () => void;
}

export function BackgroundUpload({ 
  open = true,
  onOpenChange, 
  mode = 'fullscreen',
  preloadedFiles,
  onConflictResolved 
}: BackgroundUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, { action: string; conflict: DuplicateConflict }>>(new Map());
  const [showConflicts, setShowConflicts] = useState(!!preloadedFiles?.length);
  const [isDragActive, setIsDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to upload manager updates
  useEffect(() => {
    const unsubscribe = uploadManager.subscribe(() => {
      setUploadFiles(uploadManager.getUploads());
    });
    
    // Initialize with current uploads
    setUploadFiles(uploadManager.getUploads());
    
    return unsubscribe;
  }, []);

  // Handle preloaded files
  useEffect(() => {
    if (preloadedFiles?.length) {
      setUploadFiles(preloadedFiles);
      setShowConflicts(true);
    }
  }, [preloadedFiles]);

  // File handling
  const handleFilesSelected = useCallback((files: File[]) => {
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (validFiles.length === 0) {
      toast({
        title: "No Valid Files",
        description: "Please select image or video files.",
        variant: "destructive"
      });
      return;
    }

    // Add files to global upload manager
    uploadManager.addFiles(validFiles);
    
    toast({
      title: "Files Added",
      description: `${validFiles.length} files added to upload queue and will continue in background.`,
    });

    // Refresh data after upload (the manager will handle the actual upload)
    queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
    queryClient.invalidateQueries({ queryKey: ["/api/photos/recent"] });
    queryClient.invalidateQueries({ queryKey: ["/api/faces"] });
    queryClient.invalidateQueries({ queryKey: ["/api/faces/unassigned"] });
    queryClient.invalidateQueries({ queryKey: ["/api/faces/suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/people"] });
  }, [toast, queryClient]);

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
    if (files.length > 0) {
      handleFilesSelected(files);
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

  const removeFile = (id: string) => {
    uploadManager.removeFile(id);
  };

  const clearAll = () => {
    uploadManager.clearAll();
  };

  const clearCompletedFiles = () => {
    uploadManager.clearCompleted();
  };

  const closeModal = () => {
    setShowConflicts(false);
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

  // Main upload interface
  const UploadInterface = () => {
    const isUploading = uploadFiles.some(f => f.status === 'uploading');
    
    return (
      <div className="space-y-6">
        {/* Background Upload Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Background Upload System
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Files will continue uploading even if you navigate to other pages. Check the progress indicator in the bottom-right corner.
              </p>
            </div>
          </div>
        </div>

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

        {/* Upload Queue - Show current uploads from global manager */}
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
  };

  // Action buttons
  const ActionButtons = () => {
    const hasCompleted = uploadFiles.some(f => ['success', 'error', 'conflict', 'skipped'].includes(f.status));

    // Don't show action buttons if there are no files and no actions to take
    if (uploadFiles.length === 0) {
      return null;
    }

    return (
      <div className="flex justify-end space-x-3 pt-4 border-t">
        {hasCompleted && (
          <Button onClick={clearCompletedFiles}>
            Clear Completed
          </Button>
        )}
        {mode === 'modal' && (
          <Button variant="outline" onClick={closeModal}>
            Close
          </Button>
        )}
      </div>
    );
  };

  // Render based on mode
  if (mode === 'fullscreen') {
    return (
      <>
        <UploadInterface />
        <ActionButtons />
      </>
    );
  }

  // Modal mode
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
          <DialogDescription>
            Upload photos and videos to your collection. Uploads continue in the background.
          </DialogDescription>
        </DialogHeader>

        <UploadInterface />
        <ActionButtons />
      </DialogContent>
    </Dialog>
  );
}