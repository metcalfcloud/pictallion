import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, FolderOpen, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'conflict' | 'skipped';
  progress: number;
  message?: string;
  conflicts?: any[];
}

interface UnifiedUploadProps {
  mode?: 'modal' | 'fullscreen';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preloadedFiles?: UploadFile[];
  onConflictResolved?: () => void;
}

function UnifiedUpload({ mode = 'fullscreen' }: UnifiedUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const queryClient = useQueryClient();

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
      progress: 0,
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.tiff'],
      'video/*': ['.mp4', '.mov', '.avi']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    // Set uploading status
    setUploadFiles(current => 
      current.map(file => 
        file.status === 'pending' 
          ? { ...file, status: 'uploading', progress: 0 }
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
              status: result.status,
              message: result.message,
              progress: 100,
              conflicts: result.conflicts || [],
            };
          }
          return uploadFile;
        })
      );

      // Refresh data queries
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

    } catch (error) {
      setUploadFiles(current => 
        current.map(file => 
          file.status === 'uploading'
            ? { ...file, status: 'error', message: 'Upload failed', progress: 0 }
            : file
        )
      );
    }
  };

  return (
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
        <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h4 className="text-lg font-medium mb-2">
          {isDragActive ? 'Drop photos here' : 'Drag and drop your photos here'}
        </h4>
        <p className="text-muted-foreground mb-4">or click to browse your files</p>
        <Button type="button">Choose Files</Button>
      </div>

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Files ({uploadFiles.length})</h4>
            <Button variant="outline" size="sm" onClick={() => setUploadFiles([])}>
              Clear All
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploadFiles.map((uploadFile) => (
              <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-background rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {uploadFile.file.name}
                  </p>
                  {uploadFile.message && (
                    <p className="text-xs text-muted-foreground mt-1">{uploadFile.message}</p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {uploadFile.status}
                </span>
              </div>
            ))}
          </div>

          {uploadFiles.some(f => f.status === 'pending') && (
            <Button 
              onClick={handleUpload}
              disabled={uploadFiles.some(f => f.status === 'uploading')}
            >
              {uploadFiles.some(f => f.status === 'uploading') ? 'Uploading...' : 'Start Upload'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Upload() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Upload Photos</h2>
          <p className="text-muted-foreground">
            Add photos and videos to your collection with intelligent duplicate detection
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <FolderOpen className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Photos & Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <UnifiedUpload mode="fullscreen" />
        </CardContent>
      </Card>
    </div>
  );
}