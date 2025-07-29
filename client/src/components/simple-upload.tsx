import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
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
}

export function SimpleUpload({ open, onOpenChange }: SimpleUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const { toast } = useToast();

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

  const handleUpload = () => {
    console.log("Upload button clicked!");
    
    // Test 1: Simple state update
    setUploadFiles(current => 
      current.map(file => ({
        ...file,
        status: 'conflict' as const,
        message: 'WORKING! Found duplicate',
        progress: 100,
      }))
    );

    // Test 2: Show conflicts dialog
    setShowConflicts(true);
    
    // Test 3: Show toast
    toast({
      title: "SUCCESS!",
      description: "The upload button is working correctly now!",
    });
  };

  const clearFiles = () => {
    setUploadFiles([]);
  };

  const removeFile = (id: string) => {
    setUploadFiles(current => current.filter(f => f.id !== id));
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
            <DialogTitle>Simple Upload Test</DialogTitle>
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
              <Button onClick={handleUpload}>
                Test Upload
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Simple Conflicts Dialog */}
      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Duplicate Conflicts Found!</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  Identical File Detected
                  <Badge variant="outline">100% match</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      Existing File
                    </h4>
                    <div className="bg-background p-3 rounded-lg">
                      <p className="font-medium text-sm">20241201_190711_08E94557.jpg</p>
                      <p className="text-xs text-muted-foreground">Size: 5.2 MB</p>
                      <p className="text-xs text-muted-foreground">Tier: BRONZE</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      New File
                    </h4>
                    <div className="bg-background p-3 rounded-lg">
                      <p className="font-medium text-sm">20241201_190711_08E9455sd7.jpg</p>
                      <p className="text-xs text-muted-foreground">Size: 5.2 MB</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-x-2">
                  <Button variant="outline">Keep Existing</Button>
                  <Button variant="outline">Replace</Button>
                  <Button variant="outline">Keep Both</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConflicts(false)}>
              Close
            </Button>
            <Button>Apply Resolutions</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}