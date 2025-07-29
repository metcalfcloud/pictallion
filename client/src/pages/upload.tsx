import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload as UploadIcon, File, CheckCircle, X, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UnifiedUpload } from "@/components/unified-upload";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'conflict' | 'skipped';
  message?: string;
  conflicts?: any[];
}

export default function Upload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleUpload = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    // Set uploading status for pending files
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

  return (
    <>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-card-foreground">Upload Photos</h2>
            <p className="text-sm text-muted-foreground">Add new photos to your collection</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            Try New Upload Modal
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Drop Zone */}
          <Card className="mb-6">
            <CardContent className="p-12">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary hover:bg-primary/5'
                }`}
              >
                <input {...getInputProps()} />
                <UploadIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium text-card-foreground mb-2">
                  {isDragActive ? 'Drop photos here' : 'Drag and drop your photos here'}
                </h4>
                <p className="text-muted-foreground mb-4">or click to browse your files</p>
                <Button>Choose Files</Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Supports JPEG, PNG, TIFF, MP4, MOV, AVI files up to 50MB each
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upload Queue */}
          {uploadFiles.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-card-foreground">
                    Upload Queue ({uploadFiles.length} files)
                  </h3>
                  <div className="flex space-x-2">
                    {uploadFiles.some(f => f.status === 'pending') && (
                      <Button 
                        onClick={handleUpload}
                        disabled={uploadFiles.some(f => f.status === 'uploading')}
                      >
                        {uploadFiles.some(f => f.status === 'uploading') ? 'Uploading...' : 'Start Upload'}
                      </Button>
                    )}
                    {uploadFiles.some(f => f.status === 'success' || f.status === 'error' || f.status === 'conflict' || f.status === 'skipped') && (
                      <Button variant="outline" onClick={clearCompletedFiles}>
                        Clear Completed
                      </Button>
                    )}
                    <Button variant="outline" onClick={clearAll}>
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {uploadFiles.map((uploadFile) => (
                    <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-background rounded-lg">
                      {getStatusIcon(uploadFile.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {uploadFile.file.name}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex-1">
                            {uploadFile.status === 'uploading' && (
                              <Progress value={uploadFile.progress} className="h-2" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {getStatusText(uploadFile)}
                          </span>
                        </div>
                      </div>
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
              </CardContent>
            </Card>
          )}

          {/* Upload Instructions */}
          {uploadFiles.length === 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Upload Instructions</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-card-foreground mb-2">Supported Formats</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Images: JPEG, PNG, TIFF</li>
                      <li>• Videos: MP4, MOV, AVI</li>
                      <li>• Maximum size: 50MB per file</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-card-foreground mb-2">What Happens Next</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Files are uploaded to Bronze tier</li>
                      <li>• Duplicates are automatically detected</li>
                      <li>• Basic metadata is extracted</li>
                      <li>• Ready for AI processing</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New Upload Modal */}
      <UnifiedUpload 
        open={showModal} 
        onOpenChange={setShowModal} 
        mode="modal"
      />
    </>
  );
}