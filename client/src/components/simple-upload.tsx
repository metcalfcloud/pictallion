import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, CheckCircle, AlertCircle, File, Clock, HardDrive } from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'conflict';
  progress: number;
  message?: string;
  conflicts?: any[];
}

interface SimpleUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preloadedFiles?: UploadFile[];
  onConflictResolved?: () => void;
}

export function SimpleUpload({ open, onOpenChange, preloadedFiles, onConflictResolved }: SimpleUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>(preloadedFiles || []);
  const [showConflicts, setShowConflicts] = useState(!!preloadedFiles?.length);
  const [conflictResolutions, setConflictResolutions] = useState(new Map<string, { action: string, conflict: any }>());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newUploadFiles = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    
    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  };

  const handleUpload = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    // Set uploading status
    setUploadFiles(current => 
      current.map(file => 
        file.status === 'pending' 
          ? { ...file, status: 'uploading' as const, progress: 0 }
          : file
      )
    );

    try {
      const formData = new FormData();
      pendingFiles.forEach(file => {
        formData.append('files', file.file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      // Update file statuses based on server response
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

      // Refresh data queries
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });

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
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    }
  };

  const clearFiles = () => {
    setUploadFiles([]);
  };

  const removeFile = (id: string) => {
    setUploadFiles(current => current.filter(f => f.id !== id));
  };

  const updateConflictResolution = (conflictId: string, action: string, conflict: any) => {
    setConflictResolutions(current => {
      const updated = new Map(current);
      updated.set(conflictId, { action, conflict });
      return updated;
    });
  };

  const handleResolveConflicts = async () => {
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

    try {
      const response = await fetch('/api/upload/resolve-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutions }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflicts');
      }

      // Update resolved files to success status
      setUploadFiles(current => 
        current.map(file => 
          file.status === 'conflict' 
            ? { ...file, status: 'success', message: 'Conflict resolved', conflicts: [] }
            : file
        )
      );

      setShowConflicts(false);
      setConflictResolutions(new Map());

      // Refresh data queries
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });

      toast({
        title: "Conflicts Resolved",
        description: "All duplicate conflicts have been processed successfully.",
      });

      // Notify parent component if callback provided
      if (onConflictResolved) {
        onConflictResolved();
      }

    } catch (error) {
      toast({
        title: "Resolution Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preloadedFiles?.length ? 'Resolve Conflicts' : 'Upload Photos'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* File Input */}
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">Select Photos</h4>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <Button asChild>
                <label htmlFor="file-input" className="cursor-pointer">
                  Choose Files
                </label>
              </Button>
            </div>

            {/* Upload Queue */}
            {uploadFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Files ({uploadFiles.length})</h4>
                  <Button variant="outline" size="sm" onClick={clearFiles}>
                    Clear All
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uploadFiles.map((uploadFile) => (
                    <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-background rounded-lg border">
                      {getStatusIcon(uploadFile.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {uploadFile.file.name}
                        </p>
                        {uploadFile.message && (
                          <p className="text-xs text-muted-foreground mt-1">{uploadFile.message}</p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {uploadFile.status === 'conflict' ? 'Conflict!' : uploadFile.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {uploadFiles.some(f => f.status === 'conflict') && (
              <Button 
                onClick={() => setShowConflicts(true)}
                variant="outline"
                className="border-orange-300 text-orange-700"
              >
                View Conflicts ({uploadFiles.filter(f => f.status === 'conflict').length})
              </Button>
            )}
            {uploadFiles.length > 0 && uploadFiles.some(f => f.status === 'pending') && (
              <Button 
                onClick={handleUpload}
                disabled={uploadFiles.some(f => f.status === 'uploading')}
              >
                {uploadFiles.some(f => f.status === 'uploading') ? 'Uploading...' : 'Start Upload'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Simple Conflicts Dialog */}
      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Resolve Duplicate Conflicts</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {uploadFiles
              .filter(f => f.status === 'conflict' && f.conflicts)
              .flatMap(uploadFile => 
                uploadFile.conflicts!.map(conflict => (
                  <Card key={conflict.id} className="border-orange-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-orange-600" />
                          {conflict.conflictType === 'identical_md5' ? 'Identical File' : 
                           conflict.conflictType === 'visually_identical' ? 'Visually Identical' : 
                           'Similar Files'}
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
                          <div className="bg-background p-4 rounded-lg space-y-3">
                            <div>
                              <p className="font-medium text-sm">{conflict.existingPhoto.mediaAsset.originalFilename}</p>
                              <p className="text-xs text-muted-foreground">File Hash: {conflict.existingPhoto.fileHash}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">File Info</p>
                                <p>Size: {(conflict.existingPhoto.fileSize / (1024*1024)).toFixed(1)} MB</p>
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
                                  {conflict.existingPhoto.metadata.exif.gpsLatitude && (
                                    <p>GPS: {conflict.existingPhoto.metadata.exif.gpsLatitude.toFixed(4)}, {conflict.existingPhoto.metadata.exif.gpsLongitude.toFixed(4)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {conflict.existingPhoto.metadata?.dateTime && (
                              <div className="pt-2 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                  Photo taken: {new Date(conflict.existingPhoto.metadata.dateTime).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* New File */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-card-foreground flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            New File
                          </h4>
                          <div className="bg-background p-4 rounded-lg space-y-3">
                            <div>
                              <p className="font-medium text-sm">{conflict.newFile.originalFilename}</p>
                              <p className="text-xs text-muted-foreground">File Hash: {conflict.newFile.fileHash}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">File Info</p>
                                <p>Size: {(conflict.newFile.fileSize / (1024*1024)).toFixed(1)} MB</p>
                                <p>Status: Ready to upload</p>
                              </div>
                              
                              {conflict.newFile.metadata?.exif && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Camera Info</p>
                                  <p>Camera: {conflict.newFile.metadata.exif.camera || 'Unknown'}</p>
                                  <p>Lens: {conflict.newFile.metadata.exif.lens || 'Unknown'}</p>
                                  <p>Settings: {conflict.newFile.metadata.exif.aperture} • {conflict.newFile.metadata.exif.shutter} • ISO {conflict.newFile.metadata.exif.iso}</p>
                                  {conflict.newFile.metadata.exif.gpsLatitude && (
                                    <p>GPS: {conflict.newFile.metadata.exif.gpsLatitude.toFixed(4)}, {conflict.newFile.metadata.exif.gpsLongitude.toFixed(4)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {conflict.newFile.metadata?.dateTime && (
                              <div className="pt-2 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                  Photo taken: {new Date(conflict.newFile.metadata.dateTime).toLocaleString()}
                                </p>
                              </div>
                            )}
                            
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

                      {/* Resolution Actions */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Choose Action:</h4>
                        <Select
                          onValueChange={(value) => updateConflictResolution(conflict.id, value, conflict)}
                          defaultValue={conflict.suggestedAction}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select action..." />
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
              Close
            </Button>
            <Button onClick={handleResolveConflicts}>
              Apply Resolutions
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}